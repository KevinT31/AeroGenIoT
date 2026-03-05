import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CropsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.crop.findMany({
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  get(cropId: string) {
    return this.prisma.crop.findUnique({
      where: { id: cropId },
      include: { stages: { orderBy: { order: "asc" } } },
    });
  }
}
