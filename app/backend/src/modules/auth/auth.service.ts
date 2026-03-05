import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes, createHash } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto.register";
import { LoginDto } from "./dto.login";

const REFRESH_DAYS = 30;
const googleClient = new OAuth2Client();

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    try {
      const hash = await bcrypt.hash(dto.password, 10);
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash: hash, name: dto.name, authProvider: "password" },
      });
      return this._issueTokens(user.id, user.email);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          if (process.env.MOCK_DATA === "true") {
            const hash = await bcrypt.hash(dto.password, 10);
            const user = await this.prisma.user.update({
              where: { email: dto.email },
              data: { passwordHash: hash, name: dto.name },
            });
            return this._issueTokens(user.id, user.email);
          }
          throw new ConflictException("El correo ya esta registrado");
        }
        if (err.code === "P2021") {
          throw new ServiceUnavailableException("Base de datos no inicializada");
        }
      }
      if (err instanceof Prisma.PrismaClientInitializationError) {
        throw new ServiceUnavailableException("No se pudo conectar a la base de datos");
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException();
    if (!user.passwordHash) {
      throw new UnauthorizedException("Esta cuenta usa Google. Inicia sesion con Gmail.");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException();
    return this._issueTokens(user.id, user.email);
  }

  async loginWithGoogle(idToken: string) {
    const audiences = (process.env.GOOGLE_CLIENT_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (audiences.length === 0) {
      throw new ServiceUnavailableException("Google OAuth no configurado");
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("Token de Google invalido");
    }

    if (!payload?.email || !payload?.sub) {
      throw new UnauthorizedException("Token de Google incompleto");
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedException("Email de Google no verificado");
    }

    const email = payload.email;
    const name = payload.name || payload.given_name || email.split("@")[0];

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleSub: payload.sub }, { email }],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleSub: payload.sub,
          authProvider: "google",
        },
      });
    } else {
      if (user.googleSub && user.googleSub !== payload.sub) {
        throw new UnauthorizedException("Cuenta Google no coincide con este usuario");
      }
      if (!user.googleSub || user.authProvider !== "google") {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: payload.sub,
            authProvider: "google",
            name: user.name || name,
          },
        });
      }
    }

    return this._issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!token || token.revoked || token.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }
    await this.prisma.refreshToken.update({ where: { tokenHash }, data: { revoked: true } });
    const user = await this.prisma.user.findUnique({ where: { id: token.userId } });
    if (!user) throw new UnauthorizedException();
    return this._issueTokens(user.id, user.email);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
    return { ok: true };
  }

  private async _issueTokens(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const accessToken = this.jwt.sign({ sub: userId, email, role: user?.role || "viewer" });
    const refreshToken = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken, user: { id: userId, email } };
  }
}
