import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ReportsModule } from "../reports/reports.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AiEppoService } from "./pipeline/eppo.service";
import { AiFusionService } from "./pipeline/fusion.service";
import { AiGbifService } from "./pipeline/gbif.service";
import { AiKindwiseService } from "./pipeline/kindwise.service";
import { AiLlmRecipeService } from "./pipeline/llm-recipe.service";
import { AiMediaPreprocessorService } from "./pipeline/media-preprocessor.service";
import { DiagnosisPipelineService } from "./pipeline/diagnosis-pipeline.service";
import { AiPlantNetService } from "./pipeline/plantnet.service";

@Module({
  imports: [ReportsModule, PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    DiagnosisPipelineService,
    AiMediaPreprocessorService,
    AiPlantNetService,
    AiEppoService,
    AiKindwiseService,
    AiGbifService,
    AiLlmRecipeService,
    AiFusionService,
  ],
})
export class AiModule {}
