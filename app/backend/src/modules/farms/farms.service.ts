import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmCreateDto } from "./dto.farm-create";
import { FarmUpdateDto } from "./dto.farm-update";

@Injectable()
export class FarmsService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.farm.findMany({ where: { ownerId: userId } });
  }

  create(userId: string, dto: FarmCreateDto) {
    return this.prisma.farm.create({ data: { ownerId: userId, ...dto } });
  }

  get(userId: string, farmId: string) {
    return this.prisma.farm.findFirst({ where: { id: farmId, ownerId: userId } });
  }

  update(userId: string, farmId: string, dto: FarmUpdateDto) {
    return this.prisma.farm.update({ where: { id: farmId }, data: { ...dto } });
  }

  remove(userId: string, farmId: string) {
    return this.prisma.farm.delete({ where: { id: farmId } });
  }
}