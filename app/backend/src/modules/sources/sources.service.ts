import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type CacheEntry = {
  data: any;
  expiresAt: Date;
};

@Injectable()
export class SourcesService {
  private ttlSeconds = Number(process.env.SOURCES_CACHE_TTL || "86400");

  constructor(private prisma: PrismaService) {}

  async getCached(source: string, key: string): Promise<CacheEntry | null> {
    const entry = await this.prisma.sourceCache.findUnique({
      where: { source_key: { source, key } },
    });
    if (!entry) return null;
    if (entry.expiresAt < new Date()) return null;
    return { data: entry.data, expiresAt: entry.expiresAt };
  }

  async setCached(source: string, key: string, data: any, ttlSeconds?: number) {
    const expiresAt = new Date(Date.now() + (ttlSeconds || this.ttlSeconds) * 1000);
    await this.prisma.sourceCache.upsert({
      where: { source_key: { source, key } },
      update: { data, expiresAt },
      create: { source, key, data, expiresAt },
    });
  }

  async fetchJson(url: string, apiKey?: string) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Source fetch error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async fetchDkan(resourceId: string, params?: Record<string, string>) {
    const baseUrl = process.env.DATOSABIERTOS_BASE_URL || "https://datosabiertos.gob.pe/api/action/datastore/search.json";
    const url = new URL(baseUrl);
    url.searchParams.set("resource_id", resourceId);
    url.searchParams.set("limit", "1000");
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
      }
    }
    return this.fetchJson(url.toString());
  }
}
