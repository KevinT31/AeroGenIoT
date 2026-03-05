import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DeviceCreateDto } from "./dto.device-create";
import { DeviceUpdateDto } from "./dto.device-update";
import { DeviceAssignDto } from "./dto.device-assign";

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.device.findMany();
  }

  create(dto: DeviceCreateDto) {
    return this.prisma.device.create({ data: { ...dto } });
  }

  get(deviceId: string) {
    return this.prisma.device.findUnique({ where: { id: deviceId } });
  }

  update(deviceId: string, dto: DeviceUpdateDto) {
    return this.prisma.device.update({ where: { id: deviceId }, data: { ...dto } });
  }

  assign(deviceId: string, dto: DeviceAssignDto) {
    return this.prisma.device.update({ where: { id: deviceId }, data: { ...dto } });
  }
}