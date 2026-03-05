import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { AdminGuard } from "../common/admin.guard";
import { AdminService } from "./admin.service";
import { AdminCropDto } from "./dto.admin-crop";
import { AdminStageDto } from "./dto.admin-stage";
import { AdminZoneDto } from "./dto.admin-zone";
import { AdminMarketPriceDto } from "./dto.admin-market-price";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post("crops")
  @UseGuards(JwtAuthGuard, AdminGuard)
  createCrop(@Body() dto: AdminCropDto) {
    return this.admin.createCrop(dto.name);
  }

  @Post("crops/:cropId/stages")
  @UseGuards(JwtAuthGuard, AdminGuard)
  createStage(@Param("cropId") cropId: string, @Body() dto: AdminStageDto) {
    return this.admin.createStage(cropId, dto.name, dto.order);
  }

  @Post("zones")
  @UseGuards(JwtAuthGuard, AdminGuard)
  createZone(@Body() dto: AdminZoneDto) {
    return this.admin.createZone(dto);
  }

  @Post("market/prices")
  @UseGuards(JwtAuthGuard, AdminGuard)
  createMarketPrice(@Body() dto: AdminMarketPriceDto) {
    return this.admin.createMarketPrice(dto);
  }
}
