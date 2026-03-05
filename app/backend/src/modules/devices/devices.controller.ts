import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { DevicesService } from "./devices.service";
import { DeviceCreateDto } from "./dto.device-create";
import { DeviceUpdateDto } from "./dto.device-update";
import { DeviceAssignDto } from "./dto.device-assign";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.devices.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: DeviceCreateDto) {
    return this.devices.create(dto);
  }

  @Get(":deviceId")
  @UseGuards(JwtAuthGuard)
  get(@Param("deviceId") deviceId: string) {
    return this.devices.get(deviceId);
  }

  @Put(":deviceId")
  @UseGuards(JwtAuthGuard)
  update(@Param("deviceId") deviceId: string, @Body() dto: DeviceUpdateDto) {
    return this.devices.update(deviceId, dto);
  }

  @Post(":deviceId/assign")
  @UseGuards(JwtAuthGuard)
  assign(@Param("deviceId") deviceId: string, @Body() dto: DeviceAssignDto) {
    return this.devices.assign(deviceId, dto);
  }
}