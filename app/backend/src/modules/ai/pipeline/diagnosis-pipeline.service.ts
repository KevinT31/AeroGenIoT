import { Injectable } from "@nestjs/common";
import { AiDiagnosisDto } from "../dto.ai-diagnosis";
import { AiFusionService } from "./fusion.service";
import { AiGbifService } from "./gbif.service";
import { AiKindwiseService } from "./kindwise.service";
import { AiMediaPreprocessorService } from "./media-preprocessor.service";
import { AiPlantNetService } from "./plantnet.service";
import { PipelineResponse } from "./types";

type RunPipelineParams = {
  dto: AiDiagnosisDto;
  crop: string;
  variety?: string | null;
  growthStage?: string | null;
  location: {
    countryCode: string;
    region?: string | null;
    lat?: number | null;
    lon?: number | null;
    accuracyM?: number | null;
  };
};

@Injectable()
export class DiagnosisPipelineService {
  constructor(
    private readonly mediaPreprocessor: AiMediaPreprocessorService,
    private readonly plantNet: AiPlantNetService,
    private readonly kindwise: AiKindwiseService,
    private readonly gbif: AiGbifService,
    private readonly fusion: AiFusionService,
  ) {}

  async run(params: RunPipelineParams): Promise<PipelineResponse> {
    const block0 = await this.mediaPreprocessor.buildInputBundle({
      dto: params.dto,
      crop: params.crop,
      variety: params.variety,
      growthStage: params.growthStage,
      location: params.location,
    });

    const block1 = await this.plantNet.run(block0);
    const block2 = await this.kindwise.run(block0, block1.candidates);
    const block3 = await this.gbif.run(block0, block1.candidates, block2);
    const block4 = await this.fusion.run(block0, block1.candidates, block2, block3);

    return {
      block0_input_bundle: block0,
      block1_candidates: block1,
      block2_kindwise: block2,
      block3_geo_signal: block3,
      block4_final: block4,
    };
  }
}
