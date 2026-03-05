import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.AUDIT_LOG !== "true") {
      return next.handle();
    }

    if (context.getType() !== "http") {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const path = req?.originalUrl || req?.url || "";

    if (path.startsWith("/metrics") || path.startsWith("/health") || path.startsWith("/docs")) {
      return next.handle();
    }

    const method = req?.method || "UNKNOWN";
    const userId = req?.user?.sub ?? null;
    const ip = req?.ip ?? null;
    const userAgent = req?.headers?.["user-agent"] ?? null;

    return next.handle().pipe(
      finalize(() => {
        const status = res?.statusCode ?? 0;
        try {
          void this.prisma.auditLog.create({
            data: {
              userId,
              action: `${method} ${path}`,
              path,
              method,
              status,
              ip,
              userAgent,
            },
          });
        } catch {
          // audit logging should never break requests
        }
      })
    );
  }
}
