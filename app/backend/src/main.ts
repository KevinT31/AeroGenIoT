import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { requestLogger } from "./modules/common/logger.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({ origin: "*", credentials: true });
  app.use(helmet());
  app.use(requestLogger);

  const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1/ai", aiLimiter);
  app.use("/api/v1", apiLimiter);

  const document = SwaggerModule.createDocument(app, {
    openapi: "3.0.3",
    info: { title: "AeroGenIoT API", version: "1.0.0" },
  });
  SwaggerModule.setup("/docs", app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, "0.0.0.0");
}

bootstrap();

