import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePreferencesDto } from "./dto.update-preferences";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences: dto as any },
    });
  }
}