import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { CropsService } from "./crops.service";

@Controller("crops")
export class CropsController {
  constructor(private readonly crops: CropsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.crops.list();
  }

  @Get(":cropId")
  @UseGuards(JwtAuthGuard)
  get(@Param("cropId") cropId: string) {
    return this.crops.get(cropId);
  }
}
