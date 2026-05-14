// Playly DeepL subtitle translator — Vercel Edge Function.
// API key WAJIB server-side (env var DEEPL_API_KEY). Jangan pernah expose ke client.
// Endpoint dipanggil dari script.js setelah Whisper selesai transcribe.
//
// Request: POST /api/translate-subtitle
// Body: { cues: [{start, end, text}], targetLang: "ID", sourceLang?: "EN" }
// Response: { cues: [{start, end, text}], detectedSourceLanguage }
//
// Setup env var:
//   vercel env add DEEPL_API_KEY production
//   (paste key dari https://www.deepl.com/account/summary)
//
// DeepL Free: 500k char/bulan. Pro: bayar per char (~$25/1M char Pro).
// Auto-select endpoint by key suffix (`:fx` = Free).

export const config = { runtime: "edge" };

const BATCH_SIZE = 50;            // DeepL max texts per request
const MAX_CUES = 2000;            // safety guard — block stupid huge requests
const MAX_CHARS_TOTAL = 100_000;  // ~30 min video transcript

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const key = process.env.DEEPL_API_KEY;
  if (!key) return json({ error: "no_api_key", hint: "set DEEPL_API_KEY env var" }, 500);

  // DeepL Free keys end with ":fx" → use api-free.deepl.com.
  const endpoint = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const { cues, targetLang, sourceLang } = body || {};
  if (!Array.isArray(cues) || cues.length === 0) return json({ error: "no_cues" }, 400);
  if (cues.length > MAX_CUES) return json({ error: "too_many_cues", max: MAX_CUES }, 413);
  if (!targetLang || typeof targetLang !== "string") return json({ error: "no_target_lang" }, 400);

  const totalChars = cues.reduce((n, c) => n + (c.text?.length || 0), 0);
  if (totalChars > MAX_CHARS_TOTAL) return json({ error: "too_many_chars", max: MAX_CHARS_TOTAL }, 413);

  const translated = [];
  let detectedSourceLanguage = null;

  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    const batch = cues.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams();
    batch.forEach(c => params.append("text", c.text || ""));
    params.append("target_lang", targetLang.toUpperCase());
    if (sourceLang && sourceLang.toLowerCase() !== "auto") {
      params.append("source_lang", sourceLang.toUpperCase());
    }
    params.append("split_sentences", "0");       // jangan ubah segmentasi — preserve cue boundaries
    params.append("preserve_formatting", "1");

    let resp;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
    } catch (e) {
      return json({ error: "network", detail: String(e).slice(0, 200) }, 502);
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({ error: "deepl_failed", status: resp.status, detail: detail.slice(0, 300) }, 502);
    }

    const data = await resp.json();
    (data.translations || []).forEach((t, idx) => {
      const src = cues[i + idx];
      translated.push({ start: src.start, end: src.end, text: t.text });
      if (!detectedSourceLanguage) detectedSourceLanguage = t.detected_source_language || null;
    });
  }

  return json({
    cues: translated,
    detectedSourceLanguage,
    targetLanguage: targetLang.toUpperCase(),
    cueCount: translated.length,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
