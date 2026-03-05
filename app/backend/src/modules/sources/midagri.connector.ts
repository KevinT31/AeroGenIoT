import { Injectable, Logger } from "@nestjs/common";
import { SourcesService } from "./sources.service";

type MarketPriceItem = {
  date: string;
  priceMin: number;
  priceMax: number;
  source?: string;
};

@Injectable()
export class MidagriConnector {
  private logger = new Logger(MidagriConnector.name);
  private baseUrl = process.env.MIDAGRI_BASE_URL || "";
  private pricesPath = process.env.MIDAGRI_PRICES_PATH || "";
  private apiKey = process.env.MIDAGRI_API_KEY || "";
  private resourceId = process.env.MIDAGRI_RESOURCE_ID || "";
  private dateField = process.env.MIDAGRI_FIELD_DATE || "fecha";
  private priceMinField = process.env.MIDAGRI_FIELD_PRICE_MIN || "precio_min";
  private priceMaxField = process.env.MIDAGRI_FIELD_PRICE_MAX || "precio_max";
  private productField = process.env.MIDAGRI_FIELD_PRODUCT || "producto";
  private zoneField = process.env.MIDAGRI_FIELD_ZONE || "zona";
  private marketField = process.env.MIDAGRI_FIELD_MARKET || "mercado";
  private sourceField = process.env.MIDAGRI_FIELD_SOURCE || "fuente";
  private filterProductField = process.env.MIDAGRI_FILTER_PRODUCT_FIELD || this.productField;
  private filterZoneField = process.env.MIDAGRI_FILTER_ZONE_FIELD || this.zoneField;
  private filterMarketField = process.env.MIDAGRI_FILTER_MARKET_FIELD || this.marketField;
  private defaultSource = process.env.MIDAGRI_DEFAULT_SOURCE || "MIDAGRI";

  constructor(private sources: SourcesService) {}

  async getPrices(cropLabel?: string, zoneLabel?: string, marketLabel?: string): Promise<MarketPriceItem[]> {
    const key = `prices:${cropLabel || "all"}:${zoneLabel || "all"}:${marketLabel || "all"}`;
    const cached = await this.sources.getCached("midagri", key);
    if (cached) return cached.data as MarketPriceItem[];

    let list: MarketPriceItem[] = [];
    try {
      if (this.resourceId) {
        list = await this.fetchFromDkan(cropLabel, zoneLabel, marketLabel);
      }
    } catch (err) {
      this.logger.warn(`MIDAGRI DKAN error: ${err instanceof Error ? err.message : err}`);
    }

    if (!list.length) {
      try {
        if (this.baseUrl && this.pricesPath) {
          list = await this.fetchFromUrl(cropLabel, zoneLabel, marketLabel);
        }
      } catch (err) {
        this.logger.warn(`MIDAGRI URL error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!list.length) {
      list = this.samplePrices();
    }

    await this.sources.setCached("midagri", key, list);
    return list;
  }

  private async fetchFromDkan(cropLabel?: string, zoneLabel?: string, marketLabel?: string) {
    const params: Record<string, string> = {};
    const filters: Record<string, string> = {};
    if (cropLabel && this.filterProductField) filters[this.filterProductField] = cropLabel;
    if (zoneLabel && this.filterZoneField) filters[this.filterZoneField] = zoneLabel;
    if (marketLabel && this.filterMarketField) filters[this.filterMarketField] = marketLabel;
    if (Object.keys(filters).length) {
      params.filters = JSON.stringify(filters);
    }

    const data = await this.sources.fetchDkan(this.resourceId, params);
    const records = Array.isArray(data?.result?.records) ? data.result.records : [];
    return this.normalize(records);
  }

  private async fetchFromUrl(cropLabel?: string, zoneLabel?: string, marketLabel?: string) {
    const url = this.buildUrl(this.pricesPath);
    if (!url) return [];
    const parsed = new URL(url);
    if (cropLabel) parsed.searchParams.set("crop", cropLabel);
    if (zoneLabel) parsed.searchParams.set("zone", zoneLabel);
    if (marketLabel) parsed.searchParams.set("market", marketLabel);
    const data = await this.sources.fetchJson(parsed.toString(), this.apiKey);
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return this.normalize(list);
  }

  private normalize(records: any[]): MarketPriceItem[] {
    return records
      .map((record) => {
        const dateValue =
          record?.[this.dateField] ??
          record?.fecha ??
          record?.date ??
          record?.Fecha ??
          record?.["FECHA"];
        const date = this.normalizeDate(dateValue);
        if (!date) return null;
        const priceMinValue =
          record?.[this.priceMinField] ??
          record?.precio_min ??
          record?.precioMin ??
          record?.["PRECIO_MIN"];
        const priceMaxValue =
          record?.[this.priceMaxField] ??
          record?.precio_max ??
          record?.precioMax ??
          record?.["PRECIO_MAX"];
        const priceMin = this.normalizeNumber(priceMinValue);
        const priceMax = this.normalizeNumber(priceMaxValue);
        const resolvedMin = priceMin ?? priceMax;
        const resolvedMax = priceMax ?? priceMin;
        if (resolvedMin === null || resolvedMax === null) return null;
        const source =
          record?.[this.sourceField] ??
          record?.source ??
          record?.Fuente ??
          record?.FUENTE ??
          this.defaultSource;
        return {
          date,
          priceMin: resolvedMin,
          priceMax: resolvedMax,
          source: String(source || this.defaultSource),
        } as MarketPriceItem;
      })
      .filter(Boolean) as MarketPriceItem[];
  }

  private samplePrices(): MarketPriceItem[] {
    const now = new Date();
    const base = 2.2;
    const list: MarketPriceItem[] = [];
    for (let i = 30; i >= 1; i -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const wave = Math.sin(i / 5) * 0.15;
      const min = Number((base + wave).toFixed(2));
      const max = Number((base + wave + 0.3).toFixed(2));
      list.push({
        date: date.toISOString().split("T")[0],
        priceMin: min,
        priceMax: max,
        source: "SEED",
      });
    }
    return list;
  }

  private buildUrl(path: string) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!this.baseUrl) return "";
    return new URL(path, this.baseUrl).toString();
  }

  private normalizeNumber(value: any): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value)
      .replace(/[^0-9,.-]/g, "")
      .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDate(value: any): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.toISOString().split("T")[0];
  }
}
