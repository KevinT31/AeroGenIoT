import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { ZonesService } from "./zones.service";

@Controller("zones")
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.zones.list();
  }

  @Get(":zoneId")
  @UseGuards(JwtAuthGuard)
  get(@Param("zoneId") zoneId: string) {
    return this.zones.get(zoneId);
  }
}
