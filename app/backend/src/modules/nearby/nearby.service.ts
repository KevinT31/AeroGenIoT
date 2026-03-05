import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SenasaConnector } from "../sources/senasa.connector";
import { SenamhiConnector } from "../sources/senamhi.connector";

type ZoneLite = { id: string; name: string; latitude: number | null; longitude: number | null };

@Injectable()
export class NearbyService {
  constructor(private prisma: PrismaService, private senasa: SenasaConnector, private senamhi: SenamhiConnector) {}

  async getNearbyCrops(params: { zoneId?: string; lat?: number; lng?: number; radius?: number }) {
    const zone = params.zoneId
      ? await this.prisma.zone.findUnique({ where: { id: params.zoneId } })
      : await this.findNearestZone(params.lat, params.lng, params.radius);

    if (!zone) {
      return { zone: null, topCrops: [], lastUpdated: null, alerts: [] };
    }

    const aggregates = await this.prisma.nearbyAggregate.findMany({
      where: { zoneId: zone.id },
      include: { crop: true },
      orderBy: { count: "desc" },
      take: 5,
    });

    const lastUpdated = aggregates.reduce<Date | null>((acc, item) => {
      if (!acc || item.lastUpdated > acc) return item.lastUpdated;
      return acc;
    }, null);

    const [senasaAlerts, senamhiAlerts] = await Promise.all([
      this.senasa.getAlerts(zone.id, zone.name),
      this.senamhi.getAlerts(zone.id, zone.name),
    ]);

    return {
      zone,
      topCrops: aggregates.map((item) => ({
        cropId: item.cropId,
        cropName: item.crop?.name || "Cultivo",
        count: item.count,
      })),
      lastUpdated,
      alerts: [...(senasaAlerts || []), ...(senamhiAlerts || [])],
    };
  }

  private async findNearestZone(lat?: number, lng?: number, radius = 30) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const zones = await this.prisma.zone.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    let nearest: ZoneLite | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const zone of zones) {
      if (zone.latitude === null || zone.longitude === null) continue;
      const distance = this.haversine(lat as number, lng as number, zone.latitude, zone.longitude);
      if (distance < best) {
        best = distance;
        nearest = zone;
      }
    }

    if (nearest && best <= radius) {
      return this.prisma.zone.findUnique({ where: { id: nearest.id } });
    }
    return null;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
