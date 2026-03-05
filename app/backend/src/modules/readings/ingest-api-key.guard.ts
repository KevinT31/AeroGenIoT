import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class IngestApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(IngestApiKeyGuard.name);
  private warnedFallback = false;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const received = request.headers["x-api-key"];
    const envExpected = process.env.INGEST_API_KEY;
    const expected = envExpected || (process.env.NODE_ENV !== "production" ? "dev-ingest-key" : undefined);

    if (!envExpected && process.env.NODE_ENV !== "production" && !this.warnedFallback) {
      this.logger.warn("INGEST_API_KEY no configurada. Usando fallback local dev-ingest-key.");
      this.warnedFallback = true;
    }

    if (!expected) {
      throw new InternalServerErrorException("INGEST_API_KEY no configurada.");
    }

    if (!received || String(received) !== expected) {
      throw new UnauthorizedException("x-api-key invalida.");
    }

    return true;
  }
}
