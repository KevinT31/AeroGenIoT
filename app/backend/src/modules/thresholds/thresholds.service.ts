import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ThresholdDto } from "./dto.threshold";

@Injectable()
export class ThresholdsService {
  constructor(private prisma: PrismaService) {}

  get(farmId: string, plotId?: string) {
    return this.prisma.thresholdProfile.findFirst({
      where: { farmId, ...(plotId ? { plotId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(dto: ThresholdDto) {
    const last = await this.prisma.thresholdProfile.findFirst({
      where: { farmId: dto.farmId, ...(dto.plotId ? { plotId: dto.plotId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const version = last ? last.version + 1 : 1;
    return this.prisma.thresholdProfile.create({ data: { ...dto, version } });
  }
}