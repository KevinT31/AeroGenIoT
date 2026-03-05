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

type GuideItem = {
  title: string;
  summary: string;
  crop?: string;
  issue?: string;
  url?: string;
  source?: string;
};

@Injectable()
export class SenasaConnector {
  private logger = new Logger(SenasaConnector.name);
  private baseUrl = process.env.SENASA_BASE_URL || "";
  private alertsPath = process.env.SENASA_ALERTS_PATH || "";
  private guidesPath = process.env.SENASA_GUIDES_PATH || "";
  private apiKey = process.env.SENASA_API_KEY || "";
  private alertsResourceId = process.env.SENASA_ALERTS_RESOURCE_ID || "";
  private guidesResourceId = process.env.SENASA_GUIDES_RESOURCE_ID || "";
  private alertTitleField = process.env.SENASA_ALERTS_FIELD_TITLE || "titulo";
  private alertSummaryField = process.env.SENASA_ALERTS_FIELD_SUMMARY || "resumen";
  private alertZoneField = process.env.SENASA_ALERTS_FIELD_ZONE || "zona";
  private alertUrlField = process.env.SENASA_ALERTS_FIELD_URL || "url";
  private alertDateField = process.env.SENASA_ALERTS_FIELD_DATE || "fecha";
  private guideTitleField = process.env.SENASA_GUIDES_FIELD_TITLE || "titulo";
  private guideSummaryField = process.env.SENASA_GUIDES_FIELD_SUMMARY || "resumen";
  private guideCropField = process.env.SENASA_GUIDES_FIELD_CROP || "cultivo";
  private guideIssueField = process.env.SENASA_GUIDES_FIELD_ISSUE || "problema";
  private guideUrlField = process.env.SENASA_GUIDES_FIELD_URL || "url";

  constructor(private sources: SourcesService) {}

  async getAlerts(zoneId?: string, zoneName?: string): Promise<AlertItem[]> {
    const key = `alerts:${zoneId || zoneName || "all"}`;
    const cached = await this.sources.getCached("senasa", key);
    if (cached) return cached.data as AlertItem[];

    let alerts: AlertItem[] = [];
    try {
      if (this.alertsResourceId) {
        alerts = await this.fetchAlertsFromDkan(zoneName || zoneId);
      }
    } catch (err) {
      this.logger.warn(`SENASA DKAN error: ${err instanceof Error ? err.message : err}`);
    }

    if (!alerts.length) {
      try {
        if (this.baseUrl && this.alertsPath) {
          alerts = await this.fetchAlertsFromUrl(zoneName || zoneId);
        }
      } catch (err) {
        this.logger.warn(`SENASA URL error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!alerts.length) {
      alerts = this.sampleAlerts(zoneName || zoneId);
    }

    await this.sources.setCached("senasa", key, alerts);
    return alerts;
  }

  async getGuides(cropLabel?: string, issue?: string): Promise<GuideItem[]> {
    const key = `guides:${cropLabel || "all"}:${issue || "all"}`;
    const cached = await this.sources.getCached("senasa", key);
    if (cached) return cached.data as GuideItem[];

    let guides: GuideItem[] = [];
    try {
      if (this.guidesResourceId) {
        guides = await this.fetchGuidesFromDkan(cropLabel, issue);
      }
    } catch (err) {
      this.logger.warn(`SENASA guides DKAN error: ${err instanceof Error ? err.message : err}`);
    }

    if (!guides.length) {
      try {
        if (this.baseUrl && this.guidesPath) {
          guides = await this.fetchGuidesFromUrl(cropLabel, issue);
        }
      } catch (err) {
        this.logger.warn(`SENASA guides URL error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!guides.length) {
      guides = this.sampleGuides(cropLabel, issue);
    }

    await this.sources.setCached("senasa", key, guides);
    return guides;
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

  private async fetchGuidesFromDkan(cropLabel?: string, issue?: string) {
    const filters: Record<string, string> = {};
    if (cropLabel && this.guideCropField) filters[this.guideCropField] = cropLabel;
    if (issue && this.guideIssueField) filters[this.guideIssueField] = issue;
    const params: Record<string, string> = {};
    if (Object.keys(filters).length) params.filters = JSON.stringify(filters);
    const data = await this.sources.fetchDkan(this.guidesResourceId, params);
    const records = Array.isArray(data?.result?.records) ? data.result.records : [];
    return this.normalizeGuides(records);
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

  private async fetchGuidesFromUrl(cropLabel?: string, issue?: string) {
    const url = this.buildUrl(this.guidesPath);
    if (!url) return [];
    const parsed = new URL(url);
    if (cropLabel) parsed.searchParams.set("crop", cropLabel);
    if (issue) parsed.searchParams.set("issue", issue);
    const data = await this.sources.fetchJson(parsed.toString(), this.apiKey);
    const raw = Array.isArray(data?.guides) ? data.guides : Array.isArray(data) ? data : [];
    return this.normalizeGuides(raw);
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
          source: "SENASA",
        } as AlertItem;
      })
      .filter(Boolean) as AlertItem[];
  }

  private normalizeGuides(records: any[]): GuideItem[] {
    return records
      .map((record) => {
        const title = record?.[this.guideTitleField] ?? record?.title ?? record?.titulo;
        const summary = record?.[this.guideSummaryField] ?? record?.summary ?? record?.resumen ?? "";
        if (!title) return null;
        const crop = record?.[this.guideCropField] ?? record?.crop ?? record?.cultivo;
        const issue = record?.[this.guideIssueField] ?? record?.issue ?? record?.problema;
        const url = record?.[this.guideUrlField] ?? record?.url ?? record?.link;
        return {
          title: String(title),
          summary: String(summary || ""),
          crop: crop ? String(crop) : undefined,
          issue: issue ? String(issue) : undefined,
          url: url ? String(url) : undefined,
          source: "SENASA",
        } as GuideItem;
      })
      .filter(Boolean) as GuideItem[];
  }

  private sampleAlerts(zoneLabel?: string): AlertItem[] {
    return [
      {
        title: "Alerta fitosanitaria preventiva",
        summary: "Se reportan condiciones favorables para plagas en cultivos sensibles.",
        zoneName: zoneLabel || "Zona central",
        issuedAt: new Date().toISOString().split("T")[0],
        source: "SEED",
      },
    ];
  }

  private sampleGuides(cropLabel?: string, issue?: string): GuideItem[] {
    return [
      {
        title: "Guia basica de manejo sanitario",
        summary: "Revisar hojas nuevas, eliminar focos y aplicar manejo integrado.",
        crop: cropLabel || "Cultivo",
        issue: issue || "Manejo general",
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
