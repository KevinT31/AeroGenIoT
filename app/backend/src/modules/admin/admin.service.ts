import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  createCrop(name: string) {
    return this.prisma.crop.create({ data: { name } });
  }

  createStage(cropId: string, name: string, order?: number) {
    return this.prisma.cropStage.create({ data: { cropId, name, order } });
  }

  createZone(data: { name: string; type: string; latitude?: number; longitude?: number }) {
    return this.prisma.zone.create({ data });
  }

  createMarketPrice(data: { cropId: string; zoneId: string; date: string; priceMin: number; priceMax: number; source: string }) {
    return this.prisma.marketPrice.create({
      data: {
        cropId: data.cropId,
        zoneId: data.zoneId,
        date: new Date(data.date),
        priceMin: data.priceMin,
        priceMax: data.priceMax,
        source: data.source,
      },
    });
  }
}
