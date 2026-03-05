import { Injectable, Logger } from "@nestjs/common";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterPushDto } from "./dto.register";

@Injectable()
export class NotificationsService {
  private expo = new Expo();
  private logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async register(userId: string, dto: RegisterPushDto) {
    return this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: {
        platform: dto.platform,
        deviceId: dto.deviceId,
        userId,
      },
      create: {
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        userId,
      },
    });
  }

  async sendAlert(alert: any) {
    if (process.env.ENABLE_PUSH !== "true") return;
    const farm = await this.prisma.farm.findUnique({
      where: { id: alert.farmId },
      select: { ownerId: true, name: true },
    });
    if (!farm) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: farm.ownerId },
    });

    const messages: ExpoPushMessage[] = [];
    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.token)) continue;
      messages.push({
        to: t.token,
        title: "Alerta AeroGenIoT",
        body: `${alert.message} (${farm.name})`,
        data: { alertId: alert.id, farmId: alert.farmId, plotId: alert.plotId },
        sound: "default",
      });
    }

    if (!messages.length) return;
    await this.sendChunks(messages);
  }

  async sendTest(userId: string) {
    if (process.env.ENABLE_PUSH !== "true") return { ok: false };
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        title: "AeroGenIoT",
        body: "Notificacion de prueba",
        data: { type: "test" },
      }));

    if (!messages.length) return { ok: false };
    await this.sendChunks(messages);
    return { ok: true };
  }

  private async sendChunks(messages: ExpoPushMessage[]) {
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket) => {
          if (ticket.status === "error") {
            this.logger.warn(`Push error: ${ticket.message}`);
          }
        });
      } catch (err) {
        this.logger.error("Push send failed", err as any);
      }
    }
  }
}

