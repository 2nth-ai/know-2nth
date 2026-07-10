#!/usr/bin/env node
// scripts/gen-agent-index.mjs
//
// Generates the agent-discovery artifacts for know.2nth.ai from the static HTML:
//   - agent-index.json  — machine index the MCP server (functions/mcp.ts) searches
//   - llms.txt          — the emerging standard: a plain-text index for AI clients
//
// Source of truth stays the HTML. Re-run this whenever leaves/briefings are
// added or removed:
//   node scripts/gen-agent-index.mjs
//
// Phase 0 of the agent-surface plan. In Phase 1 this runs in CI before deploy so
// the index can never drift; for now it's a committed artifact.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, basename, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = 'https://know.2nth.ai';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function meta(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function decode(s) {
  return s
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&times;/g, '×').replace(/&hellip;/g, '…')
    .replace(/&rarr;/g, '→').replace(/\s+/g, ' ').trim();
}

const files = [
  ...walk(join(ROOT, 'explainers')),
  ...walk(join(ROOT, 'briefings')),
];

const items = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/'); // e.g. explainers/tech/microsoft/dataverse.html
  const html = readFileSync(file, 'utf8');

  const title = decode(meta(html, /<title>([\s\S]*?)<\/title>/));
  const description = decode(meta(html, /<meta\s+name="description"\s+content="([^"]*)"/));
  const canonical = meta(html, /<meta\s+property="og:url"\s+content="([^"]+)"/);

  const isBriefing = rel.startsWith('briefings/');
  const isHub = basename(rel) === 'index.html';

  // Skip the briefings hub and any bare section indexes with no useful metadata.
  if (isBriefing && isHub) continue;
  if (!title) continue;

  let domain, kind, fetchPath, url;
  if (isBriefing) {
    domain = 'briefings';
    kind = 'briefing';
    const slug = rel.replace(/^briefings\//, '').replace(/\.html$/, '');
    url = canonical || `${SITE}/briefings/${slug}`;
    fetchPath = null; // briefings are the plain-language layer; fetch by URL
  } else {
    // explainers/<domain>/<...>.html
    const inner = rel.replace(/^explainers\//, '');
    domain = inner.split('/')[0];
    if (isHub) {
      kind = 'hub';
      fetchPath = inner.replace(/\/index\.html$/, ''); // e.g. tech/microsoft
      url = canonical || `${SITE}/explainers/${fetchPath}/`;
    } else {
      kind = 'leaf';
      fetchPath = inner.replace(/\.html$/, ''); // e.g. tech/microsoft/dataverse
      url = canonical || `${SITE}/explainers/${fetchPath}`;
    }
  }

  items.push({ title, description, domain, kind, url, fetch: fetchPath });
}

// Stable order: domain, then hub first, then title.
const kindRank = { hub: 0, leaf: 1, briefing: 2 };
items.sort((a, b) =>
  a.domain.localeCompare(b.domain) ||
  (kindRank[a.kind] - kindRank[b.kind]) ||
  a.title.localeCompare(b.title));

// ---- agent-index.json ----
const index = {
  site: SITE,
  description:
    'The public knowledge tree for the 2nth.ai ecosystem. Every leaf is both a ' +
    'human-readable reference and an agent-consumable context document.',
  agent_fetch: `${SITE}/api/context/<domain>/<leaf>`,
  mcp: `${SITE}/mcp`,
  count: items.length,
  items,
};
writeFileSync(join(ROOT, 'agent-index.json'), JSON.stringify(index, null, 2) + '\n');

// ---- llms.txt ----
const byDomain = new Map();
for (const it of items) {
  if (it.kind === 'briefing') continue;
  if (!byDomain.has(it.domain)) byDomain.set(it.domain, []);
  byDomain.get(it.domain).push(it);
}
const briefings = items.filter((i) => i.kind === 'briefing');

const lines = [];
lines.push('# know.2nth.ai');
lines.push('');
lines.push('> The public knowledge tree for the 2nth.ai ecosystem — explainer "leaves" grouped under top-level domains. Every leaf is both a human-readable reference and an agent-consumable context document. Anti-hype, honest decision guides, South African delivery context.');
lines.push('');
lines.push(`Agent access: append any leaf path to \`/api/context/\` for clean markdown (e.g. \`${SITE}/api/context/agents/glm\`). A remote MCP server is available at \`${SITE}/mcp\` (tools: search_tree, list_domains, get_leaf).`);
lines.push('');

const domainNames = [...byDomain.keys()].sort();
for (const domain of domainNames) {
  const rows = byDomain.get(domain);
  const hub = rows.find((r) => r.kind === 'hub');
  const heading = domain.charAt(0).toUpperCase() + domain.slice(1);
  lines.push(`## ${heading}`);
  lines.push('');
  if (hub) lines.push(`- [${hub.title}](${hub.url})${hub.description ? ': ' + hub.description : ''}`);
  for (const r of rows.filter((r) => r.kind === 'leaf')) {
    lines.push(`- [${r.title}](${r.url})${r.description ? ': ' + r.description : ''}`);
  }
  lines.push('');
}

if (briefings.length) {
  lines.push('## CEO Briefings');
  lines.push('');
  lines.push('Plain-language, decision-framed companions to the technical leaves.');
  lines.push('');
  for (const b of briefings) {
    lines.push(`- [${b.title}](${b.url})${b.description ? ': ' + b.description : ''}`);
  }
  lines.push('');
}

writeFileSync(join(ROOT, 'llms.txt'), lines.join('\n'));

const counts = items.reduce((m, i) => ((m[i.kind] = (m[i.kind] || 0) + 1), m), {});
console.log(`agent-index.json + llms.txt written: ${items.length} items`, counts);
