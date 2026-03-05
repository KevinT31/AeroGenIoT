import { Injectable } from "@nestjs/common";
import { Candidate, GeoSignal, InputBundle, KindwiseResult } from "./types";

@Injectable()
export class AiGbifService {
  private taxonCache = new Map<string, number>();

  async run(inputBundle: InputBundle, candidates: Candidate[], kindwise: KindwiseResult): Promise<GeoSignal> {
    const selected = this.selectCandidate(candidates, kindwise.matched_candidate_eppo_code || null);
    if (!selected) {
      return {
        eppo_code: null,
        geo_support: "unknown",
        occurrence_level: "desconocido",
        presence_in_country: "unknown",
        host_reported: "unknown",
        notes: "Sin candidato para validar en GBIF",
      };
    }

    const scientificName = selected.scientific_name || selected.label;
    if (!scientificName) {
      return {
        eppo_code: selected.eppo_code,
        geo_support: "unknown",
        occurrence_level: "desconocido",
        presence_in_country: "unknown",
        host_reported: this.hostReported(selected),
        notes: "Candidato sin nombre cientifico",
      };
    }

    try {
      const taxon = await this.getTaxonMatch(scientificName);
      if (!taxon.usageKey) {
        return {
          eppo_code: selected.eppo_code,
          geo_support: "unknown",
          occurrence_level: "desconocido",
          presence_in_country: "unknown",
          host_reported: this.hostReported(selected),
          raw_gbif: { species_match: taxon.payload },
          notes: `GBIF sin match taxonomico para '${scientificName}'`,
        };
      }

      const occurrence = await this.getOccurrenceCount(taxon.usageKey, inputBundle.location.country_code);
      const count = occurrence.count;
      return {
        eppo_code: selected.eppo_code,
        geo_support: count > 0 ? true : "unknown",
        occurrence_level: this.occurrenceLevel(count),
        occurrence_count: count,
        presence_in_country: count > 0,
        host_reported: this.hostReported(selected),
        raw_gbif: {
          species_match: taxon.payload,
          occurrence_search: occurrence.payload,
        },
        notes: `GBIF taxonKey=${taxon.usageKey}, country=${inputBundle.location.country_code}, count=${count}, match_confidence=${
          taxon.confidence || "n/a"
        }, match_type=${taxon.matchType || "n/a"}`,
      };
    } catch (error) {
      if (!this.useMockOnError) throw error;
      return this.mockSignal(selected);
    }
  }

  private selectCandidate(candidates: Candidate[], preferred: string | null) {
    if (!candidates.length) return null;
    if (preferred) {
      const found = candidates.find((item) => item.eppo_code === preferred);
      if (found) return found;
    }
    return candidates[0];
  }

  private async getTaxonMatch(scientificName: string) {
    const key = scientificName.toLowerCase().trim();
    if (this.taxonCache.has(key)) {
      const usageKey = this.taxonCache.get(key) || 0;
      return { usageKey: usageKey || null, confidence: null, matchType: null, payload: {} as Record<string, unknown> };
    }

    const baseUrl = (process.env.GBIF_BASE_URL || "https://api.gbif.org/v1").replace(/\/$/, "");
    const params = new URLSearchParams({ name: scientificName });
    const response = await this.fetchJson(`${baseUrl}/species/match?${params.toString()}`);
    const payload = response as Record<string, unknown>;
    const usageKey = Number(payload.usageKey);
    const confidence = Number(payload.confidence);
    const matchType = typeof payload.matchType === "string" ? payload.matchType : null;

    if (Number.isFinite(usageKey) && usageKey > 0) {
      this.taxonCache.set(key, usageKey);
    }

    return {
      usageKey: Number.isFinite(usageKey) && usageKey > 0 ? usageKey : null,
      confidence: Number.isFinite(confidence) ? confidence : null,
      matchType,
      payload,
    };
  }

  private async getOccurrenceCount(taxonKey: number, countryCode: string) {
    const baseUrl = (process.env.GBIF_BASE_URL || "https://api.gbif.org/v1").replace(/\/$/, "");
    const params = new URLSearchParams({
      taxonKey: String(taxonKey),
      country: countryCode,
      limit: "0",
    });
    const response = (await this.fetchJson(`${baseUrl}/occurrence/search?${params.toString()}`)) as Record<string, unknown>;
    const rawCount = Number(response.count || 0);
    return {
      count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0,
      payload: response,
    };
  }

  private occurrenceLevel(count: number): GeoSignal["occurrence_level"] {
    if (count > 50) return "alto";
    if (count >= 10) return "medio";
    if (count >= 1) return "bajo";
    return "desconocido";
  }

  private mockSignal(candidate: Candidate): GeoSignal {
    if (candidate.eppo_code === "ALTES" || candidate.eppo_code === "PHYTIN") {
      return {
        eppo_code: candidate.eppo_code,
        geo_support: true,
        occurrence_level: "medio",
        occurrence_count: 24,
        presence_in_country: true,
        host_reported: this.hostReported(candidate),
        raw_gbif: {
          species_match: { usageKey: 5231190, confidence: 98, matchType: "EXACT" },
          occurrence_search: { count: 24, limit: 0 },
        },
        notes: "Mock GBIF: soporte geografico moderado",
      };
    }

    return {
      eppo_code: candidate.eppo_code,
      geo_support: "unknown",
      occurrence_level: "desconocido",
      occurrence_count: 0,
      presence_in_country: "unknown",
      host_reported: this.hostReported(candidate),
      raw_gbif: {
        species_match: { usageKey: null, confidence: 0, matchType: "NONE" },
        occurrence_search: { count: 0, limit: 0 },
      },
      notes: "Mock GBIF: sin registros concluyentes",
    };
  }

  private hostReported(candidate: Candidate): boolean | "unknown" {
    if (candidate.host_match === true) return true;
    if (candidate.host_match === false) return false;
    return "unknown";
  }

  private async fetchJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.REQUEST_TIMEOUT_SECONDS || "30") * 1000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`GBIF error ${response.status}: ${await response.text()}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private get useMockOnError() {
    return (process.env.USE_MOCK_ON_ERROR || "true").toLowerCase() === "true";
  }
}
