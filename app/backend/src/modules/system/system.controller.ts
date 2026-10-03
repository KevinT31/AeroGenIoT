import { Controller, Get, NotFoundException } from "@nestjs/common";
import { register, Registry } from "prom-client";

@Controller()
export class SystemController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }

  @Get("/metrics")
  async metrics() {
    if (process.env.ENABLE_PUBLIC_METRICS !== "true") {
      throw new NotFoundException();
    }
    return register.metrics();
  }
}
