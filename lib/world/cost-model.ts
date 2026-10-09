export type CostInput = {
  currency: "USD" | "EUR" | "GBP";
  batchSize: number; wastePercent: number; overhead: string; assumptions: string;
  items: Array<{ name: string; quantityPerUnit: number; unitCost: string }>;
};
export type CostResult = { materialPerUnitMinor: string; totalMinor: string; perUnitMinor: string };

function money(value: string): bigint {
  if (typeof value !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error("Use a nonnegative price with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (minor > BigInt(100000000)) throw new Error("Each price must be 1,000,000 or less.");
  return minor;
}

export function calculateCost(input: CostInput): CostResult {
  if (!input || !["USD", "EUR", "GBP"].includes(input.currency) || !Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 1000000 ||
      !Number.isInteger(input.wastePercent) || input.wastePercent < 0 || input.wastePercent > 100 ||
      typeof input.assumptions !== "string" || input.assumptions.length > 1200 || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20)
    throw new Error("Choose a currency, 1–1,000,000 units, 0–100% waste, and 1–20 components.");
  let material = BigInt(0);
  for (const item of input.items) {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 || !Number.isInteger(item.quantityPerUnit) || item.quantityPerUnit < 1 || item.quantityPerUnit > 1000)
      throw new Error("Name each component and enter a whole quantity from 1 to 1,000 per unit.");
    material += money(item.unitCost) * BigInt(item.quantityPerUnit);
  }
  const batch = BigInt(input.batchSize);
  const total = (material * batch * BigInt(100 + input.wastePercent) + BigInt(99)) / BigInt(100) + money(input.overhead);
  return { materialPerUnitMinor: material.toString(), totalMinor: total.toString(), perUnitMinor: ((total + batch - BigInt(1)) / batch).toString() };
}

export function formatCost(minor: string, currency: CostInput["currency"]): string {
  const value = BigInt(minor);
  const mark = { USD: "$", EUR: "€", GBP: "£" }[currency];
  return `${mark}${(value / BigInt(100)).toLocaleString("en-US")}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}

export function costDocument(input: CostInput): string {
  const result = calculateCost(input);
  return ["Component cost worksheet · Estimate", `Currency: ${input.currency}; batch: ${input.batchSize} units; material waste allowance: ${input.wastePercent}%.`,
    ...input.items.map(i => `${i.name}: ${i.quantityPerUnit} per finished unit × ${i.unitCost} ${input.currency} per component`),
    `Fixed overhead for this batch: ${input.overhead} ${input.currency}.`,
    `Estimated batch total: ${formatCost(result.totalMinor, input.currency)}. Estimated cost per finished unit: ${formatCost(result.perUnitMinor, input.currency)} (rounded up to the next cent).`,
    `Assumptions: ${input.assumptions.trim() || "No assumptions supplied. Verify prices and included costs before relying on this estimate."}`,
    "User-provided inputs; this worksheet does not fetch or verify supplier prices. Waste is applied to materials; fixed overhead is added once."].join("\n");
}
