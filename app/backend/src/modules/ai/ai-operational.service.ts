import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type FaultPrediction = {
  deviceId: string | null;
  label: string | null;
  confidencePct: number | null;
  severity: "info" | "warning" | "critical";
  recommendedAction: string | null;
  timestamp: string | null;
};

type PowerForecast = {
  deviceId: string | null;
  predictedPowerW: number | null;
  lowerBoundW: number | null;
  upperBoundW: number | null;
  horizonMinutes: number | null;
  timestamp: string | null;
};

type YawRecommendation = {
  deviceId: string | null;
  targetYawDeg: number | null;
  action: string | null;
  confidencePct: number | null;
  reason: string | null;
  timestamp: string | null;
};

export type OperationalAiSnapshot = {
  deviceId: string | null;
  updatedAt: string | null;
  faultPrediction: FaultPrediction | null;
  powerForecast: PowerForecast | null;
  yawRecommendation: YawRecommendation | null;
};

type TableRow = Record<string, unknown>;

type TableDescriptor = {
  envKey: string;
  fallbackTable: string;
  deviceCandidates: string[];
  orderCandidates: string[];
};

@Injectable()
export class AiOperationalService {
  private readonly logger = new Logger(AiOperationalService.name);
  private readonly schemaCache = new Map<string, Promise<Map<string, string>>>();

  constructor(private readonly prisma: PrismaService) {}

  async latest(deviceId?: string): Promise<OperationalAiSnapshot> {
    const requestedDeviceId =
      this.normalizeString(deviceId) ||
      this.normalizeString(process.env.AI_DEFAULT_DEVICE_ID) ||
      this.normalizeString(process.env.TELEMETRY_DEFAULT_DEVICE_ID);

    const [faultRow, powerRow, yawRow] = await Promise.all([
      this.loadLatestRow(
        {
          envKey: "AI_FAULT_TABLE_NAME",
          fallbackTable: "ai_fault_predictions",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["prediction_time", "predicted_at", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
      this.loadLatestRow(
        {
          envKey: "AI_POWER_TABLE_NAME",
          fallbackTable: "ai_power_forecast",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["forecast_time", "prediction_time", "predicted_at", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
      this.loadLatestRow(
        {
          envKey: "AI_YAW_TABLE_NAME",
          fallbackTable: "ai_yaw_recommendations",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["recommendation_time", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
    ]);

    const faultPrediction = this.normalizeFaultPrediction(faultRow);
    const powerForecast = this.normalizePowerForecast(powerRow);
    const yawRecommendation = this.normalizeYawRecommendation(yawRow);
    const resolvedDeviceId =
      faultPrediction?.deviceId ||
      powerForecast?.deviceId ||
      yawRecommendation?.deviceId ||
      requestedDeviceId ||
      null;

    return {
      deviceId: resolvedDeviceId,
      updatedAt: this.pickLatestTimestamp(
        faultPrediction?.timestamp,
        powerForecast?.timestamp,
        yawRecommendation?.timestamp,
      ),
      faultPrediction,
      powerForecast,
      yawRecommendation,
    };
  }

  private async loadLatestRow(descriptor: TableDescriptor, deviceId: string | null) {
    const tableName = this.getTableName(descriptor.envKey, descriptor.fallbackTable);
    const schema = await this.loadSchema(tableName);
    if (!schema.size) return null;

    const deviceColumn = this.pickExistingColumn(schema, descriptor.deviceCandidates);
    const orderColumn = this.pickExistingColumn(schema, descriptor.orderCandidates);
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (deviceId && deviceColumn) {
      whereClauses.push(`\`${deviceColumn}\` = ?`);
      params.push(deviceId);
    }

    const sql = [
      `SELECT * FROM \`${tableName}\``,
      whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
      orderColumn ? `ORDER BY \`${orderColumn}\` DESC` : "",
      "LIMIT 1",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const rows = await this.prisma.$queryRawUnsafe<TableRow[]>(sql, ...params);
      return rows[0] ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo consultar ${tableName}: ${message}`);
      return null;
    }
  }

  private async loadSchema(tableName: string) {
    if (!this.schemaCache.has(tableName)) {
      this.schemaCache.set(tableName, this.fetchSchema(tableName));
    }
    return this.schemaCache.get(tableName)!;
  }

  private async fetchSchema(tableName: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ COLUMN_NAME?: string }>>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      tableName,
    );

    const schema = new Map<string, string>();
    for (const row of rows) {
      const name = this.normalizeString(row.COLUMN_NAME);
      if (!name) continue;
      schema.set(name.toLowerCase(), name);
    }

    if (!schema.size) {
      this.logger.warn(`La tabla o vista '${tableName}' no fue encontrada en la base actual.`);
    }

    return schema;
  }

  private normalizeFaultPrediction(row: TableRow | null): FaultPrediction | null {
    if (!row) return null;

    const riskLevel = this.normalizeString(
      this.pickRowValue(row, ["risk_level", "severity", "level", "priority"]),
    );
    const label = this.normalizeString(
      this.pickRowValue(row, [
        "top_reason",
        "reason",
        "root_cause",
        "fault_label",
        "predicted_fault",
        "prediction_label",
        "fault_type",
        "class_name",
        "predicted_label",
        "fault",
        "label",
        "prediction",
      ]),
    );
    const confidencePct = this.normalizePercent(
      this.pickNullableNumber(row, [
        "risk_score",
        "confidence_pct",
        "confidence_score",
        "confidence",
        "probability",
        "score",
        "prediction_probability",
        "fault_probability",
      ]),
    );
    const recommendedAction = this.normalizeString(
      this.pickRowValue(row, [
        "recommended_action",
        "action",
        "recommendation",
        "recommended_step",
        "maintenance_action",
        "next_step",
        "recommended_response",
      ]),
    );
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "prediction_time",
        "prediction_timestamp",
        "predicted_at",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const severity = this.normalizeSeverity(
      riskLevel,
      label,
      confidencePct,
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (!label && !recommendedAction && confidencePct === null && !timestamp) {
      return null;
    }

    return {
      deviceId,
      label,
      confidencePct,
      severity,
      recommendedAction,
      timestamp,
    };
  }

  private normalizePowerForecast(row: TableRow | null): PowerForecast | null {
    if (!row) return null;

    const predictedPowerW =
      this.pickNullableNumber(row, [
        "pred_power",
        "predicted_power",
        "predicted_power_w",
        "power_forecast_w",
        "forecast_power_w",
        "prediction_w",
        "predicted_w",
        "forecast_w",
        "power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "predicted_power_kw",
          "power_forecast_kw",
          "forecast_power_kw",
          "prediction_kw",
          "predicted_kw",
          "forecast_kw",
          "power_kw",
        ]),
      );
    const lowerBoundW =
      this.pickNullableNumber(row, [
        "pred_power_lower",
        "lower_bound_w",
        "prediction_lower_w",
        "lower_w",
        "min_power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "lower_bound_kw",
          "prediction_lower_kw",
          "lower_kw",
          "min_power_kw",
        ]),
      );
    const upperBoundW =
      this.pickNullableNumber(row, [
        "pred_power_upper",
        "upper_bound_w",
        "prediction_upper_w",
        "upper_w",
        "max_power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "upper_bound_kw",
          "prediction_upper_kw",
          "upper_kw",
          "max_power_kw",
        ]),
      );
    const horizonMinutes = this.pickNullableNumber(row, [
      "horizon_minutes",
      "forecast_horizon_min",
      "horizon_min",
      "window_minutes",
      "minutes_ahead",
      "lead_minutes",
    ]);
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "forecast_time",
        "forecast_timestamp",
        "prediction_time",
        "predicted_at",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (predictedPowerW === null && lowerBoundW === null && upperBoundW === null && horizonMinutes === null) {
      return null;
    }

    return {
      deviceId,
      predictedPowerW,
      lowerBoundW,
      upperBoundW,
      horizonMinutes,
      timestamp,
    };
  }

  private normalizeYawRecommendation(row: TableRow | null): YawRecommendation | null {
    if (!row) return null;

    const targetYawDeg = this.normalizeAngle(
      this.pickNullableNumber(row, [
        "recommended_yaw_angle",
        "recommended_yaw_angle_deg",
        "recommended_yaw_deg",
        "target_yaw_deg",
        "yaw_target_deg",
        "yaw_deg",
        "recommended_angle_deg",
        "target_angle_deg",
      ]),
    );
    const action = this.normalizeString(
      this.pickRowValue(row, ["action", "recommended_action", "recommendation", "next_action"]),
    );
    const reason = this.normalizeString(
      this.pickRowValue(row, ["reason", "rationale", "explanation", "note", "details"]),
    );
    const confidencePct = this.normalizePercent(
      this.pickNullableNumber(row, [
        "confidence_score",
        "confidence_pct",
        "confidence",
        "probability",
        "score",
      ]),
    );
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "recommendation_time",
        "recommendation_timestamp",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (targetYawDeg === null && !action && !reason && confidencePct === null) {
      return null;
    }

    return {
      deviceId,
      targetYawDeg,
      action,
      confidencePct,
      reason,
      timestamp,
    };
  }

  private pickExistingColumn(schema: Map<string, string>, candidates: string[]) {
    for (const candidate of candidates) {
      const match = schema.get(candidate.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  private pickRowValue(row: TableRow, candidates: string[]) {
    const lookup = this.rowLookup(row);
    for (const candidate of candidates) {
      if (lookup.has(candidate.toLowerCase())) {
        return lookup.get(candidate.toLowerCase());
      }
    }
    return null;
  }

  private rowLookup(row: TableRow) {
    return new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const));
  }

  private pickNullableNumber(row: TableRow, candidates: string[]) {
    for (const candidate of candidates) {
      const value = this.pickRowValue(row, [candidate]);
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private getTableName(envKey: string, fallback: string) {
    const raw = this.normalizeString(process.env[envKey]) || fallback;
    return this.safeIdentifier(raw);
  }

  private safeIdentifier(value: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Identificador SQL invalido: ${value}`);
    }
    return value;
  }

  private normalizeString(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeTimestamp(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.startsWith("0000-00-00")) return null;
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
    }
    return null;
  }

  private normalizePercent(value: number | null) {
    if (value === null) return null;
    const normalized = value <= 1 ? value * 100 : value;
    return Number(Math.max(0, Math.min(100, normalized)).toFixed(1));
  }

  private normalizeAngle(value: number | null) {
    if (value === null) return null;
    const normalized = ((value % 360) + 360) % 360;
    return Number(normalized.toFixed(1));
  }

  private scaleKwToW(value: number | null) {
    if (value === null) return null;
    return Number((value * 1000).toFixed(1));
  }

  private normalizeSeverity(raw: unknown, label: string | null, confidencePct: number | null) {
    const value = String(raw || "")
      .trim()
      .toLowerCase();

    if (["critical", "critico", "critica", "high", "alta", "alto"].includes(value)) {
      return "critical" as const;
    }
    if (["warning", "warn", "media", "medio", "moderate"].includes(value)) {
      return "warning" as const;
    }
    if (["info", "low", "baja", "bajo", "normal"].includes(value)) {
      return "info" as const;
    }

    const normalizedLabel = String(label || "").toLowerCase();
    if (normalizedLabel.includes("fault") || normalizedLabel.includes("critical")) {
      return "critical" as const;
    }
    if (normalizedLabel.includes("temp") || normalizedLabel.includes("vibration") || normalizedLabel.includes("overload")) {
      return "warning" as const;
    }
    if ((confidencePct ?? 0) >= 85) {
      return "warning" as const;
    }
    return "info" as const;
  }

  private pickLatestTimestamp(...timestamps: Array<string | null | undefined>) {
    const valid = timestamps
      .map((value) => (value ? new Date(value) : null))
      .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime());

    return valid[0]?.toISOString() || null;
  }
}
