import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePreferencesDto } from "./dto.update-preferences";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const existing = current?.preferences && typeof current.preferences === "object" && !Array.isArray(current.preferences)
      ? (current.preferences as Record<string, unknown>)
      : {};
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences: { ...existing, ...(dto as any) } },
    });
  }
}
