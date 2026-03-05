import { Module } from "@nestjs/common";
import { SourcesService } from "./sources.service";
import { SenasaConnector } from "./senasa.connector";
import { MidagriConnector } from "./midagri.connector";
import { SenamhiConnector } from "./senamhi.connector";

@Module({
  providers: [SourcesService, SenasaConnector, MidagriConnector, SenamhiConnector],
  exports: [SourcesService, SenasaConnector, MidagriConnector, SenamhiConnector],
})
export class SourcesModule {}
