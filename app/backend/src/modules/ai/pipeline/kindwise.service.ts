import { Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import { Candidate, InputBundle, KindwiseResult, KindwiseTopLabel } from "./types";
import { normalizeText, similarity } from "./text.utils";

@Injectable()
export class AiKindwiseService {
  async run(inputBundle: InputBundle, candidates: Candidate[]): Promise<KindwiseResult> {
    let payload: Record<string, any>;
    try {
      payload = await this.identify(inputBundle);
    } catch (error) {
      if (!this.useMockOnError) throw error;
      payload = this.mockResponse(inputBundle);
    }

    const suggestions = this.extractSuggestions(payload);
    const topLabels: KindwiseTopLabel[] = suggestions.slice(0, 3).map((item) => ({
      label: item.label,
      probability: item.probability,
    }));

    return {
      matched_candidate_eppo_code: this.matchCandidate(candidates, topLabels),
      top_labels: topLabels,
      score_kindwise: topLabels.length ? topLabels[0].probability || null : null,
      symptoms: this.extractSymptoms(payload),
      severity: this.extractSeverity(payload),
      treatment_text: this.extractTreatment(payload),
      raw_kindwise: payload,
    };
  }

  private async identify(inputBundle: InputBundle) {
    const baseUrl = (process.env.KINDWISE_BASE_URL || "https://crop.kindwise.com/api/v1").replace(/\/$/, "");
    const endpoint = process.env.KINDWISE_HEALTH_PATH || "/identification";
    const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const details = process.env.KINDWISE_DETAILS || "disease_details,treatment,taxonomy";
    const params = new URLSearchParams({ details });

    const images = await Promise.all(
      inputBundle.media.images.map(async (item) => {
        const buffer = await fs.readFile(item.uri);
        return buffer.toString("base64");
      }),
    );

    const body: Record<string, any> = { images };
    if ((process.env.KINDWISE_SEND_CROP_CONTEXT || "true").toLowerCase() === "true") {
      body.crop = inputBundle.crop_context.crop;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.kindwiseApiKey ? { "Api-Key": this.kindwiseApiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Kindwise error ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as Record<string, any>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractSuggestions(payload: Record<string, any>) {
    const paths = [
      payload?.result?.disease?.suggestions,
      payload?.result?.diseases?.suggestions,
      payload?.disease?.suggestions,
      payload?.suggestions,
    ];

    const collected: Array<{ label: string; probability: number | null; raw: Record<string, any> }> = [];
    for (const candidate of paths) {
      if (!Array.isArray(candidate) || !candidate.length) continue;
      for (const row of candidate) {
        if (!row || typeof row !== "object") continue;
        const label = String(row.name || row.label || row.disease_name || "").trim();
        if (!label) continue;
        collected.push({
          label,
          probability: this.toProbability(row),
          raw: row,
        });
      }
      if (collected.length) break;
    }

    collected.sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0));
    return collected;
  }

  private toProbability(row: Record<string, any>) {
    const value = row.probability ?? row.score ?? row.confidence;
    if (value === undefined || value === null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
    return Math.max(0, Math.min(1, numeric));
  }

  private extractSymptoms(payload: Record<string, any>) {
    const candidates = [payload?.result?.disease?.symptoms, payload?.result?.symptoms, payload?.symptoms];
    for (const item of candidates) {
      if (Array.isArray(item)) return item.map((value) => String(value));
      if (typeof item === "string" && item.trim()) return [item.trim()];
    }
    return [] as string[];
  }

  private extractSeverity(payload: Record<string, any>) {
    const candidates = [payload?.result?.disease?.severity, payload?.result?.severity, payload?.severity];
    const value = candidates.find((item) => item !== undefined && item !== null);
    return value === undefined || value === null ? null : String(value);
  }

  private extractTreatment(payload: Record<string, any>) {
    const candidates = [
      payload?.result?.disease?.treatment,
      payload?.result?.management_actions,
      payload?.result?.treatment_recommendations,
      payload?.treatment,
    ];
    for (const item of candidates) {
      if (Array.isArray(item)) {
        const values = item.map((value) => String(value).trim()).filter(Boolean);
        if (values.length) return values.join(" | ");
      }
      if (typeof item === "string" && item.trim()) return item.trim();
    }
    return null;
  }

  private matchCandidate(candidates: Candidate[], topLabels: KindwiseTopLabel[]) {
    if (!candidates.length || !topLabels.length) return null;

    let bestScore = 0;
    let bestCode: string | null = null;
    for (const top of topLabels.slice(0, 2)) {
      const label = normalizeText(top.label);
      for (const candidate of candidates) {
        const names = [candidate.label, candidate.scientific_name || "", ...candidate.synonyms];
        for (const name of names) {
          const score = similarity(label, name);
          if (score > bestScore) {
            bestScore = score;
            bestCode = candidate.eppo_code;
          }
        }
      }
    }

    return bestScore >= 0.84 ? bestCode : null;
  }

  private mockResponse(inputBundle: InputBundle): Record<string, any> {
    const crop = normalizeText(inputBundle.crop_context.crop);
    if (crop === "tomato" || crop === "tomate" || crop === "solanum lycopersicum") {
      return {
        result: {
          disease: {
            suggestions: [
              { name: "Alternaria solani", probability: 0.89 },
              { name: "Phytophthora infestans", probability: 0.43 },
            ],
            symptoms: ["Manchas marrones concentricas en hojas", "Amarillamiento progresivo"],
            severity: "media",
            treatment: "Retiro de tejido afectado, reduccion de humedad foliar y tratamiento fungicida preventivo.",
          },
        },
      };
    }

    return {
      result: {
        disease: {
          suggestions: [
            { name: "Aphis sp.", probability: 0.61 },
            { name: "Leaf spot", probability: 0.33 },
          ],
          symptoms: ["Presencia de colonias en brotes tiernos"],
          severity: "baja",
          treatment: "Monitoreo y manejo cultural preventivo.",
        },
      },
    };
  }

  private get requestTimeoutMs() {
    return Number(process.env.REQUEST_TIMEOUT_SECONDS || "30") * 1000;
  }

  private get useMockOnError() {
    return (process.env.USE_MOCK_ON_ERROR || "true").toLowerCase() === "true";
  }

  private get kindwiseApiKey() {
    return process.env.KINDWISE_API_KEY || "";
  }
}
