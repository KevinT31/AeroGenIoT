import { Injectable } from "@nestjs/common";
import { FinalDiagnosis, GeoSignal, KindwiseResult, Recipe } from "./types";

@Injectable()
export class AiLlmRecipeService {
  async buildRecipe(diagnosis: FinalDiagnosis, kindwise: KindwiseResult, geoSignal: GeoSignal): Promise<Recipe> {
    if (!this.llmEnabled || !this.apiKey) {
      throw new Error("LLM recipes disabled or missing OPENAI_API_KEY");
    }

    const payload = {
      model: this.model,
      instructions: this.systemPrompt,
      input: this.userPrompt(diagnosis, kindwise, geoSignal),
      temperature: this.temperature,
      text: {
        format: {
          type: "json_schema",
          name: "recipe",
          schema: this.recipeSchema,
          strict: true,
        },
      },
    };

    const endpoint = `${this.baseUrl}/responses`;
    const response = await this.postJson(endpoint, payload);
    const text = this.extractText(response);
    return JSON.parse(text) as Recipe;
  }

  private async postJson(url: string, body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status >= 400) {
        const fallback = {
          model: this.model,
          instructions: this.systemPrompt,
          input: body.input,
          temperature: this.temperature,
          text: { format: { type: "json_object" } },
        };
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallback),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as Record<string, any>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractText(response: Record<string, any>) {
    if (typeof response.output_text === "string" && response.output_text.trim()) {
      return response.output_text;
    }

    const output = Array.isArray(response.output) ? response.output : [];
    for (const item of output) {
      if (!item || typeof item !== "object" || item.type !== "message") continue;
      const content = Array.isArray(item.content) ? item.content : [];
      for (const row of content) {
        if (!row || typeof row !== "object") continue;
        if ((row.type === "output_text" || row.type === "text") && row.text) {
          return String(row.text);
        }
      }
    }

    throw new Error("No se pudo extraer texto del response de OpenAI");
  }

  private userPrompt(diagnosis: FinalDiagnosis, kindwise: KindwiseResult, geoSignal: GeoSignal) {
    const payload = {
      final_diagnosis: {
        probable: diagnosis.primary_candidate?.label || "No concluyente",
        confidence: diagnosis.confidence,
        confidence_score: diagnosis.confidence_score,
        reasons: diagnosis.reasons,
        alternatives: diagnosis.alternatives.map((item) => item.label),
      },
      kindwise: {
        top_labels: kindwise.top_labels.map((item) => item.label),
        score: kindwise.score_kindwise,
        symptoms: kindwise.symptoms,
        severity: kindwise.severity,
        treatment_text: kindwise.treatment_text,
      },
      geo_signal: {
        geo_support: geoSignal.geo_support,
        occurrence_level: geoSignal.occurrence_level,
        notes: geoSignal.notes,
      },
      rules: {
        alta: "Receta completa, pasos claros, prevencion.",
        media: "Receta parcial, advertencias, pedir confirmacion.",
        baja: "No receta, solo acciones seguras, pedir mejores fotos/info.",
      },
    };

    return (
      "Genera la receta final en JSON segun schema. Usa solo la informacion del payload. " +
      "No inventes dosis ni productos comerciales. Si no hay informacion, usa 'No especificado por la fuente'. " +
      "El resumen para agricultor debe verse claro y ordenado con este formato: " +
      "diagnostico, confianza, seccion de acciones, seccion de plan semanal, seccion de manejo y una pregunta de confirmacion. " +
      "Usa bullets con '*' cuando corresponda y termina con 'Mas detalles en el apartado Detalles de receta'. " +
      "\n\nPAYLOAD:\n" +
      JSON.stringify(payload)
    );
  }

  private get systemPrompt() {
    return (
      "Eres un asistente tecnico agricola. Solo estructuras la receta final con datos provistos. " +
      "No diagnosticas ni indicas dosis. Mantiene claridad, acciones concretas y preguntas de confirmacion."
    );
  }

  private get recipeSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: ["probable", "confidence_text", "resumen_agricultor", "preguntas_confirmacion", "detalles_receta"],
      properties: {
        probable: { type: "string" },
        confidence_text: { type: "string" },
        resumen_agricultor: { type: "string" },
        preguntas_confirmacion: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: { type: "string" },
        },
        detalles_receta: {
          type: "object",
          additionalProperties: false,
          required: [
            "por_que",
            "acciones_inmediatas",
            "plan_7_dias",
            "tratamiento_recomendado",
            "prevencion",
            "cuando_pedir_ayuda",
            "notas",
          ],
          properties: {
            por_que: { type: "array", items: { type: "string" } },
            acciones_inmediatas: { type: "array", items: { type: "string" } },
            plan_7_dias: { type: "array", items: { type: "string" } },
            tratamiento_recomendado: { type: "array", items: { type: "string" } },
            prevencion: { type: "array", items: { type: "string" } },
            cuando_pedir_ayuda: { type: "array", items: { type: "string" } },
            notas: { type: "array", items: { type: "string" } },
          },
        },
      },
    };
  }

  private get llmEnabled() {
    return (process.env.LLM_RECIPE_ENABLED || "true").toLowerCase() === "true";
  }

  private get apiKey() {
    return process.env.OPENAI_API_KEY || "";
  }

  private get baseUrl() {
    return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private get model() {
    return process.env.OPENAI_MODEL || "gpt-4.1-mini";
  }

  private get temperature() {
    return Number(process.env.OPENAI_TEMPERATURE || "0.2");
  }

  private get timeoutMs() {
    return Number(process.env.OPENAI_TIMEOUT_SECONDS || "30") * 1000;
  }
}
