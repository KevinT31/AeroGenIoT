import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AppEventDto } from "./dto.app-event";

@Injectable()
export class AppEventsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: AppEventDto) {
    const payload = this.sanitizePayload(dto.payload);
    await this.prisma.appEvent.create({
      data: {
        userId,
        event: dto.event,
        category: dto.category,
        deviceId: dto.deviceId,
        platform: dto.platform,
        appVersion: dto.appVersion,
        payload: payload as any,
      },
    });
    return { ok: true };
  }

  private sanitizePayload(payload: Record<string, unknown> | undefined) {
    if (!payload) return undefined;
    const json = JSON.stringify(payload);
    if (json.length > 4096) {
      throw new BadRequestException("Payload demasiado grande");
    }
    return payload;
  }
}
