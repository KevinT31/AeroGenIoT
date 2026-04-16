import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportConfidence } from "@prisma/client";

type ReportCreateInput = {
  parcelId?: string;
  cropId?: string;
  stageId?: string;
  zoneId?: string;
  imageUrl: string;
  audioUrl?: string | null;
  summary: string;
  actions: string[];
  prevention: string[];
  doNotDo: string[];
  redFlags: string[];
  productsSuggested?: any;
  confidence?: ReportConfidence;
  audit?: any;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, filters: { parcelId?: string; cropId?: string; status?: string }) {
    const reports = await this.prisma.report.findMany({
      where: {
        userId,
        ...(filters.parcelId ? { parcelId: filters.parcelId } : {}),
        ...(filters.cropId ? { cropId: filters.cropId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        parcel: true,
        crop: true,
        stage: true,
        zone: true,
      },
    });

    return reports.map((report) => this.normalizeReport(report));
  }

  async get(userId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      include: {
        parcel: true,
        crop: true,
        stage: true,
        zone: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return report ? this.normalizeReport(report) : null;
  }

  async feedback(userId: string, reportId: string, value: string) {
    const existing = await this.prisma.report.findFirst({ where: { id: reportId, userId } });
    if (!existing) return null;
    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        feedback: value,
        status: "closed",
      },
    });
  }

  createFromAi(userId: string, input: ReportCreateInput) {
    return this.prisma.report.create({
      data: {
        userId,
        parcelId: input.parcelId,
        cropId: input.cropId,
        stageId: input.stageId,
        zoneId: input.zoneId,
        imageUrl: input.imageUrl,
        audioUrl: input.audioUrl,
        summary: input.summary,
        actions: input.actions,
        prevention: input.prevention,
        doNotDo: input.doNotDo,
        redFlags: input.redFlags,
        productsSuggested: input.productsSuggested ?? undefined,
        confidence: input.confidence ?? "med",
        audit: input.audit ?? undefined,
      },
    });
  }

  appendMessage(reportId: string, role: "user" | "assistant", content: string) {
    return this.prisma.reportMessage.create({
      data: { reportId, role, content },
    });
  }

  async applyFollowupUpdate(reportId: string, updatedPlan: any) {
    const data: Record<string, any> = {};
    if (updatedPlan?.summary) data.summary = updatedPlan.summary;
    if (Array.isArray(updatedPlan?.actions)) data.actions = updatedPlan.actions;
    if (Array.isArray(updatedPlan?.prevention)) data.prevention = updatedPlan.prevention;
    if (Array.isArray(updatedPlan?.doNotDo)) data.doNotDo = updatedPlan.doNotDo;
    if (Array.isArray(updatedPlan?.redFlags)) data.redFlags = updatedPlan.redFlags;

    if (!Object.keys(data).length) {
      return null;
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  private normalizeReport<T extends Record<string, any>>(report: T) {
    return {
      ...report,
      actions: this.toStringArray(report.actions),
      prevention: this.toStringArray(report.prevention),
      doNotDo: this.toStringArray(report.doNotDo),
      redFlags: this.toStringArray(report.redFlags),
    };
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }
}
