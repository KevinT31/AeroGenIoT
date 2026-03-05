import { Module } from "@nestjs/common";
import { ThresholdsController } from "./thresholds.controller";
import { ThresholdsService } from "./thresholds.service";

@Module({
  controllers: [ThresholdsController],
  providers: [ThresholdsService],
})
export class ThresholdsModule {}