import { Injectable, Logger } from "@nestjs/common";
import { SourcesService } from "./sources.service";

type AlertItem = {
  title: string;
  summary: string;
  zoneId?: string;
  zoneName?: string;
  url?: string;
  issuedAt?: string;
  source?: string;
};

@Injectable()
export class SenamhiConnector {
  private logger = new Logger(SenamhiConnector.name);
  private baseUrl = process.env.SENAMHI_BASE_URL || "";
  private alertsPath = process.env.SENAMHI_ALERTS_PATH || "";
  private apiKey = process.env.SENAMHI_API_KEY || "";
  private alertsResourceId = process.env.SENAMHI_ALERTS_RESOURCE_ID || "";
  private alertTitleField = process.env.SENAMHI_ALERTS_FIELD_TITLE || "titulo";
  private alertSummaryField = process.env.SENAMHI_ALERTS_FIELD_SUMMARY || "resumen";
  private alertZoneField = process.env.SENAMHI_ALERTS_FIELD_ZONE || "zona";
  private alertUrlField = process.env.SENAMHI_ALERTS_FIELD_URL || "url";
  private alertDateField = process.env.SENAMHI_ALERTS_FIELD_DATE || "fecha";

  constructor(private sources: SourcesService) {}

  async getAlerts(zoneId?: string, zoneName?: string): Promise<AlertItem[]> {
    const key = `alerts:${zoneId || zoneName || "all"}`;
    const cached = await this.sources.getCached("senamhi", key);
    if (cached) return cached.data as AlertItem[];

    let alerts: AlertItem[] = [];
    try {
      if (this.alertsResourceId) {
        alerts = await this.fetchAlertsFromDkan(zoneName || zoneId);
      }
    } catch (err) {
      this.logger.warn(`SENAMHI DKAN error: ${err instanceof Error ? err.message : err}`);
    }

    if (!alerts.length) {
      try {
        if (this.baseUrl && this.alertsPath) {
          alerts = await this.fetchAlertsFromUrl(zoneName || zoneId);
        }
      } catch (err) {
        this.logger.warn(`SENAMHI URL error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!alerts.length) {
      alerts = this.sampleAlerts(zoneName || zoneId);
    }

    await this.sources.setCached("senamhi", key, alerts);
    return alerts;
  }

  private async fetchAlertsFromDkan(zoneLabel?: string) {
    const params: Record<string, string> = {};
    if (zoneLabel && this.alertZoneField) {
      params.filters = JSON.stringify({ [this.alertZoneField]: zoneLabel });
    }
    const data = await this.sources.fetchDkan(this.alertsResourceId, params);
    const records = Array.isArray(data?.result?.records) ? data.result.records : [];
    return this.normalizeAlerts(records);
  }

  private async fetchAlertsFromUrl(zoneLabel?: string) {
    const url = this.buildUrl(this.alertsPath);
    if (!url) return [];
    const parsed = new URL(url);
    if (zoneLabel) parsed.searchParams.set("zone", zoneLabel);
    const data = await this.sources.fetchJson(parsed.toString(), this.apiKey);
    const raw = Array.isArray(data?.alerts) ? data.alerts : Array.isArray(data) ? data : [];
    return this.normalizeAlerts(raw);
  }

  private normalizeAlerts(records: any[]): AlertItem[] {
    return records
      .map((record) => {
        const title = record?.[this.alertTitleField] ?? record?.title ?? record?.titulo;
        const summary = record?.[this.alertSummaryField] ?? record?.summary ?? record?.resumen ?? "";
        if (!title) return null;
        const zoneName = record?.[this.alertZoneField] ?? record?.zone ?? record?.zona;
        const url = record?.[this.alertUrlField] ?? record?.url ?? record?.link;
        const issuedAt = record?.[this.alertDateField] ?? record?.fecha ?? record?.date;
        return {
          title: String(title),
          summary: String(summary || ""),
          zoneName: zoneName ? String(zoneName) : undefined,
          url: url ? String(url) : undefined,
          issuedAt: issuedAt ? String(issuedAt) : undefined,
          source: "SENAMHI",
        } as AlertItem;
      })
      .filter(Boolean) as AlertItem[];
  }

  private sampleAlerts(zoneLabel?: string): AlertItem[] {
    return [
      {
        title: "Aviso meteorologico",
        summary: "Probables lluvias moderadas. Revisar drenajes y humedad.",
        zoneName: zoneLabel || "Zona central",
        issuedAt: new Date().toISOString().split("T")[0],
        source: "SEED",
      },
    ];
  }

  private buildUrl(path: string) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!this.baseUrl) return "";
    return new URL(path, this.baseUrl).toString();
  }
}
