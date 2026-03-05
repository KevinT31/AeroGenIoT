import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RecommendationsService } from "./recommendations.service";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recs: RecommendationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query("farmId") farmId?: string, @Query("plotId") plotId?: string) {
    return this.recs.list(farmId, plotId);
  }

  @Get("latest")
  @UseGuards(JwtAuthGuard)
  latest(@Query("farmId") farmId: string, @Query("plotId") plotId?: string) {
    return this.recs.latest(farmId, plotId);
  }
}