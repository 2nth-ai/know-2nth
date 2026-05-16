# CLAUDE.md — know.2nth.ai

## What this is

**know.2nth.ai** is the public knowledge tree for the 2nth.ai ecosystem — a static HTML portal of explainer "leaves" grouped under top-level domains. Every leaf is both a human-readable reference and an agent-consumable context document.

Sibling sites in the ecosystem:
- **2nth.ai** — framework / GTM site (Human + AI = 2ⁿ)
- **dev.2nth.ai** — partner / Gridline / openBUILD AI source content (Construction domain pulls from here)
- **2nth.io** — compute infrastructure layer
- **imbila.ai** — parent consultancy brand

### Related repos that are NOT this one

- **`github.com/2nth-ai/skills`** — the agent-facing skills repo with `SKILL.md` files that Penny / Grant / Leo / Eric load at runtime. Different consumer (agents, not humans), different artefact (markdown with YAML frontmatter, not HTML). The legacy public rendering of those files was `skills.2nth.ai` (project `2nth-skills-hub` on Cloudflare) — **that UI is being phased out;** know.2nth.ai is the canonical public surface for the ecosystem now. Don't publish human-facing content to `skills.2nth.ai`.

## Repo & deploy

- **GitHub**: `2nth-ai/know-2nth` (default branch `main`)
- **Hosting**: Cloudflare Pages, project `know-2nth`, custom domain `know.2nth.ai`
- **Deploy is automated** via GitHub Actions:
  - **Preview** — every PR against `main` auto-deploys to `<branch-slug>.know-2nth.pages.dev` and the workflow comments the URL on the PR
  - **Dev** — every push to the `dev` branch auto-deploys to `dev.know-2nth.pages.dev` (stable accumulator URL for multi-piece review; no custom domain, by design — `dev.know.2nth.ai` was deferred because the Cloudflare custom-domain wizard doesn't expose branch selection)
  - **Production** — every push to `main` (every PR merge) auto-deploys to `know.2nth.ai`
- **Workflows**: `.github/workflows/preview-deploy.yml`, `.github/workflows/deploy-dev.yml`, `.github/workflows/deploy-production.yml`
- **Required secrets** (set once in GitHub repo settings → Secrets and variables → Actions):
  - `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages:Edit permission for the `know-2nth` project
  - `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID hosting the project
- **All three workflows pass `--commit-message="<ASCII string>"` explicitly.** This is load-bearing. Cloudflare's deployments API rejects non-ASCII commit messages (em-dashes, middle-dots, curly quotes, arrows — all things that appear regularly in PR titles) with error code `8000111`. Without an explicit message, wrangler reads HEAD's raw commit and fails on otherwise-clean PRs. Don't remove these flags.
- **Manual escape hatch** (if CI is broken or for a one-off ad-hoc deploy): `npx wrangler pages deploy . --project-name=know-2nth --branch=main --commit-message="Manual deploy"`

### URL summary

| URL | Branch | Use |
|---|---|---|
| `https://know.2nth.ai` | main | Production (canonical) |
| `https://know-2nth.pages.dev` | main | Same content as canonical, no Cloudflare edge transformations (useful for debugging email-obfuscation diffs, etc.) |
| `https://dev.know-2nth.pages.dev` | dev | Staging accumulator for multi-piece review |
| `https://<branch-slug>.know-2nth.pages.dev` | feature | Per-PR preview (slug truncated to 28 chars) |

## Repo layout

```
know-2nth/
├── CLAUDE.md
├── index.html                # root: 12 top-level domain cards
├── about.html                # access model + how the site works
├── join.html                 # HubSpot signup form (soft conversion play)
├── gate.js                   # tier-gate hook, loaded on every leaf, currently inert
├── og-image.jpg              # 1200×630 OG / Twitter card
├── og-image.svg              # source for the OG image
├── _redirects                # Cloudflare Pages redirects
├── google-adk-explainer.md   # canonical source markdown for ADK leaf (PR #17)
└── explainers/
    ├── agents/        # Frameworks, Protocols, Models, Inference (the strategic priority)
    ├── biz/           # ERP, CRM, HR — has erp/ and crm/ sub-hubs
    ├── construction/  # openBIM + Gridline / openBUILD AI partner-anchored
    ├── data/          # analytics/, warehousing/, engineering/ sub-hubs
    ├── design/        # tokens, components, motion, AI-assisted design
    ├── partners/      # co-branded leaves (no hub yet, not on root grid)
    ├── people/        # coaching, leadership, typologies/
    └── tech/          # cloudflare/, google/, microsoft/, frappe/, runtime/, android-hce/, embedded/, frameworks/
```

Five additional domains exist on the root grid as cards but have **no folder yet**: `edu`, `fin`, `health`, `iot`, `leg`. Building any of them out means: create `explainers/<domain>/index.html` hub, ship at least one Live leaf, then the root card becomes meaningful.

## How leaves are built

- **Static HTML, no build step, no framework.** Every leaf is a self-contained `.html` with its CSS duplicated inline at the top. Deliberate — keeps each leaf independent and editable directly.
- **To author a new leaf**: copy a similar existing leaf as a template, then rewrite the body. Examples by type:
  - Framework topic → `explainers/agents/langgraph.html`
  - Model topic → `explainers/agents/claude.html`
  - Inference / serving → `explainers/agents/vllm.html`
  - Cloud product → `explainers/tech/cloudflare/workers.html`
- **Leaf section pattern** (7–9 numbered sections, varies by topic):
  - `01 · What it is` — definition, problem solved
  - `02 · How it works` / `vs alternatives` — concepts, comparison
  - `03–05 · Ecosystem / Use cases / Pricing reality` — domain-appropriate
  - `0N · Decision guide` — use when / skip when
  - `0N · South African context` — SA delivery framing
  - `0N · Connections` — links elsewhere in the tree
  - `0N · Resources` — primary sources only
- **Section labels**: JetBrains Mono, 11px, uppercase, 2px letter-spacing, sky colour. Format: `01 · Section name`.

## Hubs and stubs

Hubs (`explainers/<domain>/index.html` and sub-hubs) list their leaves as cards. Two patterns coexist:

- `svc-card` / `svc-card soon` — used by `agents`, `tech/*`, `construction`, `design`
- `hub-card` / `leaf-card` (with `soon` variant) — used by `biz`, `data`, `people`, `tech` (root)

Both work; pick whichever the surrounding hub uses. **Stubs use the `soon` modifier**; flipping a stub to Live = swap `<div class="…-card soon">` for `<a href="…" class="…-card">`. After flipping, bump any "N Live" count in the hub heading and on the matching root domain card.

## Design system

### Fonts (loaded from Google Fonts)
- **Outfit** — body, headings (300, 400, 500, 600, 700, 800)
- **JetBrains Mono** — code, labels, badges, nav brand

### Theme
- Dark mode is default (`data-theme="dark"`)
- Light mode toggle persists via localStorage
- All colours come from CSS custom properties — never hardcode hex in body markup. Define new tokens at `:root` if needed.

### Colour tokens (in `:root`)
| Token | Value | Used for |
|---|---|---|
| `--ink` | `#0B1120` | page bg (dark) |
| `--ink-deep` | `#060A14` | code-block bg |
| `--navy` | `#121D33` | raised surfaces |
| `--blue` / `--blue-glow` | `#2563EB` / `#3B82F6` | primary accent (tech) |
| `--sky` / `--sky-muted` | `#38BDF8` / `#7DD3FC` | secondary accent (data) |
| `--paper` / `--mist` / `--slate` | `#F8FAFC` / `#E2E8F0` / `#94A3B8` | text on dark |
| `--green` (+ `--green-soft`) | `#10B981` | fin / success |
| `--warm` (+ `--warm-soft`) | `#F59E0B` | biz / edu |
| `--violet` (+ `--violet-soft`) | `#8B5CF6` | health / design |
| `--rose` (+ `--rose-soft`) | `#F43F5E` | leg / people |

### Domain → accent mapping (root index)
| Domain | Accent |
|---|---|
| tech | `--blue` |
| biz, edu | `--warm` |
| data, iot | `--sky` |
| fin | `--green` |
| leg, people | `--rose` |
| health, design | `--violet` |
| construction | `#EA580C` (custom orange) |
| agents | `#6366F1` (custom indigo) |

### Component patterns
- **Cards**: `var(--bg-card)` background, `backdrop-filter: blur(10px)`, 1px border, 20px radius (`--radius-lg`), hover lift + border glow.
- **Pills / badges**: JetBrains Mono, 10–11px, pill radius (`--radius-pill: 100px`), domain-coloured background.
- **Buttons**: Outfit, pill radius. Primary = blue→sky gradient. Ghost = transparent + 1px border.
- **Fade-in**: `.fade-up` with IntersectionObserver, ~24px translate, 0.6s ease.

## Tier-gating: currently inert

Per PR #15, **all content is open**. `gate.js` is loaded on every leaf (~95 files) but does nothing because no element on the site carries `data-tier="member"`. The hook is wired to set a `2nth-know-member` localStorage flag on successful HubSpot form submit (typically from `/join.html`).

**Don't add new `data-tier="member"` attributes when authoring leaves** — they will silently do nothing now and create cleanup work later. Re-gating is a Phase 2 decision tied to magic-link auth; until then, the conversion play is the `/join` form for tracking who's reading.

## Voice

Same voice system as imbila.ai:
- Sharp, experienced colleague — not a corporate brochure
- Anti-hype: no "cutting-edge", "revolutionary", "paradigm shift"
- Honest decision guides — tell people when NOT to use the technology
- South African voice — natural, not performative
- Technical depth without jargon gatekeeping
- Sources-validated: cite primary sources only in the Resources section

## Daily workflow

The shipping pattern from the PR #17–#25 batch is **one git worktree per feature**, off `origin/main`, so the main checkout stays clean and multiple Claude Code terminals can run different features in parallel without colliding.

```bash
# From the main checkout, on main
git fetch origin main
git worktree add ../know-2nth-<short> -b chore/<feature> origin/main
cd ../know-2nth-<short>

# Work, commit specific files (avoid -A — keeps secrets out)
git add explainers/<path>/<file>.html
git commit -m "Author <topic> leaf"
git push -u origin chore/<feature>

# Open the PR — CI auto-deploys a preview to <branch-slug>.know-2nth.pages.dev
# and posts the URL as a PR comment. Review the preview, then merge.
gh pr create --base main --head chore/<feature> --title "…" --body "…"
gh pr merge <PR#> --squash --delete-branch

# On merge: CI auto-deploys main → know.2nth.ai. No manual wrangler step needed.

# Clean up the worktree
cd ../know-2nth          # or wherever the main checkout lives on this Mac
git worktree remove ../know-2nth-<short>
git branch -D chore/<feature>
git pull origin main
```

The local path of the main checkout varies per machine. On the primary Mac it's `~/2nth/know.2nth`; the `know-2nth-setup.html` reference doc at the repo's parent directory documents the canonical setup for that machine.

## Common operations

- **Add a leaf to an existing domain**: copy a similar leaf → rewrite hero + sections + meta → flip the matching `soon` card on the domain hub to Live → bump Live count on the hub and on the root domain card if shown → worktree → PR → merge → deploy.
- **Add a new top-level domain**: pick a unique colour + emoji → add CSS rule for `.domain-card[data-domain="X"]` in root `index.html` → add the card to `.domains-grid` → bump "N domains" count in the section title → build `explainers/X/index.html` hub → ship at least one Live leaf so the domain isn't empty on launch.
- **Author from source markdown**: when a `*-explainer.md` file lands in the repo root (like `google-adk-explainer.md`), it's the canonical source — mine it for the rendered HTML leaf and preserve the primary-source-only discipline.
- **OG / Twitter meta sweep**: every leaf needs the standard `og:title / og:description / og:image / twitter:card / twitter:title / twitter:description / twitter:image` block. The site's OG image is `/og-image.jpg` (source: `/og-image.svg`).

## Pre-deploy sanity check

```bash
git pull origin main && git log --oneline -3 && git status --short
```

Confirm latest commit is the one just merged, working tree is clean, on `main`. Then `npx wrangler pages deploy …`.

## What's NOT in this repo

- The other 2nth-ai sites (`2nth.ai`, `dev.2nth.ai`, `agents.2nth.ai`, `clients.2nth.ai`, `skills.2nth.ai`, `2nth-skills.pages.dev`) are separate repos with their own deploy flows.
- There is no agent-context API (`/api/context/…`) and no Workers in this repo. If a structured-export endpoint is added later, document it here.
