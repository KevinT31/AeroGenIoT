import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const CROP_SEED = [
  "Tomate",
  "Papa",
  "Maiz",
  "Arroz",
  "Cebolla",
  "Aji",
  "Palta",
  "Cafe",
  "Cacao",
  "Uva",
];

const STAGE_SEED = [
  { name: "Siembra", order: 1 },
  { name: "Crecimiento", order: 2 },
  { name: "Floracion", order: 3 },
  { name: "Cosecha", order: 4 },
];

const ZONE_SEED = [
  { name: "Lima - Santa Anita", type: "mercado", latitude: -12.0501, longitude: -76.9707 },
  { name: "Arequipa - Rio Seco", type: "mercado", latitude: -16.4232, longitude: -71.5459 },
  { name: "Piura - Tambogrande", type: "valle", latitude: -4.9306, longitude: -80.3365 },
  { name: "La Libertad - Chavimochic", type: "valle", latitude: -7.9211, longitude: -79.2206 },
  { name: "Junin - Mantaro", type: "valle", latitude: -12.0678, longitude: -75.2103 },
];

async function seedAdmin() {
  const email = "a20213166@pucp.edu.pe";
  const password = "kevinTB2002@";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        role: "admin",
        passwordHash,
        name: existing.name || "Kevin",
      },
    });
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Kevin",
      role: "admin",
      authProvider: "password",
    },
  });
  return created.id;
}

async function seedCatalogs() {
  const crops = [];
  for (const name of CROP_SEED) {
    const existing = await prisma.crop.findFirst({ where: { name } });
    const crop = existing || (await prisma.crop.create({ data: { name } }));
    crops.push(crop);

    for (const stage of STAGE_SEED) {
      const stageExisting = await prisma.cropStage.findFirst({
        where: { cropId: crop.id, name: stage.name },
      });
      if (!stageExisting) {
        await prisma.cropStage.create({
          data: { cropId: crop.id, name: stage.name, order: stage.order },
        });
      }
    }
  }

  const zones = [];
  for (const zone of ZONE_SEED) {
    const existing = await prisma.zone.findFirst({ where: { name: zone.name, type: zone.type } });
    zones.push(existing || (await prisma.zone.create({ data: zone })));
  }

  return { crops, zones };
}

async function seedMarketPrices(crops: { id: string }[], zones: { id: string }[]) {
  const now = new Date();
  const rows = [];
  const cropSlice = crops.slice(0, 3);
  const zoneSlice = zones.slice(0, 3);

  cropSlice.forEach((crop, cropIndex) => {
    zoneSlice.forEach((zone, zoneIndex) => {
      for (let i = 45; i >= 1; i -= 1) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const base = 2 + cropIndex * 0.5 + zoneIndex * 0.3;
        const wave = Math.sin(i / 6) * 0.18;
        const priceMin = Number((base + wave).toFixed(2));
        const priceMax = Number((base + wave + 0.4).toFixed(2));
        rows.push({
          cropId: crop.id,
          zoneId: zone.id,
          date,
          priceMin,
          priceMax,
          source: "SEED",
        });
      }
    });
  });

  if (rows.length) {
    await prisma.marketPrice.createMany({ data: rows, skipDuplicates: true });
  }
}

async function seedNearbyAggregates(crops: { id: string }[], zones: { id: string }[]) {
  const now = new Date();
  const cropSlice = crops.slice(0, 5);
  for (const zone of zones) {
    let baseCount = 24;
    for (const crop of cropSlice) {
      await prisma.nearbyAggregate.upsert({
        where: { zoneId_cropId: { zoneId: zone.id, cropId: crop.id } },
        update: { count: baseCount, lastUpdated: now },
        create: { zoneId: zone.id, cropId: crop.id, count: baseCount, lastUpdated: now },
      });
      baseCount -= 3;
    }
  }
}

async function main() {
  await seedAdmin();
  const { crops, zones } = await seedCatalogs();
  await seedMarketPrices(crops, zones);
  await seedNearbyAggregates(crops, zones);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
