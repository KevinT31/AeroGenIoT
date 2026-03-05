import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { mockLatestReading, mockRecommendation } from "../../mock/data";

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  list(farmId?: string, plotId?: string) {
    if (process.env.MOCK_DATA === "true") {
      return [];
    }
    return this.prisma.recommendation.findMany({
      where: {
        ...(farmId ? { reading: { farmId } } : {}),
        ...(plotId ? { reading: { plotId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  latest(farmId: string, plotId?: string) {
    if (process.env.MOCK_DATA === "true") {
      return null;
    }
    return this.prisma.recommendation.findFirst({
      where: { reading: { farmId, ...(plotId ? { plotId } : {}) } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createFromDecision(readingId: string, decision: any) {
    return this.prisma.recommendation.create({
      data: {
        readingId,
        cantidadAgua: decision.cantidad_agua ?? decision.cantidadAgua ?? 0,
        recomendarRiego: decision.recomendar_riego ?? decision.recomendarRiego ?? false,
        motivo: decision.motivo ?? null,
      },
    });
  }
}
