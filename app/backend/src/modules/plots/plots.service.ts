import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PlotCreateDto } from "./dto.plot-create";
import { PlotUpdateDto } from "./dto.plot-update";

@Injectable()
export class PlotsService {
  constructor(private prisma: PrismaService) {}

  list(userId: string, farmId: string) {
    return this.prisma.plot.findMany({ where: { farmId } });
  }

  create(userId: string, farmId: string, dto: PlotCreateDto) {
    return this.prisma.plot.create({ data: { farmId, ...dto } });
  }

  get(userId: string, plotId: string) {
    return this.prisma.plot.findFirst({ where: { id: plotId } });
  }

  update(userId: string, plotId: string, dto: PlotUpdateDto) {
    return this.prisma.plot.update({ where: { id: plotId }, data: { ...dto } });
  }

  remove(userId: string, plotId: string) {
    return this.prisma.plot.delete({ where: { id: plotId } });
  }
}