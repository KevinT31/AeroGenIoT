import { Module } from "@nestjs/common";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";
import { SourcesModule } from "../sources/sources.module";

@Module({
  imports: [SourcesModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
