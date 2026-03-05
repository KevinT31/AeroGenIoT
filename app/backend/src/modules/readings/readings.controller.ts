import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ReadingsService } from "./readings.service";
import { JwtAuthGuard } from "../common/jwt.guard";
import { IngestReadingDto } from "./dto.ingest";
import { IngestApiKeyGuard } from "./ingest-api-key.guard";

@Controller("readings")
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query("farmId") farmId?: string, @Query("plotId") plotId?: string) {
    return this.readings.list(farmId, plotId);
  }

  @Get("latest")
  latest(@Query("deviceId") deviceId: string) {
    return this.readings.latest(deviceId);
  }

  @Post("ingest")
  @UseGuards(IngestApiKeyGuard)
  ingest(@Body() dto: IngestReadingDto) {
    return this.readings.ingest(dto);
  }
}
