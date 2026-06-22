// AI Design Assistant.
//
// Uses OpenAI when OPENAI_API_KEY is configured; otherwise falls back to a
// deterministic rules engine so the assistant is still useful offline/in dev.
// The contract is the same either way: take a free-text design brief, return
// material suggestions + manufacturing notes.

export interface DesignSuggestion {
  summary: string;
  materials: { code: string; reason: string }[];
  settings: { wallLoops?: number; infillPct?: number; layerHeightMm?: number };
  manufacturingNotes: string[];
  source: "openai" | "rules";
}

const KEYWORD_RULES: { match: RegExp; codes: string[]; note: string }[] = [
  { match: /strong|load|structural|bracket|mount|cage|stress|durable/i, codes: ["PETG", "CF_NYLON", "NYLON"], note: "Increase wall thickness to 4+ perimeters and infill to 40-60% for load-bearing parts." },
  { match: /flex|rubber|grip|gasket|seal|bumper/i, codes: ["TPU"], note: "Use TPU (flexible). Print slow (20-30mm/s) with direct-drive for best results." },
  { match: /outdoor|uv|sun|weather|garden|car|automotive|exterior/i, codes: ["ASA", "PETG"], note: "ASA resists UV and weather; PETG is a good all-round outdoor option." },
  { match: /heat|engine|hot|temperature|warm/i, codes: ["ABS", "ASA", "NYLON"], note: "For heat resistance choose ABS/ASA/Nylon; PLA softens around 55°C." },
  { match: /detail|miniature|figurine|model|display|smooth/i, codes: ["PLA"], note: "Use 0.12mm layers for fine detail; PLA gives crisp results." },
  { match: /food|kitchen|drink|bottle/i, codes: ["PETG"], note: "PETG is the most food-safe-friendly of our filaments, but use a dedicated nozzle and seal porous surfaces." }
];

export async function getDesignSuggestion(brief: string): Promise<DesignSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      return await openAiSuggestion(brief, apiKey);
    } catch {
      // fall through to rules on any API error
    }
  }
  return rulesSuggestion(brief);
}

async function openAiSuggestion(brief: string, apiKey: string): Promise<DesignSuggestion> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are PrintForge NZ's 3D printing design assistant. Given a design brief, respond with strict JSON: {summary, materials:[{code,reason}], settings:{wallLoops,infillPct,layerHeightMm}, manufacturingNotes:[...]}. Material codes must be one of PLA, PETG, TPU, ABS, ASA, NYLON, CF_NYLON."
        },
        { role: "user", content: brief }
      ]
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return { ...parsed, source: "openai" };
}

function rulesSuggestion(brief: string): DesignSuggestion {
  const codes = new Set<string>();
  const notes: string[] = [];
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(brief)) {
      rule.codes.forEach((c) => codes.add(c));
      notes.push(rule.note);
    }
  }
  if (codes.size === 0) {
    codes.add("PLA");
    codes.add("PETG");
    notes.push("PLA is great for prototypes and display parts; step up to PETG for any functional or outdoor use.");
  }
  const materialReasons: Record<string, string> = {
    PLA: "Easy, accurate, great for prototypes and display models.",
    PETG: "Strong, weather-resistant all-rounder.",
    TPU: "Flexible — ideal for grips, gaskets and bumpers.",
    ABS: "Heat resistant, tough (print enclosed).",
    ASA: "UV and weather resistant — best for outdoor parts.",
    NYLON: "Industrial strength and wear resistance.",
    CF_NYLON: "Premium stiffness-to-weight for demanding load-bearing parts."
  };
  return {
    summary: `Based on your brief, here are recommended materials and print settings. ${notes[0] || ""}`.trim(),
    materials: Array.from(codes).map((code) => ({ code, reason: materialReasons[code] })),
    settings: { wallLoops: 4, infillPct: 40, layerHeightMm: 0.2 },
    manufacturingNotes: notes.length ? notes : ["Standard settings recommended."],
    source: "rules"
  };
}
