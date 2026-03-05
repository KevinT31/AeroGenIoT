import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { PlotsService } from "./plots.service";
import { PlotCreateDto } from "./dto.plot-create";
import { PlotUpdateDto } from "./dto.plot-update";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller()
export class PlotsController {
  constructor(private readonly plots: PlotsService) {}

  @Get("/farms/:farmId/plots")
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any, @Param("farmId") farmId: string) {
    return this.plots.list(req.user?.sub, farmId);
  }

  @Post("/farms/:farmId/plots")
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Param("farmId") farmId: string, @Body() dto: PlotCreateDto) {
    return this.plots.create(req.user?.sub, farmId, dto);
  }

  @Get("/plots/:plotId")
  @UseGuards(JwtAuthGuard)
  get(@Req() req: any, @Param("plotId") plotId: string) {
    return this.plots.get(req.user?.sub, plotId);
  }

  @Put("/plots/:plotId")
  @UseGuards(JwtAuthGuard)
  update(@Req() req: any, @Param("plotId") plotId: string, @Body() dto: PlotUpdateDto) {
    return this.plots.update(req.user?.sub, plotId, dto);
  }

  @Delete("/plots/:plotId")
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param("plotId") plotId: string) {
    return this.plots.remove(req.user?.sub, plotId);
  }
}