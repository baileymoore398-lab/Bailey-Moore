// PrintForge NZ — instant quote engine.
//
// Given a mesh volume + material profile + print settings, derive the full
// cost breakdown the way a real print bureau would: material mass from solid
// volume scaled by infill, machine time from an extrusion-rate model, then
// material/machine/labour/shipping costs, GST and total.
//
// All currency values are NZD.

export interface MaterialProfile {
  code: string;
  name: string;
  densityGCm3: number;
  pricePerKgNzd: number;
  speedFactor: number;
}

export interface QuoteSettings {
  infillPct: number; // 0-100
  layerHeightMm: number; // e.g. 0.2
  quantity: number;
}

export interface QuoteInput {
  volumeCm3: number;
  bbox?: { x: number; y: number; z: number };
  material: MaterialProfile;
  settings: QuoteSettings;
}

export interface QuoteResult {
  volumeCm3: number;
  weightGrams: number;
  printMinutes: number;
  supportRequired: boolean;
  materialCost: number;
  machineCost: number;
  labourCost: number;
  shippingEstimate: number;
  subtotal: number;
  gst: number;
  total: number;
  perUnit: number;
  breakdown: { label: string; amount: number }[];
}

// Bureau pricing constants (tunable via env / admin in a fuller build).
export const PRICING = {
  GST_RATE: 0.15, // NZ GST
  MACHINE_RATE_PER_HOUR: 4.5, // NZD/hr amortised machine + power
  LABOUR_RATE_PER_HOUR: 25.0, // NZD/hr setup, post-processing
  LABOUR_BASE_MINUTES: 8, // fixed handling per job
  MIN_ORDER_NZD: 8.0,
  // shell/wall always ~solid; infill fills the interior
  SHELL_FRACTION: 0.18, // fraction of volume that is perimeter/top/bottom shells
  // extrusion throughput model: cm^3 of plastic deposited per minute,
  // scaled by material speed factor and (inversely) by layer height detail.
  BASE_THROUGHPUT_CM3_PER_MIN: 0.9
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const { volumeCm3, material, settings } = input;
  const qty = Math.max(1, Math.floor(settings.quantity || 1));
  const infill = Math.min(100, Math.max(0, settings.infillPct)) / 100;

  // Effective solid fraction = shells (≈solid) + infill over the interior.
  const interior = 1 - PRICING.SHELL_FRACTION;
  const solidFraction = PRICING.SHELL_FRACTION + interior * infill;
  const usedVolumeCm3 = volumeCm3 * solidFraction;

  // Mass = volume(cm^3) * density(g/cm^3)
  const weightGrams = usedVolumeCm3 * material.densityGCm3;

  // Print time: extruded volume / throughput, adjusted for layer detail.
  // Finer layers (smaller height) => more passes => slower.
  const layer = settings.layerHeightMm || 0.2;
  const detailFactor = 0.2 / layer; // 0.2mm baseline
  const throughput =
    PRICING.BASE_THROUGHPUT_CM3_PER_MIN * material.speedFactor / detailFactor;
  const printMinutes = Math.max(5, Math.ceil(usedVolumeCm3 / throughput));

  // Support heuristic: tall/overhang-prone parts (bbox.z dominant) need support.
  const bbox = input.bbox;
  const supportRequired = bbox
    ? bbox.z > Math.max(bbox.x, bbox.y) * 1.4
    : false;
  const supportSurcharge = supportRequired ? 1.12 : 1.0;

  // --- costs (per unit) ---
  const materialCost = (weightGrams / 1000) * material.pricePerKgNzd;
  const machineCost = (printMinutes / 60) * PRICING.MACHINE_RATE_PER_HOUR;
  const labourMinutes = PRICING.LABOUR_BASE_MINUTES + printMinutes * 0.05;
  const labourCost = (labourMinutes / 60) * PRICING.LABOUR_RATE_PER_HOUR;

  let perUnit = (materialCost + machineCost + labourCost) * supportSurcharge;
  perUnit = Math.max(PRICING.MIN_ORDER_NZD, perUnit);

  const lineMaterial = round2(materialCost * supportSurcharge * qty);
  const lineMachine = round2(machineCost * supportSurcharge * qty);
  const lineLabour = round2(labourCost * supportSurcharge * qty);

  const subtotalRaw = perUnit * qty;
  const shippingEstimate = estimateShipping(weightGrams * qty);
  const subtotal = round2(subtotalRaw);
  const taxable = subtotal + shippingEstimate;
  const gst = round2(taxable * PRICING.GST_RATE);
  const total = round2(taxable + gst);

  return {
    volumeCm3: round2(volumeCm3),
    weightGrams: round2(weightGrams * qty),
    printMinutes: printMinutes * qty,
    supportRequired,
    materialCost: lineMaterial,
    machineCost: lineMachine,
    labourCost: lineLabour,
    shippingEstimate,
    subtotal,
    gst,
    total,
    perUnit: round2(perUnit),
    breakdown: [
      { label: "Material", amount: lineMaterial },
      { label: "Machine time", amount: lineMachine },
      { label: "Labour & finishing", amount: lineLabour },
      { label: "Shipping (est.)", amount: shippingEstimate },
      { label: "GST (15%)", amount: gst }
    ]
  };
}

// Simple NZ courier band by parcel weight. Replaced by live carrier rates
// (NZ Post / Aramex / CourierPost) when those integrations are configured.
export function estimateShipping(totalGrams: number): number {
  const kg = totalGrams / 1000;
  if (kg <= 0.5) return 6.5;
  if (kg <= 1) return 8.5;
  if (kg <= 3) return 12.0;
  if (kg <= 5) return 16.0;
  if (kg <= 10) return 24.0;
  return 24.0 + Math.ceil(kg - 10) * 2.2;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
