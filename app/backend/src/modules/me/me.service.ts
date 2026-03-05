import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type WeatherSnapshot = {
  air_temperature_c: number | null;
  air_humidity_pct: number | null;
  air_pressure_hpa: number | null;
  wind_speed_mps: number | null;
  solar_radiation_ghi_wm2: number | null;
  rainfall_mm: number | null;
  et0_mm: number | null;
  etc_mm: number | null;
  kc: number | null;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(userId: string) {
    const [user, farms, crops, zones] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
      this.prisma.farm.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "asc" },
        include: {
          plots: {
            orderBy: { createdAt: "asc" },
            include: {
              crop: true,
              stage: true,
              zone: true,
            },
          },
        },
      }),
      this.prisma.crop.findMany({
        orderBy: { name: "asc" },
        include: {
          stages: { orderBy: [{ order: "asc" }, { name: "asc" }] },
        },
      }),
      this.prisma.zone.findMany({ orderBy: { name: "asc" } }),
    ]);

    const activeFarm = farms[0] || null;
    const activePlot = activeFarm?.plots?.[0] || null;
    const activeZone = activePlot?.zone || (activePlot?.zoneId ? zones.find((item) => item.id === activePlot.zoneId) : null) || null;

    let latestReading = null;
    if (activeFarm?.id) {
      latestReading = await this.prisma.sensorReading.findFirst({
        where: {
          farmId: activeFarm.id,
          ...(activePlot?.id ? { plotId: activePlot.id } : {}),
        },
        orderBy: { timestamp: "desc" },
      });
    }

    const lat = this.numberOrNull(latestReading?.latitude) ?? this.numberOrNull(activePlot?.latitude) ?? this.numberOrNull(activeZone?.latitude);
    const lon = this.numberOrNull(latestReading?.longitude) ?? this.numberOrNull(activePlot?.longitude) ?? this.numberOrNull(activeZone?.longitude);
    const kcFromReading = this.numberOrNull(latestReading?.kc);
    const kcEstimated = this.estimateKc(activePlot?.crop?.name || activePlot?.cropType || "", activePlot?.stage?.name || "");
    const weatherFromApi = lat !== null && lon !== null ? await this.fetchWeatherFromApi(lat, lon, kcFromReading ?? kcEstimated) : null;

    const weather = this.buildWeather(latestReading, weatherFromApi, kcFromReading ?? kcEstimated);
    const irrigation = this.buildIrrigation(latestReading);

    const farmsFlat = farms.map((farm) => ({
      id: farm.id,
      name: farm.name,
      location: farm.location,
      ownerId: farm.ownerId,
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
    }));

    const plotsFlat = farms.flatMap((farm) =>
      (farm.plots || []).map((plot) => ({
        id: plot.id,
        farmId: plot.farmId,
        name: plot.name,
        cropType: plot.cropType,
        cropId: plot.cropId,
        stageId: plot.stageId,
        zoneId: plot.zoneId,
        latitude: plot.latitude,
        longitude: plot.longitude,
        notes: plot.notes,
        crop: plot.crop || null,
        stage: plot.stage || null,
        zone: plot.zone || null,
      })),
    );

    return {
      user: user || null,
      displayName: user?.name || null,
      activeFarmId: activeFarm?.id || null,
      activeParcelId: activePlot?.id || null,
      activePlotId: activePlot?.id || null,
      activeZoneId: activeZone?.id || activePlot?.zoneId || null,
      activeCropId: activePlot?.cropId || null,
      farm: activeFarm
        ? {
            id: activeFarm.id,
            name: activeFarm.name,
            location: activeFarm.location,
            ownerId: activeFarm.ownerId,
            plots: plotsFlat.filter((item) => item.farmId === activeFarm.id),
          }
        : null,
      plot: activePlot
        ? {
            ...plotsFlat.find((item) => item.id === activePlot.id),
          }
        : null,
      active: {
        farmId: activeFarm?.id || null,
        parcelId: activePlot?.id || null,
        plotId: activePlot?.id || null,
        zoneId: activeZone?.id || activePlot?.zoneId || null,
        cropId: activePlot?.cropId || null,
        cropName: activePlot?.crop?.name || activePlot?.cropType || null,
        zoneName: activeZone?.name || null,
        plot: activePlot
          ? {
              ...plotsFlat.find((item) => item.id === activePlot.id),
            }
          : null,
      },
      farms: farmsFlat,
      plots: plotsFlat,
      parcels: plotsFlat,
      crops,
      zones,
      irrigation,
      weather,
      latestReading: {
        id: latestReading?.id || null,
        timestamp: latestReading?.timestamp ? new Date(latestReading.timestamp).toISOString() : null,
        latitude: lat,
        longitude: lon,
      },
    };
  }

  private buildIrrigation(reading: any) {
    return {
      humidityPct: this.numberOrNull(reading?.humidity),
      soilTemp: this.numberOrNull(reading?.temperature),
      soil_ph: this.numberOrNull(reading?.ph),
      soil_ec: this.numberOrNull(reading?.ce),
      soil_n_mgkg: this.numberOrNull(reading?.n),
      soil_p_mgkg: this.numberOrNull(reading?.p),
      soil_k_mgkg: this.numberOrNull(reading?.k),
    };
  }

  private buildWeather(reading: any, weatherFromApi: WeatherSnapshot | null, kcFallback: number | null): WeatherSnapshot {
    const et0FromReading = this.numberOrNull(reading?.et0);
    const kc = this.numberOrNull(reading?.kc) ?? weatherFromApi?.kc ?? kcFallback;
    const et0 = et0FromReading ?? weatherFromApi?.et0_mm ?? null;
    const etcFromReading = this.numberOrNull(reading?.etc);
    const etc = etcFromReading ?? (et0 !== null && kc !== null ? Number((et0 * kc).toFixed(2)) : weatherFromApi?.etc_mm ?? null);

    return {
      air_temperature_c: this.numberOrNull(reading?.airTemperature) ?? weatherFromApi?.air_temperature_c ?? null,
      air_humidity_pct: this.numberOrNull(reading?.airHumidity) ?? weatherFromApi?.air_humidity_pct ?? null,
      air_pressure_hpa: this.numberOrNull(reading?.airPressure) ?? weatherFromApi?.air_pressure_hpa ?? null,
      wind_speed_mps: this.numberOrNull(reading?.windSpeed) ?? weatherFromApi?.wind_speed_mps ?? null,
      solar_radiation_ghi_wm2: this.numberOrNull(reading?.solarRadiation) ?? weatherFromApi?.solar_radiation_ghi_wm2 ?? null,
      rainfall_mm: this.numberOrNull(reading?.rainfall) ?? weatherFromApi?.rainfall_mm ?? null,
      et0_mm: et0,
      etc_mm: etc,
      kc,
    };
  }

  private async fetchWeatherFromApi(lat: number, lon: number, kc: number | null): Promise<WeatherSnapshot | null> {
    const baseUrl = (process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com/v1/forecast").trim();
    if (!baseUrl) return null;

    const url = new URL(baseUrl);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,shortwave_radiation",
    );
    url.searchParams.set("daily", "et0_fao_evapotranspiration");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const apiKey = (process.env.WEATHER_API_KEY || "").trim();
    if (apiKey) {
      url.searchParams.set("apikey", apiKey);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.weatherTimeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const payload: any = await response.json();
      const current = payload?.current || {};
      const daily = payload?.daily || {};
      const et0 = Array.isArray(daily?.et0_fao_evapotranspiration)
        ? this.numberOrNull(daily.et0_fao_evapotranspiration[0])
        : null;
      const safeKc = kc ?? 0.85;
      const etc = et0 !== null ? Number((et0 * safeKc).toFixed(2)) : null;

      return {
        air_temperature_c: this.numberOrNull(current?.temperature_2m),
        air_humidity_pct: this.numberOrNull(current?.relative_humidity_2m),
        air_pressure_hpa: this.numberOrNull(current?.surface_pressure),
        wind_speed_mps: this.numberOrNull(current?.wind_speed_10m),
        solar_radiation_ghi_wm2: this.numberOrNull(current?.shortwave_radiation),
        rainfall_mm: this.numberOrNull(current?.precipitation),
        et0_mm: et0,
        etc_mm: etc,
        kc: safeKc,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private estimateKc(cropNameRaw: string, stageNameRaw: string) {
    const crop = this.normalizeText(cropNameRaw);
    const stage = this.normalizeText(stageNameRaw);

    const byCrop: Record<string, { initial: number; mid: number; late: number }> = {
      tomato: { initial: 0.6, mid: 1.15, late: 0.9 },
      potato: { initial: 0.5, mid: 1.1, late: 0.75 },
      maize: { initial: 0.35, mid: 1.2, late: 0.6 },
      rice: { initial: 1.05, mid: 1.2, late: 0.9 },
      wheat: { initial: 0.4, mid: 1.15, late: 0.45 },
    };

    const profile = byCrop[crop] || { initial: 0.55, mid: 1.0, late: 0.75 };
    if (stage.includes("inicial") || stage.includes("siembra")) return profile.initial;
    if (stage.includes("flor") || stage.includes("produ") || stage.includes("desarrollo") || stage.includes("mid")) return profile.mid;
    if (stage.includes("cosecha") || stage.includes("madur") || stage.includes("late")) return profile.late;
    return profile.mid;
  }

  private normalizeText(value: string) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  private numberOrNull(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private get weatherTimeoutMs() {
    const raw = Number(process.env.WEATHER_API_TIMEOUT_MS || "7000");
    return Number.isFinite(raw) && raw > 0 ? raw : 7000;
  }
}

