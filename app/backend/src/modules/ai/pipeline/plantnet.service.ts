import { Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import path from "path";
import { AiEppoService } from "./eppo.service";
import { Block1Output, Candidate, InputBundle } from "./types";
import { normalizeText } from "./text.utils";

@Injectable()
export class AiPlantNetService {
  constructor(private readonly eppo: AiEppoService) {}

  async run(inputBundle: InputBundle): Promise<Block1Output> {
    let payload: Record<string, any>;
    try {
      payload = await this.identifyDiseases(inputBundle);
    } catch (error) {
      if (!this.useMockOnError) throw error;
      payload = this.mockResponse(inputBundle);
    }

    const results = Array.isArray(payload.results) ? payload.results : [];
    const ranked = [...results].sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
    const droppedBelowThreshold = ranked.filter((item) => Number(item?.score || 0) < this.minPlantNetScore).length;
    const selected = ranked
      .filter((item) => Number(item?.score || 0) >= this.minPlantNetScore)
      .slice(0, this.topCandidates);

    const candidates: Candidate[] = [];
    for (const row of selected) {
      const eppoCode = String(row?.name || "").trim().toUpperCase();
      if (!eppoCode) continue;

      let enrichment: Awaited<ReturnType<AiEppoService["enrich"]>> | null = null;
      try {
        enrichment = await this.eppo.enrich(eppoCode, inputBundle.crop_context.crop);
      } catch {
        enrichment = null;
      }

      const label =
        enrichment?.scientific_name ||
        (typeof row?.description === "string" ? row.description : null) ||
        (typeof row?.name === "string" ? row.name : null) ||
        eppoCode;

      candidates.push({
        eppo_code: eppoCode,
        label: String(label),
        score_plantnet: Number(row?.score || 0),
        taxonomy: enrichment?.taxonomy || {},
        hosts: enrichment?.hosts || [],
        host_match: enrichment?.host_match || "unknown",
        scientific_name: enrichment?.scientific_name || null,
        common_names: enrichment?.common_names || [],
        category: enrichment?.category || null,
        synonyms: enrichment?.synonyms || [],
        plantnet_images: Array.isArray(row?.images) ? row.images : [],
      });
    }

    return {
      candidates,
      dropped_below_threshold: droppedBelowThreshold,
      plantnet_language: typeof payload.language === "string" ? payload.language : null,
      plantnet_remaining_requests: typeof payload.remainingIdentificationRequests === "number" ? payload.remainingIdentificationRequests : null,
      raw_plantnet: payload,
    };
  }

  private async identifyDiseases(inputBundle: InputBundle): Promise<Record<string, any>> {
    const base = this.resolveBaseUrl();
    const url = `${base}/v2/diseases/identify`;
    const params = new URLSearchParams({
      "api-key": this.plantNetApiKey,
      lang: inputBundle.lang,
      "include-related-images": "true",
      "no-reject": "true",
      "nb-results": String(this.topCandidates),
    });

    const formData = new FormData();
    for (const image of inputBundle.media.images) {
      const buffer = await fs.readFile(image.uri);
      const fileName = path.basename(image.uri);
      const blob = new Blob([buffer], { type: image.mime || "image/jpeg" });
      formData.append("images", blob, fileName);
      formData.append("organs", this.normalizeOrgan(image.organ));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Pl@ntNet error ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as Record<string, any>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mockResponse(inputBundle: InputBundle): Record<string, any> {
    const crop = normalizeText(inputBundle.crop_context.crop);
    let results: Array<Record<string, unknown>>;
    if (crop === "tomato" || crop === "tomate" || crop === "solanum lycopersicum") {
      results = [
        { name: "ALTES", score: 0.86, description: "Alternaria solani", images: [] },
        { name: "PHYTIN", score: 0.62, description: "Phytophthora infestans", images: [] },
        { name: "SEPTLY", score: 0.41, description: "Septoria lycopersici", images: [] },
      ];
    } else if (crop === "potato" || crop === "papa" || crop === "solanum tuberosum") {
      results = [
        { name: "PHYTIN", score: 0.82, description: "Phytophthora infestans", images: [] },
        { name: "ALTES", score: 0.49, description: "Alternaria solani", images: [] },
      ];
    } else {
      results = [
        { name: "APHISP", score: 0.58, description: "Aphis sp.", images: [] },
        { name: "ALTES", score: 0.32, description: "Alternaria solani", images: [] },
      ];
    }

    return {
      query: {
        images: inputBundle.media.images.map((item) => item.sha256),
        organs: inputBundle.media.images.map((item) => item.organ),
      },
      language: inputBundle.lang,
      results,
      version: "mock-2026.02",
      remainingIdentificationRequests: null,
    };
  }

  private resolveBaseUrl() {
    const base = (process.env.PLANTNET_BASE_URL || "https://my-api.plantnet.org").replace(/\/$/, "");
    if (base.includes("my.plantnet.org")) return "https://my-api.plantnet.org";
    return base;
  }

  private normalizeOrgan(organ: string) {
    const valid = new Set(["leaf", "flower", "fruit", "bark", "auto"]);
    const normalized = normalizeText(organ);
    return valid.has(normalized) ? normalized : "auto";
  }

  private get requestTimeoutMs() {
    return Number(process.env.REQUEST_TIMEOUT_SECONDS || "30") * 1000;
  }

  private get useMockOnError() {
    return (process.env.USE_MOCK_ON_ERROR || "true").toLowerCase() === "true";
  }

  private get plantNetApiKey() {
    return process.env.PLANTNET_API_KEY || "";
  }

  private get minPlantNetScore() {
    return Number(process.env.MIN_PLANTNET_SCORE || "0.30");
  }

  private get topCandidates() {
    return Number(process.env.TOP_CANDIDATES || "3");
  }
}
