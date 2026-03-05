import { Body, Controller, Put, UseGuards, Req } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdatePreferencesDto } from "./dto.update-preferences";
import { JwtAuthGuard } from "../common/jwt.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Put("preferences")
  @UseGuards(JwtAuthGuard)
  updatePreferences(@Req() req: any, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(req.user?.sub, dto);
  }
}