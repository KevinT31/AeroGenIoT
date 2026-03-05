import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { NearbyService } from "./nearby.service";

@Controller("nearby")
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}

  @Get("crops")
  @UseGuards(JwtAuthGuard)
  crops(@Query("zoneId") zoneId?: string, @Query("lat") lat?: string, @Query("lng") lng?: string, @Query("radius") radius?: string) {
    const latNum = lat ? Number(lat) : undefined;
    const lngNum = lng ? Number(lng) : undefined;
    const radiusNum = radius ? Number(radius) : undefined;
    return this.nearby.getNearbyCrops({ zoneId, lat: latNum, lng: lngNum, radius: radiusNum });
  }

  @Get("alerts")
  @UseGuards(JwtAuthGuard)
  alerts(@Query("zoneId") zoneId?: string) {
    return this.nearby.getNearbyCrops({ zoneId }).then((data) => ({ zone: data.zone, alerts: data.alerts }));
  }
}
