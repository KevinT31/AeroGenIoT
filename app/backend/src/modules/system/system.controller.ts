import { Controller, Get } from "@nestjs/common";
import { register, Registry } from "prom-client";

@Controller()
export class SystemController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }

  @Get("/metrics")
  async metrics() {
    return register.metrics();
  }
}