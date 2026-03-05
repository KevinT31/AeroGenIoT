import { Module } from "@nestjs/common";
import { NearbyController } from "./nearby.controller";
import { NearbyService } from "./nearby.service";
import { SourcesModule } from "../sources/sources.module";

@Module({
  imports: [SourcesModule],
  controllers: [NearbyController],
  providers: [NearbyService],
})
export class NearbyModule {}
