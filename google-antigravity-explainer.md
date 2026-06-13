---
title: "Google Antigravity — Agent-First Development Platform"
node: factory/agents/google-antigravity
audience: [human, agent]
status: validated
date_validated: 2026-06-13
primary_sources_checked: 6
mcp_surface: yes
license_note: "Antigravity SDK is a Research Preview shipping a compiled runtime binary; the public GitHub repo is not standalone-runnable. Not OSI open source."
correction_log:
  - "Source draft said 'Anti-gravity' — correct name is 'Antigravity' (one word, no hyphen)."
  - "Source draft said agent powered by 'Gemini Flash' — the I/O 2026 ecosystem and Managed Agents run on Gemini 3.5 Flash; Antigravity IDE/2.0 also offer Gemini 3 Pro, Claude Sonnet 4.5, and GPT-OSS."
  - "Source draft named '/btw' CLI command and 'Turbo Mode' — these are not present in Google's primary documentation and are treated as unverified; removed."
  - "Source draft described the SDK as freely packageable in 'fewer than a couple hundred lines' — accurate in spirit (quickstart is ~6 lines), but the SDK depends on a compiled binary installed from PyPI, not the open repo alone."
  - "Source draft listed four surfaces (2.0, IDE, CLI, SDK). The I/O 2026 expansion actually spans 2.0, CLI, SDK, and Antigravity in Gemini Enterprise Agent Platform; the IDE/Editor View remains a mode within the platform."
---

# Google Antigravity

> **Factory node:** `factory/agents/google-antigravity` · agents space
> **One line:** Google's agent-first development platform — autonomous agents that plan, execute, and verify software tasks across editor, terminal, browser, and cloud, exposed through a desktop app, CLI, and a Python SDK with native MCP support.

---

## 01 · What Is Antigravity

Antigravity is Google's agent-first development platform, launched in public preview in **November 2025** and expanded into a full ecosystem at **Google I/O 2026 (19 May 2026)**. Rather than treating AI as autocomplete in a sidebar, it gives agents their own workspace to plan and run end-to-end tasks across the editor, terminal, and browser, with human feedback at key decision points.

The original IDE shipped as a fork of Visual Studio Code with two interaction modes — a synchronous **Editor View** (familiar IDE, tab completion, inline commands) and an asynchronous **Manager** surface for orchestrating agents. The platform treats learning as a core primitive: agents save useful context and code snippets to a knowledge base to improve future tasks.

```
Idea  →  [ Agent plans ]  →  [ executes across editor / terminal / browser ]  →  [ verifies ]  →  Production app
                ↑__________________ human feedback at decision points __________________↑
```

---

## 02 · Why It Matters

- **Public preview is free for individuals**, cross-platform (macOS, Windows, Linux), with model optionality.
- **Model optionality**: generous rate limits on Gemini 3 Pro, plus full support for Anthropic's Claude Sonnet 4.5 and OpenAI's GPT-OSS in the IDE.
- **Managed Agents** in the Gemini API: a single API call spins up an agent that reasons, uses tools, and executes code in an isolated Linux environment — powered by the Antigravity agent harness on **Gemini 3.5 Flash**.
- **Gemini 3.5 Flash** (launched at I/O 2026) is positioned as outperforming Gemini 3.1 Pro on almost all benchmarks while running roughly 4× faster — the speed engine for real-world agentic loops.

---

## 03 · How It Works — The I/O 2026 Ecosystem

The 2026 expansion gives four ways to interact with Antigravity, all driven by the same agent harness:

**1. Antigravity 2.0 — standalone desktop command center.**
A central home for agent interaction: orchestrate multiple agents in parallel, dynamic subagents for parallelised workflows, scheduled tasks (cron-style sidecars) for background automation, and ecosystem integrations across Google AI Studio, Android, and Firebase.

**2. Antigravity CLI — terminal surface.**
A lightweight, keyboard-centric, high-velocity surface that creates new agents instantly with no GUI. Google explicitly encourages **Gemini CLI users to migrate** to Antigravity CLI.

**3. Antigravity SDK — programmatic Python framework.** *(Research Preview)*
Provides programmatic access to the **same agent harness** powering Google's own products, optimised for Gemini models, hostable on your own infrastructure. Quickstart is genuinely small:

```python
import asyncio
from google.antigravity import Agent, LocalAgentConfig

async def main():
    config = LocalAgentConfig()
    async with Agent(config) as agent:
        response = await agent.chat("What files are in the current directory?")
        print(await response.text())

if __name__ == "__main__":
    asyncio.run(main())
```

**4. Antigravity in Gemini Enterprise Agent Platform.**
Lets Google Cloud customers connect Antigravity directly to Google Cloud projects for enterprise workloads.

---

## 04 · MCP Surface (Primary Agent-Readiness Signal)

This is the node's headline finding for the 2nth.ai elastic-OS thesis. The **Antigravity SDK exposes MCP servers as a first-class toolset.** Every SDK agent ships with built-in tools (file I/O, code editing, shell execution, directory search) and can be extended with four tool types under one execution pipeline:

| Tool type | What it gives an agent |
|---|---|
| Built-in tools | File I/O, code edit, shell, directory search |
| Custom Python functions | Register any Python callable as an agent tool |
| **MCP servers** | Connect any Model Context Protocol server — **stdio, SSE, or HTTP** |
| Agent Skills | Load reusable packages of instructions + tools (markdown-defined) |

Safety is **deny-by-default** via declarative policies controlling when and how tools execute. Managed Agents also let you extend the agent with custom instructions and skills written as **markdown files** — the same Agent Skills standard the 2nth-skills registry uses.

**Verdict: strong MCP surface.** An agent can drive Antigravity SDK agents directly, and those agents can in turn drive any MCP server. This is a clean fit for personal-agent → specialist-subagent nesting.

---

## 05 · Open-Source Reality Check

Be precise here — this is **not** OSI open source:

- The **`google-antigravity/antigravity-sdk-python`** repo is public on GitHub, but relies on a **compiled runtime binary** shipped in platform-specific PyPI wheels. Cloning the repo alone will **not** run the SDK — you must `pip install google-antigravity` to get the binary.
- The SDK is a **Research Preview**, an evolving platform. Announced roadmap: remote harness on Google Cloud, TypeScript and Go runtimes, **Gemma integration** (full runtime on open models you can fine-tune), community plugins, and deeper observability.
- The API surface is deliberately agent-friendly (Pydantic V2 models, structured outputs, clean naming) so agents can read/write/maintain SDK code as fluently as humans.

For the factory: treat Antigravity as a **proprietary-runtime, agent-driveable platform** — useful for build velocity and as an MCP client/host, but not a self-hostable open-source dependency. The Gemma-on-open-models roadmap item is the one to watch for true residency/self-host stories.

---

## 06 · Evolution

- **Nov 2025** — Antigravity launches in public preview alongside Gemini 3 Pro; agent-first IDE (VS Code fork), Editor View + Manager surface.
- **~Nov 2025+** — SDK (Research Preview), CLI, and agent harness released; functional overlap with Google ADK noted by the community.
- **19 May 2026 (I/O 2026)** — Ecosystem expansion: Antigravity 2.0 desktop app, Antigravity CLI (Gemini CLI migration path), SDK programmatic access, Gemini Enterprise Agent Platform integration, Managed Agents in the Gemini API on Gemini 3.5 Flash, AI Studio mobile + Export to Antigravity, AI Ultra plan from $100/mo.

---

## 07 · Decision Guide

**Use when**
- You want agents to run long, multi-tool, end-to-end tasks with human checkpoints, not just autocomplete.
- You're already in the Gemini / Google Cloud / Firebase orbit.
- You need an MCP host/client where agents can drive other MCP servers programmatically.
- You want a markdown-defined Agent Skills workflow consistent with an existing skills registry.

**Skip when**
- You need a fully open-source, self-hostable runtime — the SDK's compiled binary rules this out today.
- Your data-residency story requires in-country compute on open weights (wait for the Gemma roadmap item).
- You need production stability guarantees — the SDK is still a Research Preview.
- You've standardised on a different agent harness and migration cost outweighs the velocity gain.

---

## 08 · Imbila Perspective

**Enterprise.** The proprietary compiled runtime and Research Preview status matter for procurement and POPIA reviews — Antigravity is a velocity tool and MCP host, not a self-hostable dependency you can audit end-to-end. For SA clients with data-residency constraints, note that Managed Agents run in Google-managed Linux environments; the in-country / open-weights path (Gemma runtime) is roadmap, not shipped. Treat the Gemini Enterprise Agent Platform connection as the route to keep workloads inside an existing Google Cloud project.

**Studio.** Strong fit for build velocity: the SDK's MCP-server toolset and markdown Agent Skills line up with the 2nth-skills registry pattern (`npx skills add ...`). A studio can wrap a specialist agent in <10 lines and let it drive existing MCP surfaces — exactly the personal-agent → subagent-team nesting model. Good candidate for a factory `agents/` building block, flagged as proprietary-runtime.

**Dojo.** Useful teaching artifact for the agent-harness concept: one harness, multiple surfaces (desktop / CLI / SDK / enterprise). The deny-by-default safety policy and markdown skills are concrete, transferable patterns. Use the open-source caveat as a worked example of licence-vs-availability discipline.

---

## 09 · Resources & Sources

**Official primary sources (validated 2026-06-13)**
- Google Developers Blog — Build with Google Antigravity (launch): https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/
- The Keyword — I/O 2026 developer highlights (ecosystem expansion): https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/
- Antigravity launch blog: https://antigravity.google/blog/introducing-google-antigravity
- Antigravity SDK overview (docs): https://antigravity.google/docs/sdk-overview
- Antigravity SDK announcement (Research Preview, roadmap): https://antigravity.google/blog/introducing-google-antigravity-sdk
- Antigravity docs home (product surfaces): https://antigravity.google/docs/home

**Open-source / standards references**
- SDK repo (public, compiled-binary dependency): https://github.com/google-antigravity/antigravity-sdk-python
- Model Context Protocol (the MCP standard the SDK consumes): https://modelcontextprotocol.io
- Google ADK ↔ Antigravity SDK overlap discussion: https://github.com/google/adk-python/issues/5781
- GitHub topic — antigravity / antigravity-cli / antigravity-ide (community ecosystem)

**Validation notes**
All claims cross-checked against Google's own blog and docs. Items in the source draft that could not be confirmed against primary sources (`/btw` command, "Turbo Mode", "Gemini Flash" as the IDE model) were removed or corrected — see the `correction_log` in front-matter. Licence status flagged explicitly: **not OSI open source; proprietary compiled runtime, Research Preview.**
