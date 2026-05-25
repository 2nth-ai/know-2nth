// functions/api/context/[[path]].ts
//
// Agent-fetch surface for know.2nth.ai leaves.
//
// GET /api/context/<domain>/<leaf>
//   Returns a markdown rendering of the leaf at /explainers/<domain>/<leaf>.html.
//   Drops the inline CSS, nav, footer, scripts and theme-toggle/observer JS —
//   roughly 70-80% token reduction vs the raw HTML.
//
// GET /api/context/<domain>
//   Returns markdown for /explainers/<domain>/index.html (the domain hub).
//
// GET /api/context/
//   Usage help.
//
// Same source-of-truth as the HTML — no markdown is committed to the repo,
// everything is converted on the fly from the static HTML the human site
// already serves.

interface Env {
  ASSETS: Fetcher;
}

const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'accept, content-type',
};

const helpText = `know.2nth.ai — agent-fetch API
================================

Agent-friendly markdown rendering of the knowledge tree.

USAGE
  GET /api/context/<domain>/<leaf>     → markdown of /explainers/<domain>/<leaf>.html
  GET /api/context/<domain>            → markdown of /explainers/<domain>/index.html

EXAMPLES
  /api/context/media/elevenlabs
  /api/context/media/landscape
  /api/context/media/voice-agents
  /api/context/agents/coding-cli-agents
  /api/context/agents/adk-vs-langgraph
  /api/context/tools/architecture
  /api/context/tools/runtime

RESPONSE
  text/markdown; charset=utf-8 with YAML frontmatter
    title:        from <title>
    description:  from <meta name="description">
    source:       canonical HTML URL (from og:url)
    reviewed:     "Last reviewed:" date from the footer
    format:       agent-markdown

CACHING
  cache-control: public, max-age=3600, s-maxage=3600

The same content is also browsable as HTML at https://know.2nth.ai/explainers/<path>.
This endpoint exists so AI agents can fetch the content without paying
for HTML chrome (CSS, nav, footer, scripts) — typically a 70-80% token
reduction.
`;

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const raw = params.path;
  const segments: string[] = Array.isArray(raw) ? raw : (raw ? [raw as string] : []);

  if (segments.length === 0) {
    return new Response(helpText, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders },
    });
  }

  const path = segments.join('/');
  const url = new URL(request.url);

  // Try the obvious candidate paths in order.
  const candidates = [
    `/explainers/${path}.html`,
    `/explainers/${path}/index.html`,
    `/explainers/${path}/`,
  ];

  let html: string | null = null;
  let sourcePath = '';

  for (const candidate of candidates) {
    const r = await env.ASSETS.fetch(new Request(new URL(candidate, url.origin).toString()));
    if (r.ok) {
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        html = await r.text();
        sourcePath = candidate;
        break;
      }
    }
  }

  if (!html) {
    const body =
      `Leaf not found: ${path}\n\n` +
      `Tried:\n${candidates.map(c => '  ' + c).join('\n')}\n\n` +
      `Usage: /api/context/<domain>/<leaf>\n` +
      `Example: /api/context/media/elevenlabs\n`;
    return new Response(body, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders },
    });
  }

  const markdown = htmlToMarkdown(html, sourcePath);

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
      'x-source-html': sourcePath,
      ...corsHeaders,
    },
  });
};

// -----------------------------------------------------------------------------
// HTML → markdown conversion
//
// Regex-based, not a full HTML parser. Works because the leaves on this tree
// follow a predictable structure (the patterns in CLAUDE.md). If the markup
// drifts from that shape, this converter degrades gracefully — output stays
// readable, just less polished.
// -----------------------------------------------------------------------------

function htmlToMarkdown(html: string, sourcePath: string): string {
  // ---- frontmatter ----
  const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim());
  const description = decodeEntities((html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1] ?? '').trim());
  const canonical = (html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/)?.[1] ?? '').trim();
  const reviewed = (html.match(/Last reviewed:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? '').trim();

  // ---- isolate body ----
  let body = html;
  const bodyMatch = body.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // ---- strip chrome ----
  body = body.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<nav\b[\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<footer\b[\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<div\s+class="glow-orb[^"]*"\s*><\/div>/gi, '');
  // breadcrumb wrapper
  body = body.replace(/<div\s+class="container">\s*<div\s+class="crumb">[\s\S]*?<\/div>\s*<\/div>/gi, '');

  // ---- block-level conversions (do tables first; then headings; then lists; then paragraphs) ----
  body = body.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, t) => convertTable(t));

  body = body.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n\n# ${inline(c)}\n`);
  body = body.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n\n## ${inline(c)}\n`);
  body = body.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n\n### ${inline(c)}\n`);
  body = body.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n\n#### ${inline(c)}\n`);

  // The "01 · X" eyebrow/section-label divs and hub-labels — render as bold
  body = body.replace(
    /<div\s+class="(?:section-label|hub-label)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (_, c) => `\n\n**${inline(c)}**\n`,
  );

  // Lists
  body = body.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) => {
    const items = c.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) =>
      `- ${inline(li).trim()}\n`,
    );
    return `\n${items}\n`;
  });

  body = body.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
    let n = 0;
    const items = c.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => {
      n += 1;
      return `${n}. ${inline(li).trim()}\n`;
    });
    return `\n${items}\n`;
  });

  // Preformatted blocks (ASCII diagrams etc.)
  body = body.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
    return '\n\n```\n' + stripAll(c) + '\n```\n';
  });

  // Paragraphs
  body = body.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `\n${inline(c).trim()}\n`);

  // Inline anchor conversion (do before generic tag strip below)
  body = body.replace(
    /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => `[${stripAll(text)}](${href})`,
  );

  // Strip wrapper tags that remain (div, section, span, article, main, header)
  body = body.replace(/<\/?(?:div|section|article|span|main|header)\b[^>]*>/gi, '');

  // Inline cleanups (entities) on any text still in the doc
  body = decodeEntities(body);

  // Whitespace cleanup
  body = body
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ---- assemble ----
  const fmLines: string[] = ['---'];
  if (title) fmLines.push(`title: ${yamlStr(title)}`);
  if (description) fmLines.push(`description: ${yamlStr(description)}`);
  if (canonical) fmLines.push(`source: ${yamlStr(canonical)}`);
  if (reviewed) fmLines.push(`reviewed: ${reviewed}`);
  fmLines.push(`source_html: ${sourcePath}`);
  fmLines.push(`format: agent-markdown`);
  fmLines.push('---');
  fmLines.push('');

  return fmLines.join('\n') + body + '\n';
}

function inline(html: string): string {
  let s = html;
  // anchors
  s = s.replace(
    /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => `[${stripAll(text)}](${href})`,
  );
  // strong / b
  s = s.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  // em / i
  s = s.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  // code
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + stripAll(c) + '`');
  // remove any remaining tags
  s = stripAll(s);
  return s;
}

function stripAll(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&middot;/g, '·')
    .replace(/&hellip;/g, '…')
    .replace(/&rarr;/g, '→')
    .replace(/&larr;/g, '←')
    .replace(/&rsaquo;/g, '›')
    .replace(/&lsaquo;/g, '‹')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&times;/g, '×')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x1F512;/g, '🔒')
    .replace(/&#x1F319;/g, '🌙');
}

function convertTable(tableHtml: string): string {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(trMatch[1])) !== null) {
      const value = inline(cellMatch[2])
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
        .trim();
      cells.push(value || ' ');
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return '';

  // Normalise column count — every row gets max-cols by padding with blanks
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const row of rows) {
    while (row.length < maxCols) row.push(' ');
  }

  let md = '\n\n';
  md += `| ${rows[0].join(' | ')} |\n`;
  md += `| ${rows[0].map(() => '---').join(' | ')} |\n`;
  for (let i = 1; i < rows.length; i += 1) {
    md += `| ${rows[i].join(' | ')} |\n`;
  }
  md += '\n';
  return md;
}

function yamlStr(s: string): string {
  if (/[:#\n"]/.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}
