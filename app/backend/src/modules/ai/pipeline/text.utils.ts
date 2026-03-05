const removeDiacritics = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeText = (value: string | null | undefined) => {
  if (!value) return "";
  return removeDiacritics(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const diceCoefficient = (a: string, b: string) => {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const pair = a.substring(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.substring(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.length + b.length - 2);
};

export const similarity = (a: string | null | undefined, b: string | null | undefined) => {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  return Math.max(diceCoefficient(left, right), left.includes(right) || right.includes(left) ? 0.9 : 0);
};

export const cropAliases = (crop: string) => {
  const value = normalizeText(crop);
  const aliases: Record<string, Set<string>> = {
    tomato: new Set(["tomato", "tomate", "solanum lycopersicum"]),
    potato: new Set(["potato", "papa", "solanum tuberosum"]),
    maize: new Set(["maize", "corn", "maiz", "zea mays"]),
    wheat: new Set(["wheat", "trigo", "triticum aestivum"]),
    rice: new Set(["rice", "arroz", "oryza sativa"]),
  };

  for (const [key, values] of Object.entries(aliases)) {
    if (value === key || values.has(value)) {
      return values;
    }
  }

  return new Set([value]);
};

export const anySimilar = (target: string, candidates: string[], threshold = 0.86) => {
  const normalizedTarget = normalizeText(target);
  return candidates.some((candidate) => similarity(normalizedTarget, candidate) >= threshold);
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
