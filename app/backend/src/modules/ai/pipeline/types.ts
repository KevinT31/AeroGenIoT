export type OrganType = "leaf" | "flower" | "fruit" | "bark" | "stem" | "auto";
export type MediaType = "photo" | "video";
export type ConfidenceLevel = "alta" | "media" | "baja";
export type GeoSupport = true | false | "unknown";
export type OccurrenceLevel = "alto" | "medio" | "bajo" | "desconocido";

export interface CropContext {
  crop: string;
  variety?: string | null;
  growth_stage?: string | null;
}

export interface LocationContext {
  country_code: string;
  region?: string | null;
  lat?: number | null;
  lon?: number | null;
  accuracy_m?: number | null;
}

export interface QualityFlags {
  blurry: boolean;
  low_light: boolean;
  overexposed: boolean;
  quality_score: number;
}

export interface ImageItem {
  image_id: string;
  mime: string;
  bytes: number;
  sha256: string;
  uri: string;
  organ: OrganType;
  quality: QualityFlags;
}

export interface MediaWithinLimits {
  max_images_plantnet: boolean;
  max_total_size_plantnet: boolean;
}

export interface MediaBundle {
  type: MediaType;
  source_count: number;
  images: ImageItem[];
  total_bytes: number;
  within_limits: MediaWithinLimits;
  original_video_uri?: string | null;
  frames_extracted?: number | null;
}

export interface OrgansHintUi {
  user_selected: boolean;
  allowed_values: OrganType[];
}

export interface ChatContext {
  notes?: string | null;
  audio_note_url?: string | null;
  has_audio_note: boolean;
}

export interface InputBundle {
  request_id: string;
  timestamp: string;
  lang: string;
  crop_context: CropContext;
  location: LocationContext;
  media: MediaBundle;
  organs_hint_ui: OrgansHintUi;
  chat_context: ChatContext;
}

export interface Candidate {
  eppo_code: string;
  label: string;
  score_plantnet: number;
  taxonomy: Record<string, unknown>;
  hosts: string[];
  host_match: boolean | "unknown";
  scientific_name?: string | null;
  common_names: string[];
  category?: string | null;
  synonyms: string[];
  plantnet_images: Array<Record<string, unknown>>;
}

export interface Block1Output {
  candidates: Candidate[];
  dropped_below_threshold: number;
  plantnet_language?: string | null;
  plantnet_remaining_requests?: number | null;
  raw_plantnet?: Record<string, unknown>;
}

export interface KindwiseTopLabel {
  label: string;
  probability?: number | null;
}

export interface KindwiseResult {
  matched_candidate_eppo_code?: string | null;
  top_labels: KindwiseTopLabel[];
  score_kindwise?: number | null;
  symptoms: string[];
  severity?: string | null;
  treatment_text?: string | null;
  raw_kindwise?: Record<string, unknown>;
}

export interface GeoSignal {
  eppo_code?: string | null;
  geo_support: GeoSupport;
  occurrence_level: OccurrenceLevel;
  occurrence_count?: number | null;
  presence_in_country: boolean | "unknown";
  host_reported: boolean | "unknown";
  raw_gbif?: Record<string, unknown>;
  notes?: string | null;
}

export interface FinalDiagnosis {
  primary_candidate?: Candidate | null;
  alternatives: Candidate[];
  confidence: ConfidenceLevel;
  confidence_score: number;
  reasons: string[];
}

export interface RecipeDetails {
  por_que: string[];
  acciones_inmediatas: string[];
  plan_7_dias: string[];
  tratamiento_recomendado: string[];
  prevencion: string[];
  cuando_pedir_ayuda: string[];
  notas: string[];
}

export interface Recipe {
  probable: string;
  confidence_text: string;
  resumen_agricultor: string;
  preguntas_confirmacion: string[];
  detalles_receta: RecipeDetails;
}

export interface Block4Output {
  final_diagnosis: FinalDiagnosis;
  receta: Recipe;
}

export interface PipelineResponse {
  block0_input_bundle: InputBundle;
  block1_candidates: Block1Output;
  block2_kindwise: KindwiseResult;
  block3_geo_signal: GeoSignal;
  block4_final: Block4Output;
}
