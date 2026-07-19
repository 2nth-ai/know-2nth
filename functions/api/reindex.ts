// functions/api/reindex.ts
//
// Populates the `know-tree` Vectorize index that powers Vinci's semantic
// retrieval (Phase 2). Walks /agent-index.json, fetches each item's text,
// chunks it, embeds with Workers AI (bge-base-en-v1.5, 768-dim), and upserts
// the vectors with metadata Vinci can cite.
//
//   POST /api/reindex?key=<REINDEX_KEY>&offset=0&limit=15
//   → { processed, upserted, nextOffset, total, done }
//
// Processes a SLICE per call (offset/limit) so a big tree can't blow the
// Function's CPU/subrequest budget — the caller loops until done:true. The
// Vectorize index is account-level, so populating it once (from any deploy)
// serves production too.
//
// Protected by the REINDEX_KEY Pages secret; without a matching key it 403s.
// Rebuilds only from public content, so the key just prevents cost-spam.

interface Env {
  ASSETS: Fetcher;
  AI?: { run: (model: string, input: unknown) => Promise<any> };
  VEC?: {
    upsert: (vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>) => Promise<unknown>;
  };
  REINDEX_KEY?: string;
}

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5'; // 768-dim; must match the index
const CHUNK_CHARS = 900;
const MAX_CHUNKS_PER_ITEM = 6;

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.VEC || !env.AI) {
    return json({ error: 'bindings_missing', message: 'VEC (Vectorize) and AI (Workers AI) bindings are required.' }, 503);
  }
  const url = new URL(request.url);
  if (!env.REINDEX_KEY || url.searchParams.get('key') !== env.REINDEX_KEY) {
    return json({ error: 'forbidden', message: 'Valid ?key= required (REINDEX_KEY secret).' }, 403);
  }

  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 15, 1), 40);
  const origin = url.origin;

  const idxRes = await env.ASSETS.fetch(new URL('/agent-index.json', origin).toString());
  if (!idxRes.ok) return json({ error: 'no_index', message: '/agent-index.json unavailable' }, 500);
  // Leaves only: they render as clean markdown via /api/context. Briefings
  // (fetch===null) need full-HTML fetch+strip which is CPU-heavy at the edge —
  // deferred to a later pass. Hubs are navigation, not content.
  const items = ((await idxRes.json()) as { items: IndexItem[] }).items.filter((it) => it.kind === 'leaf' && it.fetch);

  const slice = items.slice(offset, offset + limit);
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = [];
  let processed = 0;

  for (const it of slice) {
    processed++;
    try {
      const raw = await fetchText(it, origin);
      if (!raw) continue;
      const chunks = chunk(raw, it.title).slice(0, MAX_CHUNKS_PER_ITEM);
      if (!chunks.length) continue;
      const out = await env.AI.run(EMBED_MODEL, { text: chunks });
      const embeds = out.data as number[][];
      chunks.forEach((text, i) => {
      if (!embeds[i]) return;
      vectors.push({
        id: `${it.fetch || it.url}::${i}`,
        values: embeds[i],
        metadata: {
          path: it.fetch || '',
          title: cleanTitle(it.title),
          url: it.url,
          domain: it.domain,
          kind: it.kind,
          text: text.slice(0, 480),
        },
      });
      });
    } catch {
      /* skip this item, keep going */
    }
  }

  let upserted = 0;
  if (vectors.length) {
    try {
      await env.VEC.upsert(vectors);
      upserted = vectors.length;
    } catch (e) {
      return json({ error: 'upsert_failed', message: (e as Error).message, processed }, 502);
    }
  }

  const nextOffset = offset + slice.length;
  return json({ processed, upserted, nextOffset, total: items.length, done: nextOffset >= items.length });
};

// --- helpers ---------------------------------------------------------------

interface IndexItem {
  title: string;
  description: string;
  domain: string;
  kind: 'hub' | 'leaf' | 'briefing';
  url: string;
  fetch: string | null;
}

async function fetchText(it: IndexItem, origin: string): Promise<string> {
  // Leaves render as clean markdown via /api/context; briefings are fetched
  // as HTML and stripped. Fall back to the index description.
  try {
    if (it.fetch) {
      const r = await fetch(new URL(`/api/context/${it.fetch}`, origin).toString());
      if (r.ok) {
        const t = await r.text();
        if (!/<html/i.test(t.slice(0, 200))) return strip(t);
      }
    } else {
      const r = await fetch(it.url);
      if (r.ok) return strip(await r.text());
    }
  } catch {
    /* fall through */
  }
  return it.description || '';
}

function strip(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/data:[^\s)"'<>]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunk(text: string, title: string): string[] {
  const paras = text.split(/\n{2,}|(?<=\.) (?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + ' ' + p).length > CHUNK_CHARS && buf) {
      out.push(`${title} — ${buf}`.trim());
      buf = p;
    } else {
      buf = buf ? `${buf} ${p}` : p;
    }
  }
  if (buf) out.push(`${title} — ${buf}`.trim());
  return out;
}

function cleanTitle(t: string): string {
  return t.replace(/\s*&mdash;.*$/, '').replace(/\s*—.*$/, '').trim();
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  });
}
