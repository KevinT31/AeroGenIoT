import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { requestLogger } from "./modules/common/logger.middleware";

const parseCorsOrigins = () => {
  const raw = String(process.env.CORS_ORIGINS || "").trim();
  if (!raw) {
    return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, "https://auroranoctua2026.lat"];
  }
  if (raw === "*") return true;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseTrustProxy = () => {
  const raw = String(process.env.TRUST_PROXY || "loopback,linklocal,uniquelocal").trim();
  if (!raw || raw.toLowerCase() === "false") return false;
  if (raw.toLowerCase() === "true") return true;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const trustProxy = parseTrustProxy();
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set("trust proxy", trustProxy);
  }
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({ origin: parseCorsOrigins(), credentials: true });
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: process.env.ENABLE_SWAGGER === "true" ? false : undefined,
    }),
  );
  app.use(requestLogger);

  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || "20"),
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX || "180"),
  });
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.AI_RATE_LIMIT_MAX || "10"),
  });
  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1/ai/diagnosis", aiLimiter);
  app.use("/api/v1/ai/followup", aiLimiter);
  app.use("/api/v1", apiLimiter);

  if (process.env.ENABLE_SWAGGER === "true") {
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.3",
      info: { title: "AeroGenIoT API", version: "1.0.0" },
    });
    SwaggerModule.setup("/docs", app, document);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, "0.0.0.0");
}

bootstrap();

