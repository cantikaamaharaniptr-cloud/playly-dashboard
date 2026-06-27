// Playly DeepL subtitle translator — Next.js Route Handler (Edge runtime).
// Ported from legacy api/translate-subtitle.js. Same contract:
//   Request: POST /api/translate-subtitle
//   Body: { cues: [{start, end, text}], targetLang: "ID", sourceLang?: "EN" }
//   Response: { cues: [{start, end, text}], detectedSourceLanguage }
//
// Env var WAJIB: DEEPL_API_KEY (set di Vercel Project Settings → Env Vars).

export const runtime = 'edge';

type Cue = { start: number; end: number; text: string };

const BATCH_SIZE = 50;
const MAX_CUES = 2000;
const MAX_CHARS_TOTAL = 100_000;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return json({ error: 'no_api_key', hint: 'set DEEPL_API_KEY env var' }, 500);

  const endpoint = key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  let body: { cues?: Cue[]; targetLang?: string; sourceLang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const { cues, targetLang, sourceLang } = body || {};
  if (!Array.isArray(cues) || cues.length === 0) return json({ error: 'no_cues' }, 400);
  if (cues.length > MAX_CUES) return json({ error: 'too_many_cues', max: MAX_CUES }, 413);
  if (!targetLang || typeof targetLang !== 'string') return json({ error: 'no_target_lang' }, 400);

  const totalChars = cues.reduce((n, c) => n + (c.text?.length || 0), 0);
  if (totalChars > MAX_CHARS_TOTAL) return json({ error: 'too_many_chars', max: MAX_CHARS_TOTAL }, 413);

  const translated: Cue[] = [];
  let detectedSourceLanguage: string | null = null;

  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    const batch = cues.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams();
    batch.forEach((c) => params.append('text', c.text || ''));
    params.append('target_lang', targetLang.toUpperCase());
    if (sourceLang && sourceLang.toLowerCase() !== 'auto') {
      params.append('source_lang', sourceLang.toUpperCase());
    }
    params.append('split_sentences', '0');
    params.append('preserve_formatting', '1');

    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } catch (e) {
      return json({ error: 'network', detail: String(e).slice(0, 200) }, 502);
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json({ error: 'deepl_failed', status: resp.status, detail: detail.slice(0, 300) }, 502);
    }

    const data = (await resp.json()) as {
      translations?: { text: string; detected_source_language?: string }[];
    };
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

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, 405);
}
