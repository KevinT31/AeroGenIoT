import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class KpisService {
  constructor(private prisma: PrismaService) {}

  async getKpis() {
    const totalReports = await this.prisma.report.count();
    const last7dReports = await this.prisma.report.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    const feedbackGroups = await this.prisma.report.groupBy({
      by: ["feedback"],
      _count: true,
      where: { feedback: { not: null } },
    });

    const feedbackTotals = feedbackGroups.reduce(
      (acc, item) => {
        const key = item.feedback || "none";
        acc[key] = item._count;
        acc.total += item._count;
        return acc;
      },
      { total: 0, mejoro: 0, igual: 0, empeoro: 0, none: 0 } as Record<string, number>
    );

    const improvedPct =
      feedbackTotals.total > 0 ? Math.round((feedbackTotals.mejoro / feedbackTotals.total) * 100) : 0;

    const topCropCounts = await this.prisma.report.groupBy({
      by: ["cropId"],
      _count: { cropId: true },
      orderBy: { _count: { cropId: "desc" } },
      take: 5,
    });

    const cropIds = topCropCounts.map((item) => item.cropId).filter(Boolean) as string[];
    const crops = cropIds.length
      ? await this.prisma.crop.findMany({ where: { id: { in: cropIds } } })
      : [];

    const cropMap = new Map(crops.map((crop) => [crop.id, crop.name]));

    const closedReports = await this.prisma.report.findMany({
      where: { status: "closed" },
      select: { createdAt: true, updatedAt: true },
    });
    const avgResolutionDays =
      closedReports.length > 0
        ? Math.round(
            (closedReports.reduce((acc, r) => acc + (r.updatedAt.getTime() - r.createdAt.getTime()), 0) /
              closedReports.length /
              (1000 * 60 * 60 * 24)) * 10
          ) / 10
        : null;

    return {
      totalReports,
      last7dReports,
      avgResolutionDays,
      feedback: {
        total: feedbackTotals.total,
        improvedPct,
        improvedCount: feedbackTotals.mejoro,
        sameCount: feedbackTotals.igual,
        worseCount: feedbackTotals.empeoro,
      },
      topCrops: topCropCounts.map((item) => ({
        cropId: item.cropId,
        name: item.cropId ? cropMap.get(item.cropId) : null,
        count: item._count.cropId,
      })),
    };
  }
}
