import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/jwt.guard";
import { MeService } from "./me.service";

@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get("bootstrap")
  @UseGuards(JwtAuthGuard)
  bootstrap(@Req() req: any, @Query("userId") _userId?: string) {
    return this.me.bootstrap(req.user?.sub);
  }
}

