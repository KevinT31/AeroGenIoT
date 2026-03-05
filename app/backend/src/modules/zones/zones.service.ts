import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.zone.findMany({ orderBy: { name: "asc" } });
  }

  get(zoneId: string) {
    return this.prisma.zone.findUnique({ where: { id: zoneId } });
  }
}
