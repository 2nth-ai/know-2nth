// functions/api/ask.ts
//
// "Ask Vince" — the on-site AI assistant for know.2nth.ai.  Phase 1 PoC on the
// Cloudflare edge AI stack: Workers AI (LLM inference) grounded in the
// knowledge tree via the same retrieval the MCP server uses.
//
//   POST /api/ask  { "question": "...", "history"?: [{role, content}, ...] }
//   → { answer, sources: [{ title, path, url }], model }
//
// Flow (all on-network, no data leaves Cloudflare — a clean POPIA story):
//   1. keyword-retrieve the most relevant leaves from /agent-index.json
//      (identical scoring to functions/mcp.ts search_tree)
//   2. fetch those leaves as clean markdown via the existing /api/context
//      converter (same-origin subrequest)
//   3. ask a Workers AI text model to answer ONLY from that context, in the
//      2nth voice, citing the leaves it used
//
// Deliberately grounded: the model is told to refuse rather than invent when
// the answer isn't in the retrieved leaves — a knowledge base can't hallucinate.
//
// PREREQUISITE (one-time, account-level): the `know-2nth` Pages project needs a
// Workers AI binding named `AI` (Dashboard → Settings → Bindings → Workers AI,
// or `wrangler pages` config). Until it's set, this endpoint returns a clear
// 503 explaining the missing binding rather than a 500.
//
// Phase 2 will swap step 1's keyword scoring for semantic retrieval
// (AutoRAG / AI Search over Vectorize); step 3 stays the same. Phase 3 adds
// stateful multi-turn memory via the Agents SDK (Durable Objects).

interface Env {
  ASSETS: Fetcher;
  // Workers AI binding. Loosely typed to avoid a hard dep on workers-types.
  AI?: { run: (model: string, input: unknown) => Promise<{ response?: string } & Record<string, unknown>> };
}

// The edge LLM. Llama 3.3 70B (fp8, fast) is the safe, well-supported default.
// One-line swaps to test others: '@cf/z-ai/glm-4.7-flash' (131K ctx, our GLM
// leaf's model), '@cf/meta/llama-4-scout-17b-16e-instruct' (multimodal).
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const RETRIEVE = 3;      // leaves fed to the model as grounding context
const PER_LEAF_CHARS = 3500; // truncate each leaf so several fit the window

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async () =>
  new Response(
    `Ask Vince — know.2nth.ai on-site assistant (Cloudflare Workers AI).\n\n` +
      `POST JSON to this URL: { "question": "..." }\n` +
      `Returns a grounded answer + the leaves it cited.\n` +
      `Model: ${MODEL}. Human site: https://know.2nth.ai\n`,
    { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', ...cors } },
  );

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.AI) {
    return json(
      {
        error: 'workers_ai_unbound',
        message:
          'The Workers AI binding "AI" is not configured on this Pages project. ' +
          'Add it in Dashboard → Settings → Bindings → Workers AI, then redeploy.',
      },
      503,
    );
  }

  let body: { question?: string; history?: { role: string; content: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json', message: 'POST a JSON body with a "question" field.' }, 400);
  }

  const question = (body.question || '').trim();
  if (!question) return json({ error: 'no_question', message: 'Provide a "question".' }, 400);
  if (question.length > 800) return json({ error: 'too_long', message: 'Keep questions under 800 characters.' }, 400);

  const origin = new URL(request.url).origin;

  // 1 · retrieve the most relevant leaves
  const hits = await retrieve(question, env, origin);
  if (hits.length === 0) {
    return json({
      answer:
        "I couldn't find anything in the know.2nth.ai tree that matches that. " +
        'Try different keywords, or browse the domains at https://know.2nth.ai.',
      sources: [],
      model: MODEL,
    });
  }

  // 2 · fetch each hit as clean markdown (reusing the /api/context converter)
  const context: string[] = [];
  const sources: { title: string; path: string; url: string }[] = [];
  for (const it of hits) {
    const md = it.fetch ? await fetchLeaf(it.fetch, env, origin) : null;
    const excerpt = (md || it.description).slice(0, PER_LEAF_CHARS);
    context.push(`### ${cleanTitle(it.title)}  (${it.domain} · ${it.url})\n${excerpt}`);
    sources.push({ title: cleanTitle(it.title), path: it.fetch || it.url, url: it.url });
  }

  // 3 · ground the model and generate
  const system =
    "You are Vince, the guide to know.2nth.ai — the 2nth.ai ecosystem's public knowledge tree of " +
    'technology explainers with a South African delivery slant. Voice: a sharp, experienced colleague — ' +
    'anti-hype, specific, honest about tradeoffs. No "revolutionary", "game-changing", "seamless".\n\n' +
    'Answer the user ONLY from the CONTEXT leaves below. If the answer is not in the context, say so ' +
    'plainly and point them to the closest leaf — never invent facts, numbers, or leaves. Keep it tight ' +
    '(a few sentences to a short paragraph). When you draw on a leaf, name it, e.g. "the agents/deep-agents leaf". ' +
    'End with a short line: the single best leaf to read next.';

  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
  const messages = [
    { role: 'system', content: system },
    ...history.filter((h) => h && h.role && h.content).map((h) => ({ role: h.role, content: String(h.content) })),
    { role: 'user', content: `CONTEXT:\n\n${context.join('\n\n---\n\n')}\n\nQUESTION: ${question}` },
  ];

  let answer: string;
  try {
    const out = await env.AI.run(MODEL, { messages, max_tokens: 700, temperature: 0.3 });
    answer = (out.response || '').trim() || 'No answer generated.';
  } catch (e) {
    return json({ error: 'inference_failed', message: (e as Error).message, sources }, 502);
  }

  return json({ answer, sources, model: MODEL });
};

// --- retrieval (mirrors functions/mcp.ts search_tree) -----------------------

interface IndexItem {
  title: string;
  description: string;
  domain: string;
  kind: 'hub' | 'leaf' | 'briefing';
  url: string;
  fetch: string | null;
}

async function retrieve(query: string, env: Env, origin: string): Promise<IndexItem[]> {
  const r = await env.ASSETS.fetch(new URL('/agent-index.json', origin).toString());
  if (!r.ok) return [];
  const items = ((await r.json()) as { items: IndexItem[] }).items;
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  return items
    .map((it) => {
      const title = it.title.toLowerCase();
      const desc = it.description.toLowerCase();
      const dom = it.domain.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        if (dom.includes(t)) score += 2;
        if (desc.includes(t)) score += 1;
      }
      // prefer readable leaves over hubs as grounding
      if (it.kind === 'leaf') score += 0.5;
      return { it, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RETRIEVE)
    .map((s) => s.it);
}

async function fetchLeaf(path: string, env: Env, origin: string): Promise<string | null> {
  try {
    const r = await env.ASSETS.fetch(new URL(`/api/context/${path}`, origin).toString());
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
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
