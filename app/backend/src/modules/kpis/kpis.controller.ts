import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { AdminGuard } from "../common/admin.guard";
import { KpisService } from "./kpis.service";

@Controller("kpis")
export class KpisController {
  constructor(private readonly kpis: KpisService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  getKpis() {
    return this.kpis.getKpis();
  }
}
