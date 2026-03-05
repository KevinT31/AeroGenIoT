import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MidagriConnector } from "../sources/midagri.connector";

type Trend = "up" | "down" | "stable";

@Injectable()
export class MarketService {
  constructor(private prisma: PrismaService, private midagri: MidagriConnector) {}

  async getPrices(cropId?: string, zoneId?: string) {
    if (cropId && zoneId) {
      const [crop, zone] = await Promise.all([
        this.prisma.crop.findUnique({ where: { id: cropId } }),
        this.prisma.zone.findUnique({ where: { id: zoneId } }),
      ]);
      const cropLabel = crop?.name || cropId;
      const zoneLabel = zone?.name || zoneId;
      const external = await this.midagri.getPrices(cropLabel, zoneLabel);
      if (external.length) {
        await this.prisma.marketPrice.createMany({
          data: external.map((item) => ({
            cropId,
            zoneId,
            date: new Date(item.date),
            priceMin: Number(item.priceMin),
            priceMax: Number(item.priceMax),
            source: item.source || "MIDAGRI",
          })),
          skipDuplicates: true,
        });
      }
    }

    const prices = await this.prisma.marketPrice.findMany({
      where: {
        ...(cropId ? { cropId } : {}),
        ...(zoneId ? { zoneId } : {}),
      },
      orderBy: { date: "asc" },
    });

    const series = prices.map((p) => ({
      date: p.date,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      source: p.source,
    }));

    const trend = this.computeTrend(series);
    const projection = this.computeProjection(series);

    return {
      cropId,
      zoneId,
      series,
      trend,
      projection,
      disclaimer: "Estimacion, puede variar",
    };
  }

  private computeTrend(series: { priceMin: number; priceMax: number }[]): Trend {
    if (series.length < 2) return "stable";
    const mid = (item: { priceMin: number; priceMax: number }) => (item.priceMin + item.priceMax) / 2;
    const tail = series.slice(-3);
    const prev = series.slice(-6, -3);
    const avg = (arr: typeof series) => arr.reduce((acc, v) => acc + mid(v), 0) / Math.max(1, arr.length);
    const tailAvg = avg(tail);
    const prevAvg = avg(prev.length ? prev : series.slice(0, Math.max(1, series.length - 3)));
    if (!Number.isFinite(tailAvg) || !Number.isFinite(prevAvg) || prevAvg === 0) return "stable";
    const diff = (tailAvg - prevAvg) / prevAvg;
    if (diff > 0.05) return "up";
    if (diff < -0.05) return "down";
    return "stable";
  }

  private computeProjection(series: { priceMin: number; priceMax: number }[]) {
    if (!series.length) return { min: null, max: null, window: "30d" };
    const recent = series.slice(-30);
    const min = Math.min(...recent.map((s) => s.priceMin));
    const max = Math.max(...recent.map((s) => s.priceMax));
    return {
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
      window: "30d",
    };
  }
}
