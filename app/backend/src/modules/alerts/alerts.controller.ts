import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get("recent")
  recent(@Query("deviceId") deviceId: string) {
    return this.alerts.recentByDevice(deviceId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query("farmId") farmId?: string, @Query("status") status?: string) {
    return this.alerts.list(farmId, status);
  }

  @Post(":alertId/ack")
  ack(@Param("alertId") alertId: string) {
    return this.alerts.ack(alertId);
  }

  @Post(":alertId/resolve")
  @UseGuards(JwtAuthGuard)
  resolve(@Param("alertId") alertId: string) {
    return this.alerts.resolve(alertId);
  }
}
