import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { MarketService } from "./market.service";

@Controller("market")
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get("prices")
  @UseGuards(JwtAuthGuard)
  getPrices(@Query("crop") cropId?: string, @Query("zone") zoneId?: string) {
    return this.market.getPrices(cropId, zoneId);
  }
}
