import { Module } from "@nestjs/common";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";
import { RecommendationsModule } from "../recommendations/recommendations.module";
import { AlertsModule } from "../alerts/alerts.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { IngestApiKeyGuard } from "./ingest-api-key.guard";
import { TelemetryTableService } from "./telemetry-table.service";

@Module({
  imports: [RecommendationsModule, AlertsModule, RealtimeModule],
  controllers: [ReadingsController],
  providers: [ReadingsService, IngestApiKeyGuard, TelemetryTableService],
  exports: [TelemetryTableService],
})
export class ReadingsModule {}
