import { Injectable } from "@nestjs/common";
import { mean } from "./math.utils";
import { AiLlmRecipeService } from "./llm-recipe.service";
import { Block4Output, Candidate, FinalDiagnosis, GeoSignal, InputBundle, KindwiseResult, Recipe, RecipeDetails } from "./types";

@Injectable()
export class AiFusionService {
  constructor(private readonly llmRecipeService: AiLlmRecipeService) {}

  async run(inputBundle: InputBundle, candidates: Candidate[], kindwise: KindwiseResult, geoSignal: GeoSignal): Promise<Block4Output> {
    const primary = this.pickPrimary(candidates, kindwise.matched_candidate_eppo_code || null);
    const alternatives = primary ? candidates.filter((item) => item.eppo_code !== primary.eppo_code) : [];
    const topScore = primary?.score_plantnet || 0;
    const hostMatch = primary?.host_match ?? "unknown";
    const kindwiseMatch = this.kindwiseMatch(candidates, kindwise.matched_candidate_eppo_code || null);
    const qualityScore = this.averageQuality(inputBundle);

    const highConfidence = topScore >= 0.75 && hostMatch === true && kindwiseMatch;
    const confidence = highConfidence
      ? "alta"
      : [topScore >= 0.55, hostMatch === true, kindwiseMatch].filter(Boolean).length >= 2 && hostMatch !== false
      ? "media"
      : "baja";

    const diagnosis: FinalDiagnosis = {
      primary_candidate: primary || null,
      alternatives,
      confidence,
      confidence_score: this.computeScore({
        topScore,
        hostMatch,
        kindwiseMatch,
        geoSupport: geoSignal.geo_support,
        qualityScore,
        confidence,
      }),
      reasons: this.reasons({ hostMatch, kindwiseMatch, geoSignal, qualityScore }),
    };

    const recipe = await this.buildRecipe(diagnosis, kindwise, geoSignal);
    return {
      final_diagnosis: diagnosis,
      receta: recipe,
    };
  }

  private pickPrimary(candidates: Candidate[], preferredCode: string | null) {
    if (!candidates.length) return null;
    if (preferredCode) {
      const preferred = candidates.find((item) => item.eppo_code === preferredCode);
      if (preferred) return preferred;
    }
    return candidates[0];
  }

  private kindwiseMatch(candidates: Candidate[], matchedCode: string | null) {
    if (!matchedCode) return false;
    const top2 = candidates.slice(0, 2).map((item) => item.eppo_code);
    return top2.includes(matchedCode);
  }

  private averageQuality(inputBundle: InputBundle) {
    const values = inputBundle.media.images.map((item) => item.quality.quality_score);
    return values.length ? mean(values) : 0;
  }

  private computeScore(params: {
    topScore: number;
    hostMatch: boolean | "unknown";
    kindwiseMatch: boolean;
    geoSupport: boolean | "unknown";
    qualityScore: number;
    confidence: "alta" | "media" | "baja";
  }) {
    const { topScore, hostMatch, kindwiseMatch, geoSupport, qualityScore, confidence } = params;
    let score = 0;
    score += Math.min(topScore, 1) * 0.45;
    score += hostMatch === true ? 0.2 : hostMatch === "unknown" ? 0 : -0.2;
    score += kindwiseMatch ? 0.2 : 0;
    score += geoSupport === true ? 0.1 : 0;
    score += Math.max(0, Math.min(1, qualityScore)) * 0.05;

    if (confidence === "baja") score = Math.min(score, 0.49);
    if (confidence === "media") score = Math.min(Math.max(score, 0.5), 0.79);
    if (confidence === "alta") score = Math.max(score, 0.8);
    return Number(Math.max(0, Math.min(1, score)).toFixed(3));
  }

  private reasons(params: {
    hostMatch: boolean | "unknown";
    kindwiseMatch: boolean;
    geoSignal: GeoSignal;
    qualityScore: number;
  }) {
    const { hostMatch, kindwiseMatch, geoSignal, qualityScore } = params;
    const output: string[] = [];
    output.push(kindwiseMatch ? "coincide_modelos" : "modelos_no_coinciden");

    if (hostMatch === true) output.push("host_match");
    else if (hostMatch === false) output.push("host_mismatch");
    else output.push("host_match_desconocido");

    if (geoSignal.geo_support === true) output.push("geo_support");
    else if (geoSignal.geo_support === false) output.push("geo_no_soporta");
    else output.push("geo_support_desconocido");

    output.push(qualityScore >= 0.55 ? "calidad_imagen_adecuada" : "calidad_imagen_mejorable");
    return output;
  }

  private async buildRecipe(diagnosis: FinalDiagnosis, kindwise: KindwiseResult, geoSignal: GeoSignal): Promise<Recipe> {
    if ((process.env.LLM_RECIPE_ENABLED || "true").toLowerCase() === "true" && (process.env.OPENAI_API_KEY || "").trim()) {
      try {
        return await this.llmRecipeService.buildRecipe(diagnosis, kindwise, geoSignal);
      } catch {
        // fallback deterministico
      }
    }

    const probable = diagnosis.primary_candidate?.label || "No concluyente";
    const confidenceLabel = diagnosis.confidence === "alta" ? "Alta" : diagnosis.confidence === "media" ? "Media" : "Baja";
    const confidenceText = `Confianza ${confidenceLabel} (${diagnosis.confidence_score.toFixed(2)})`;
    const porQue = [
      `Coincidencia entre modelos: ${diagnosis.reasons.includes("coincide_modelos") ? "Si" : "No"}`,
      `Cultivo/host: ${diagnosis.reasons.includes("host_match") ? "Si" : diagnosis.reasons.includes("host_mismatch") ? "No" : "Desconocido"}`,
      `En tu zona: ${geoSignal.geo_support === true ? `Probable (${geoSignal.occurrence_level})` : "Sin evidencia suficiente"}`,
    ];

    let acciones: string[] = [];
    let plan: string[] = [];
    let tratamiento: string[] = [];
    let notas: string[] = [];

    if (diagnosis.confidence === "alta") {
      acciones = [
        "Aísla las plantas con síntomas evidentes para reducir la propagación.",
        "Retira hojas muy afectadas y descarta residuos fuera del lote.",
        "Evita el riego por aspersión y prioriza riego al suelo.",
        "Mejora la ventilación del follaje para bajar humedad.",
      ];
      plan = [
        "Día 1-2: inspección diaria y retiro de tejido afectado.",
        "Día 3-7: monitoreo de brotes nuevos y control de humedad foliar.",
      ];
      tratamiento = [
        kindwise.treatment_text || "Aplica manejo recomendado por etiqueta local según la severidad observada.",
        "Verifica productos autorizados en tu país y respeta periodo de carencia.",
      ];
      notas = ["La dosis y producto exacto deben validarse con etiqueta oficial local."];
    } else if (diagnosis.confidence === "media") {
      acciones = [
        "Separa las plantas con mayor daño para seguimiento.",
        "Retira tejido enfermo visible y mantiene el área limpia.",
        "Reduce humedad y evita mojar hojas al regar.",
      ];
      plan = [
        "Día 1-3: toma nuevas fotos de hoja y fruto con mejor luz.",
        "Día 4-7: confirma si aparecen síntomas en hojas nuevas.",
      ];
      tratamiento = [
        "Aplica solo manejo conservador hasta confirmar diagnóstico.",
        kindwise.treatment_text || "Si la progresión aumenta, solicita validación técnica local.",
      ];
      notas = ["Diagnóstico parcial: se recomienda confirmar con nuevas evidencias."];
    } else {
      acciones = [
        "No apliques tratamiento químico todavía.",
        "Aísla la planta sospechosa y mejora condiciones de higiene.",
        "Toma nuevas fotos enfocadas de hoja, tallo y fruto con buena luz.",
      ];
      plan = [
        "Recolecta evidencia adicional en 24-48 horas.",
        "Repite análisis con fotos más cercanas y nítidas.",
      ];
      tratamiento = ["Solo acciones seguras: higiene, retiro de tejido necrótico y manejo de humedad."];
      notas = ["Confianza baja: no se emite receta completa."];
    }

    const detalles: RecipeDetails = {
      por_que: porQue,
      acciones_inmediatas: acciones,
      plan_7_dias: plan,
      tratamiento_recomendado: tratamiento,
      prevencion: [
        "Rota cultivos y evita repetir hospedantes en el mismo lote.",
        "Elimina residuos vegetales enfermos al final del ciclo.",
        "Mantén monitoreo semanal de síntomas tempranos.",
      ],
      cuando_pedir_ayuda: [
        "Si aparecen síntomas en hojas nuevas de forma acelerada.",
        "Si empieza daño en fruto o tallo principal.",
        "Si más del 30% del cultivo presenta síntomas.",
      ],
      notas,
    };

    const preguntas =
      diagnosis.confidence === "alta"
        ? ["¿Los síntomas aparecen primero en hojas viejas o nuevas?"]
        : diagnosis.confidence === "media"
        ? ["¿Has visto insectos pequeños en hojas nuevas?"]
        : ["¿Puedes tomar una foto más cerca y bien enfocada de la hoja?"];

    return {
      probable,
      confidence_text: confidenceText,
      resumen_agricultor: this.renderSummary(probable, confidenceText, detalles, preguntas, kindwise),
      preguntas_confirmacion: preguntas,
      detalles_receta: detalles,
    };
  }

  private renderSummary(
    probable: string,
    confidenceText: string,
    detalles: RecipeDetails,
    preguntas: string[],
    kindwise: KindwiseResult,
  ) {
    const preguntasText = preguntas.map((item) => `- ${item}`).join("\n");
    const accionesText = detalles.acciones_inmediatas.map((item) => `- ${item}`).join("\n");
    const planText = detalles.plan_7_dias.map((item) => `- ${item}`).join("\n");
    const manejoText = kindwise.treatment_text || "No especificado por la fuente.";
    return [
      `Diagnóstico probable: ${probable}`,
      `${confidenceText}.`,
      "",
      "🛠️ Acciones inmediatas:",
      accionesText,
      "",
      "📅 Plan de manejo (7 días):",
      planText,
      "",
      "🧪 Manejo recomendado:",
      `- ${manejoText}`,
      "",
      "❓ Pregunta de confirmación:",
      preguntasText,
      "",
      "ℹ️ Más detalles en el apartado Detalles de receta.",
    ].join("\n");
  }
}
