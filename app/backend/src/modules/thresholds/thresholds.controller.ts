import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { ThresholdsService } from "./thresholds.service";
import { ThresholdDto } from "./dto.threshold";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("thresholds")
export class ThresholdsController {
  constructor(private readonly thresholds: ThresholdsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  get(@Query("farmId") farmId: string, @Query("plotId") plotId?: string) {
    return this.thresholds.get(farmId, plotId);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  update(@Body() dto: ThresholdDto) {
    return this.thresholds.update(dto);
  }
}