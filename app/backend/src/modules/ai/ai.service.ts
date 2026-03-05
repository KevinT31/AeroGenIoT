import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportConfidence } from "@prisma/client";
import { ReportsService } from "../reports/reports.service";
import { AiDiagnosisDto } from "./dto.ai-diagnosis";
import { AiFollowupDto } from "./dto.ai-followup";
import { DiagnosisPipelineService } from "./pipeline/diagnosis-pipeline.service";
import { PipelineResponse } from "./pipeline/types";

type DiagnosisResponse = {
  status: "NEED_MORE_INFO" | "DONE";
  ui?: {
    title?: string;
    summaryLargeText?: string;
    photoUrl?: string;
    referenceImageUrl?: string;
    audioUrl?: string;
    confidenceLabel?: string;
  };
  questions?: Array<Record<string, unknown>>;
  recommendation?: {
    possibleCause?: string;
    why?: string[];
    commonSymptoms?: string[];
    actionsToday?: string[];
    plan7Days?: string[];
    treatment?: string[];
    prevention?: string[];
    doNotDo?: string[];
    redFlags?: string[];
    questions?: string[];
    summaryText?: string;
    notes?: string[];
    products?: Array<Record<string, unknown>>;
    followUpPlan?: string;
  };
  recipe?: {
    probable?: string;
    confidenceText?: string;
    resumenAgricultor?: string;
    preguntasConfirmacion?: string[];
  };
  report?: { reportId?: string; createdAt?: string; version?: number };
  audit?: {
    confidence?: "LOW" | "MED" | "HIGH";
    sources?: Array<Record<string, unknown>>;
    modelVersion?: string;
    promptVersion?: string;
  };
};

@Injectable()
export class AiService {
  private followupUrl = process.env.N8N_FOLLOWUP_URL || "";
  private apiKey = process.env.N8N_API_KEY || "";
  private timeoutMs = Number(process.env.AI_TIMEOUT_MS || "30000");
  private mockEnabled = (process.env.MOCK_AI || "false").toLowerCase() === "true";

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly pipeline: DiagnosisPipelineService,
  ) {}

  async diagnose(userId: string, dto: AiDiagnosisDto): Promise<DiagnosisResponse> {
    const context = await this.resolveDiagnosisContext(dto);

    if (!context.crop) {
      return {
        status: "NEED_MORE_INFO",
        ui: {
          title: "Necesito mas datos",
          summaryLargeText: "Falta confirmar el cultivo para continuar el analisis.",
          confidenceLabel: "Media",
        },
        questions: [
          {
            id: "crop_confirm",
            type: "text",
            questionLarge: "Que cultivo estas analizando?",
            required: true,
          },
        ],
      };
    }

    const pipelineResult = await this.pipeline.run({
      dto,
      crop: context.crop,
      variety: context.variety,
      growthStage: context.growthStage,
      location: {
        countryCode: context.countryCode,
        region: context.region,
        lat: context.lat,
        lon: context.lon,
        accuracyM: context.accuracyM,
      },
    });

    return this.normalizePipelineDiagnosis(userId, dto, pipelineResult);
  }

  async followup(userId: string, dto: AiFollowupDto) {
    const report = await this.reports.get(userId, dto.reportId);
    if (!report) {
      throw new NotFoundException("Report not found");
    }

    await this.reports.appendMessage(dto.reportId, "user", dto.userMessage);

    const payload = {
      userId,
      reportId: dto.reportId,
      userMessage: dto.userMessage,
      newImageUrl: dto.newImageUrl,
      audioNoteUrl: dto.audioNoteUrl,
    };

    let response: any = null;
    if (!this.mockEnabled && this.followupUrl) {
      response = await this.postJson<any>(this.followupUrl, payload);
    }

    if (!response) {
      response = {
        assistantReply: "Recibi tu mensaje. Mantengo seguimiento y recomiendo comparar nuevas fotos en 48h.",
        newQuestions: [],
        updatedPlan: {},
        languageLevel: "simple_50plus",
      };
    }

    if (response?.assistantReply) {
      await this.reports.appendMessage(dto.reportId, "assistant", response.assistantReply);
    }

    if (response?.updatedPlan) {
      await this.reports.applyFollowupUpdate(dto.reportId, response.updatedPlan);
    }

    return response;
  }

  private async resolveDiagnosisContext(dto: AiDiagnosisDto) {
    const [crop, stage, zone] = await Promise.all([
      dto.cropId
        ? this.prisma.crop.findUnique({
            where: { id: dto.cropId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      dto.stageId
        ? this.prisma.cropStage.findUnique({
            where: { id: dto.stageId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      dto.location?.zoneId
        ? this.prisma.zone.findUnique({
            where: { id: dto.location.zoneId },
            select: { id: true, name: true, latitude: true, longitude: true },
          })
        : Promise.resolve(null),
    ]);

    const cropName = String(dto.crop || crop?.name || "").trim();
    const variety = String(dto.variety || "").trim() || null;
    const growthStage = String(dto.growthStage || stage?.name || "").trim() || null;

    const countryCodeRaw = String(dto.location?.countryCode || process.env.DEFAULT_COUNTRY_CODE || "PE")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCodeRaw)) {
      throw new BadRequestException("country_code debe ser ISO-2, por ejemplo PE.");
    }

    return {
      crop: cropName,
      variety,
      growthStage,
      countryCode: countryCodeRaw,
      region: String(dto.location?.region || zone?.name || "").trim() || null,
      lat: this.numberOrNull(dto.location?.lat) ?? this.numberOrNull(zone?.latitude),
      lon: this.numberOrNull(dto.location?.lon) ?? this.numberOrNull(zone?.longitude),
      accuracyM: this.numberOrNull(dto.location?.accuracyM),
    };
  }

  private async normalizePipelineDiagnosis(userId: string, dto: AiDiagnosisDto, pipeline: PipelineResponse): Promise<DiagnosisResponse> {
    const recipe = pipeline.block4_final.receta;
    const diagnosis = pipeline.block4_final.final_diagnosis;
    const audioNoteUrl = this.readAudioNoteUrl(dto.answers);

    const mediaPreview = this.pickPreviewUrl(dto);
    const referenceImageUrl =
      this.pickPlantNetReferenceImage(diagnosis.primary_candidate?.plantnet_images || []) ||
      this.pickPlantNetReferenceImage(pipeline.block1_candidates.candidates[0]?.plantnet_images || []);
    const reportImageUrl = this.pickReportImageUrl(dto, referenceImageUrl);
    const confidence = this.mapConfidenceFromFinal(diagnosis.confidence);
    const confidenceLabel = this.mapConfidenceLabel(confidence);

    const recommendation = {
      possibleCause: recipe.probable,
      why: recipe.detalles_receta.por_que,
      commonSymptoms: pipeline.block2_kindwise.symptoms || [],
      actionsToday: recipe.detalles_receta.acciones_inmediatas,
      plan7Days: recipe.detalles_receta.plan_7_dias,
      treatment: recipe.detalles_receta.tratamiento_recomendado,
      prevention: recipe.detalles_receta.prevencion,
      doNotDo: [] as string[],
      redFlags: recipe.detalles_receta.cuando_pedir_ayuda,
      questions: recipe.preguntas_confirmacion,
      summaryText: recipe.resumen_agricultor,
      notes: recipe.detalles_receta.notas,
      products: recipe.detalles_receta.tratamiento_recomendado.map((item) => ({
        type: "general",
        purpose: "Manejo recomendado",
        note: item,
      })),
      followUpPlan: recipe.detalles_receta.plan_7_dias.join(" "),
    };

    const createdReport = await this.reports.createFromAi(userId, {
      parcelId: dto.parcelId,
      cropId: dto.cropId,
      stageId: dto.stageId,
      zoneId: dto.location?.zoneId,
      imageUrl: reportImageUrl || "about:blank",
      audioUrl: audioNoteUrl,
      summary: recipe.resumen_agricultor || `Diagnostico probable: ${recipe.probable}`,
      actions: recipe.detalles_receta.acciones_inmediatas,
      prevention: recipe.detalles_receta.prevencion,
      doNotDo: [],
      redFlags: recipe.detalles_receta.cuando_pedir_ayuda,
      productsSuggested: recipe.detalles_receta.tratamiento_recomendado,
      confidence: this.mapReportConfidence(confidence),
      audit: {
        confidence,
        sources: [
          { name: "Pl@ntNet Diseases API" },
          { name: "EPPO Data Services" },
          { name: "Kindwise crop.health" },
          { name: "GBIF" },
        ],
        modelVersion: "pipeline-2026.02",
        promptVersion: "blocks-v1",
        recipe_source: "health_ai",
        reference_image_url: referenceImageUrl || undefined,
        technical_recipe_details: recipe.detalles_receta,
        pipeline,
      },
    });

    return {
      status: "DONE",
      ui: {
        title: "Diagnostico",
        summaryLargeText: recipe.resumen_agricultor,
        photoUrl: reportImageUrl || undefined,
        referenceImageUrl: referenceImageUrl || undefined,
        audioUrl: audioNoteUrl || undefined,
        confidenceLabel,
      },
      recommendation,
      recipe: {
        probable: recipe.probable,
        confidenceText: recipe.confidence_text,
        resumenAgricultor: recipe.resumen_agricultor,
        preguntasConfirmacion: recipe.preguntas_confirmacion,
      },
      report: {
        reportId: createdReport.id,
        createdAt: createdReport.createdAt.toISOString(),
        version: createdReport.version,
      },
      audit: {
        confidence,
        sources: [
          { name: "Pl@ntNet Diseases API" },
          { name: "EPPO Data Services" },
          { name: "Kindwise crop.health" },
          { name: "GBIF" },
        ],
        modelVersion: "pipeline-2026.02",
        promptVersion: "blocks-v1",
      },
    };
  }

  private pickPreviewUrl(dto: AiDiagnosisDto) {
    if (Array.isArray(dto.media.photos) && dto.media.photos.length) return dto.media.photos[0];
    return null;
  }

  private pickReportImageUrl(dto: AiDiagnosisDto, referenceImageUrl: string | null) {
    const photoPreview = this.pickPreviewUrl(dto);
    if (photoPreview && this.isLikelyImageUrl(photoPreview)) {
      return photoPreview;
    }
    if (referenceImageUrl && this.isLikelyImageUrl(referenceImageUrl)) {
      return referenceImageUrl;
    }
    return null;
  }

  private isLikelyImageUrl(value: string) {
    const raw = this.readString(value);
    if (!raw) return false;
    const withoutQuery = raw.split("?")[0].toLowerCase();
    if (withoutQuery.startsWith("about:blank")) return false;
    if (withoutQuery.endsWith(".mp4") || withoutQuery.endsWith(".mov") || withoutQuery.endsWith(".m4v")) return false;
    return true;
  }

  private pickPlantNetReferenceImage(images: Array<Record<string, unknown>>) {
    if (!Array.isArray(images) || !images.length) return null;

    for (const item of images) {
      if (!item || typeof item !== "object") continue;
      const directUrl = this.readString((item as any).url);
      if (directUrl) return directUrl;

      const urlBlock = (item as any).url;
      if (urlBlock && typeof urlBlock === "object") {
        const candidates = [urlBlock.o, urlBlock.m, urlBlock.s, urlBlock.l];
        for (const candidate of candidates) {
          const parsed = this.readString(candidate);
          if (parsed) return parsed;
        }
      }

      const nestedCandidates = [(item as any).imageUrl, (item as any).image_url, (item as any).link];
      for (const candidate of nestedCandidates) {
        const parsed = this.readString(candidate);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  private mapReportConfidence(value: "LOW" | "MED" | "HIGH"): ReportConfidence {
    if (value === "LOW") return "low";
    if (value === "HIGH") return "high";
    return "med";
  }

  private mapConfidenceFromFinal(value: "alta" | "media" | "baja"): "LOW" | "MED" | "HIGH" {
    if (value === "alta") return "HIGH";
    if (value === "baja") return "LOW";
    return "MED";
  }

  private mapConfidenceLabel(value: "LOW" | "MED" | "HIGH") {
    if (value === "LOW") return "Baja";
    if (value === "HIGH") return "Alta";
    return "Media";
  }

  private numberOrNull(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readString(value: unknown) {
    if (typeof value !== "string") return null;
    const parsed = value.trim();
    return parsed.length ? parsed : null;
  }

  private readAudioNoteUrl(answers?: Record<string, string>) {
    if (!answers || typeof answers !== "object") return null;
    const candidate = answers.audio_note_url || answers.audioNoteUrl;
    const parsed = this.readString(candidate);
    if (!parsed) return null;
    return /^https?:\/\//i.test(parsed) ? parsed : null;
  }

  private async postJson<T>(url: string, body: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`n8n error ${res.status}: ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
