import { Injectable } from "@nestjs/common";
import { anySimilar, cropAliases, normalizeText } from "./text.utils";

export type EppoEnrichment = {
  scientific_name?: string | null;
  common_names: string[];
  synonyms: string[];
  taxonomy: Record<string, unknown>;
  category?: string | null;
  hosts: string[];
  host_match: boolean | "unknown";
};

@Injectable()
export class AiEppoService {
  private taxonCache = new Map<string, Record<string, unknown>>();
  private hostsCache = new Map<string, string[]>();

  private get baseUrl() {
    return (process.env.EPPO_BASE_URL || "https://api.eppo.int/gd/v2").replace(/\/$/, "");
  }

  private get apiKey() {
    return process.env.EPPO_API_KEY || "";
  }

  private get timeoutMs() {
    return Number(process.env.REQUEST_TIMEOUT_SECONDS || "30") * 1000;
  }

  async enrich(eppoCode: string, crop: string): Promise<EppoEnrichment> {
    const taxon = await this.getTaxon(eppoCode);
    const hosts = await this.getHosts(eppoCode);

    const scientificName =
      this.readString(taxon?.scientificName) ||
      this.readString(taxon?.scientific_name) ||
      this.readString(taxon?.fullName) ||
      this.readString(taxon?.preferredName) ||
      null;

    const commonNames = this.extractNameList(taxon?.commonNames);
    const synonyms = this.extractNameList(taxon?.synonyms);
    const taxonomy = (taxon?.taxonomy as Record<string, unknown>) || {};
    const category = this.readString(taxon?.category) || this.readString(taxon?.type) || null;

    let hostMatch: boolean | "unknown" = "unknown";
    if (hosts.length) {
      hostMatch = this.computeHostMatch(crop, hosts);
    }

    return {
      scientific_name: scientificName,
      common_names: commonNames,
      synonyms,
      taxonomy,
      category,
      hosts,
      host_match: hostMatch,
    };
  }

  private async getTaxon(code: string) {
    const key = code.trim().toUpperCase();
    if (this.taxonCache.has(key)) return this.taxonCache.get(key) || {};

    const payload = await this.getJsonWithRetry(`${this.baseUrl}/taxon/${encodeURIComponent(key)}`);
    const normalized = Array.isArray(payload) ? (payload[0] as Record<string, unknown>) || {} : (payload as Record<string, unknown>) || {};
    this.taxonCache.set(key, normalized);
    return normalized;
  }

  private async getHosts(code: string) {
    const key = code.trim().toUpperCase();
    if (this.hostsCache.has(key)) return this.hostsCache.get(key) || [];

    const payload = await this.getJsonWithRetry(`${this.baseUrl}/taxon/${encodeURIComponent(key)}/hosts`);
    const hosts = this.extractHosts(payload);
    this.hostsCache.set(key, hosts);
    return hosts;
  }

  private async getJsonWithRetry(url: string, attempts = 3): Promise<unknown> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          headers: {
            ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
          },
          signal: controller.signal,
        });

        if (response.status === 429 && attempt < attempts) {
          await this.sleep(300 * attempt);
          continue;
        }

        if (!response.ok) {
          throw new Error(`EPPO error ${response.status}: ${await response.text()}`);
        }

        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }

    return {};
  }

  private extractHosts(payload: unknown) {
    const items = Array.isArray(payload)
      ? payload
      : typeof payload === "object" && payload
      ? ((payload as any).hosts || (payload as any).items || (payload as any).results || [])
      : [];

    const values: string[] = [];
    for (const item of items) {
      if (typeof item === "string") {
        values.push(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const value =
        this.readString((item as any).scientificName) ||
        this.readString((item as any).scientific_name) ||
        this.readString((item as any).name) ||
        this.readString((item as any).preferredName) ||
        this.readString((item as any).label);
      if (value) values.push(value);
    }

    return [...new Set(values)].sort();
  }

  private extractNameList(raw: unknown) {
    if (!raw) return [] as string[];
    if (typeof raw === "string") return [raw];
    if (!Array.isArray(raw)) return [] as string[];

    const values: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        values.push(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const value = this.readString((item as any).name) || this.readString((item as any).value) || this.readString((item as any).scientificName);
      if (value) values.push(value);
    }

    return [...new Set(values)].sort();
  }

  private computeHostMatch(crop: string, hosts: string[]) {
    const aliases = cropAliases(crop);
    const normalizedHosts = hosts.map((host) => normalizeText(host));

    for (const alias of aliases) {
      if (normalizedHosts.includes(alias)) return true;
      if (normalizedHosts.some((host) => host.includes(alias))) return true;
      if (anySimilar(alias, normalizedHosts, 0.84)) return true;
    }

    return false;
  }

  private readString(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
