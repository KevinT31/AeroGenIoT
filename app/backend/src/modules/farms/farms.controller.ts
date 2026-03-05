import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { FarmsService } from "./farms.service";
import { FarmCreateDto } from "./dto.farm-create";
import { FarmUpdateDto } from "./dto.farm-update";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("farms")
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any) {
    return this.farms.list(req.user?.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: FarmCreateDto) {
    return this.farms.create(req.user?.sub, dto);
  }

  @Get(":farmId")
  @UseGuards(JwtAuthGuard)
  get(@Req() req: any, @Param("farmId") farmId: string) {
    return this.farms.get(req.user?.sub, farmId);
  }

  @Put(":farmId")
  @UseGuards(JwtAuthGuard)
  update(@Req() req: any, @Param("farmId") farmId: string, @Body() dto: FarmUpdateDto) {
    return this.farms.update(req.user?.sub, farmId, dto);
  }

  @Delete(":farmId")
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param("farmId") farmId: string) {
    return this.farms.remove(req.user?.sub, farmId);
  }
}