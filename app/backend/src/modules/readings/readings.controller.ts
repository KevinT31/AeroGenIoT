import { createHash } from "crypto";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ReadingsService } from "./readings.service";
import { JwtAuthGuard } from "../common/jwt.guard";
import { IngestReadingDto } from "./dto.ingest";
import { IngestApiKeyGuard } from "./ingest-api-key.guard";

@Controller("readings")
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query("deviceId") deviceId?: string, @Query("farmId") farmId?: string, @Query("plotId") plotId?: string) {
    return this.readings.list(deviceId, farmId, plotId);
  }

  @Get("latest")
  latest(@Query("deviceId") deviceId: string) {
    return this.readings.latest(deviceId);
  }

  @Post("ingest")
  @UseGuards(IngestApiKeyGuard)
  ingest(@Body() dto: IngestReadingDto) {
    return this.readings.ingest(dto);
  }

  @Post("iotda/property-push")
  @HttpCode(200)
  async ingestIotdaPropertyPush(
    @Body() payload: unknown,
    @Headers("timestamp") timestamp?: string,
    @Headers("nonce") nonce?: string,
    @Headers("signature") signature?: string,
  ) {
    this.verifyIotdaSignature({ timestamp, nonce, signature });
    const result = await this.readings.ingestIotdaPropertyPush(payload);
    return {
      status: "accepted",
      bridge: "iotda-http-push",
      readingId: result.readingId ?? null,
      alertsCreated: result.alertsCreated ?? 0,
    };
  }

  private verifyIotdaSignature(input: {
    timestamp?: string;
    nonce?: string;
    signature?: string;
  }) {
    const token = String(process.env.IOTDA_HTTP_PUSH_TOKEN || "").trim();
    if (!token) return;

    if (!input.timestamp || !input.nonce || !input.signature) {
      throw new UnauthorizedException("Faltan headers de firma de IoTDA.");
    }

    const maxSkewMs = Number(process.env.IOTDA_HTTP_PUSH_MAX_SKEW_MS || "600000");
    const timestampMs = Number(input.timestamp);
    if (Number.isFinite(timestampMs) && Math.abs(Date.now() - timestampMs) > maxSkewMs) {
      throw new UnauthorizedException("Timestamp de IoTDA fuera de ventana permitida.");
    }

    const parts = [token, input.timestamp, input.nonce].sort();
    const expected = createHash("sha256").update(parts.join(""), "utf8").digest("hex");

    if (expected.toLowerCase() !== String(input.signature).trim().toLowerCase()) {
      throw new UnauthorizedException("Firma de IoTDA invalida.");
    }
  }
}
