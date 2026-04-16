import { Module } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TelemetryTableService } from "../readings/telemetry-table.service";

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [AlertsController],
  providers: [AlertsService, TelemetryTableService],
  exports: [AlertsService],
})
export class AlertsModule {}
