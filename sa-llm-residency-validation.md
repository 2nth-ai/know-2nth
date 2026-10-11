---
title: Where LLM inference actually runs in South Africa
scope: Reference — SA data residency for managed LLM inference (AWS, Azure, Google) plus the self-hosted path
pages_affected:
  - https://know.2nth.ai/explainers/agents/gpt
  - https://know.2nth.ai/explainers/tech/microsoft/
date: 2026-05-14
last_verified: 2026-10-11
---

# Where LLM inference actually runs in South Africa

AWS, Microsoft and Google all have South African cloud regions. Having a region is not the same as running the model there. This page shows where each vendor actually processes your prompts, checked against their own documentation on 11 October 2026.

01 · The answer

## Where your prompts are processed.

"In country" here means the GPU that runs the model is in South Africa, not just the API endpoint, the logs or the stored data.

| Vendor · SA region | Models you can call | Where inference runs | In country? |
|---|---|---|---|
| AWS Bedrock · `af-south-1` Cape Town | Claude, current line (Sonnet 5.5, Opus 5.5) and earlier | Global cross-Region only: any AWS region with capacity. The endpoint and CloudWatch/CloudTrail logs stay in Cape Town. | **No** |
| Azure OpenAI · `southafricanorth` Johannesburg | Current GPT line (GPT-5.x, GPT-6) on Global Standard and Global Provisioned | Global types run in any Azure region. Regional (in-country) inference covers **gpt-4o 2024-05-13 on Provisioned only**, plus two embedding models. | **gpt-4o PTU only**, and that version is scheduled to retire on 9 Dec 2026 |
| Google Vertex AI · `africa-south1` Johannesburg | Gemini is not listed for africa-south1 | Gemini is served from other regions or the global endpoint. The region does support custom model inference. | **No** for Gemini; **yes** for models you deploy yourself |
| Open-weights, self-hosted · any SA region or on-prem | Llama, Qwen, Gemma, GLM, Mistral and others | On the compute you choose, served with e.g. vLLM or Ollama | **Yes** |

**Bottom line.** As of October 2026, no major vendor runs a current frontier model in South Africa. The only managed in-country option is Azure's gpt-4o (2024-05-13) on Regional Provisioned Throughput, and that version is scheduled to retire on 9 December 2026. If prompts must stay in the country, plan on open-weights models running on South African compute. Otherwise, get a written regional-capacity commitment from Microsoft before you build on the PTU path.

02 · Decision guide

## Start with where the data is allowed to go.

The vendor question comes second. First decide whether prompts and grounding data may cross the border. That's a legal call for your information officer, not an architecture preference.

**Prompts may leave South Africa.** This covers most workloads where a POPIA section 72 transfer basis applies, for example an adequate level of protection at the destination or the data subject's consent.
- Use any of the three vendors. Pick on model quality, price and the cloud you already run.
- An SA endpoint (`af-south-1`, `southafricanorth`) still helps: logs and data at rest stay local, and latency to the endpoint is lower.
- Record the transfer in your POPIA documentation. AWS itself tells Cape Town customers to "evaluate alignment with regulatory obligations such as POPIA."

**Prompts must stay in South Africa.** Typical cases are bank offshoring rules, public-sector and sovereign data, client PII in FAIS-regulated advice, and contracts that name the country.
- Open-weights on SA compute is the durable path. See `/explainers/agents/vllm` and `/explainers/agents/owning-ai`.
- Azure gpt-4o on Regional PTU works today but has a retirement date. Treat it as a bridge.
- Redact before you send. Strip or tokenise personal information so the frontier call carries none of it. This only works when the task doesn't need the PII itself.

03 · AWS Bedrock af-south-1

## Endpoint and logs in Cape Town. The model runs elsewhere.

Bedrock went GA in Cape Town in November 2025. You can call Claude from `af-south-1`, but only through **global cross-Region inference**. AWS's own model cards for the current Claude line list `af-south-1` as Global only: In-Region and Geo are both marked not supported. There is no Africa geo profile, so global routing is the only option from Cape Town.

> "You can now invoke models from the Cape Town Region while Amazon Bedrock automatically routes requests to Regions with available capacity… your Amazon CloudWatch and AWS CloudTrail logs stay centralized in af-south-1."
> — AWS Machine Learning Blog, Jan 2026

In plain terms, the API endpoint and the audit logs are in Cape Town. The GPU running Claude is wherever AWS has capacity at that moment.

04 · Azure OpenAI in southafricanorth

## The deployment type decides where inference runs.

Every Azure OpenAI deployment keeps data at rest in your Azure geography. Where the prompt is processed depends on the deployment type you choose.

| Deployment type | Where inference runs | Available in southafricanorth |
|---|---|---|
| Global Standard / Provisioned | Any Azure region where the model is deployed | Current GPT line, incl. GPT-5.x and GPT-6 |
| Data Zone | Within the US, EU or APAC zone | None. There is no Africa data zone |
| Standard (Regional) | Only in the deployment region | `text-embedding-3-large`, `text-embedding-ada-002`. No chat models |
| Provisioned (Regional PTU) | Only in the deployment region | `gpt-4o` 2024-05-13 only |

> "Global types: Might be processed in any Azure region where the model is deployed… Standard/Regional types: Processed in the region associated with your deployment."
> — Microsoft Learn · Region availability for Foundry Models, Sep 2026

Microsoft lists gpt-4o 2024-05-13 for retirement on **9 December 2026**. Standard deployments auto-upgrade to the replacement (gpt-5.6-sol), but **provisioned deployments are not auto-upgraded**, and Microsoft's documentation doesn't yet show a successor in Regional PTU for South Africa North. Until it does, the in-country Azure path has an end date.

PTU also carries a meaningful minimum commitment, which rules it out for smaller workloads regardless of the model question.

05 · Google Vertex AI in africa-south1

## The region is real. Gemini isn't served from it.

Google's generative AI locations page (updated 10 October 2026) does not list `africa-south1` for any Gemini model. Calls from South Africa go to another region or to the global endpoint, which Google says "doesn't support data residency requirements."

Johannesburg does support Vertex AI **custom model inference**, along with Model Registry and Pipelines. So open-weights models you deploy yourself, such as Gemma or Llama on a Vertex endpoint, can serve from inside the country. That's the in-country route on GCP.

06 · Corrections log

## What changed, and when.

This page started as an audit of our own overstated residency claims. We keep the record here because the facts move and the tree is held to the same standard.

**2026-10-11 · Re-verified and rewritten as a reference**
- Azure: Regional PTU in southafricanorth has narrowed to gpt-4o 2024-05-13, which is scheduled to retire on 9 Dec 2026. The May version said "select GPT models" and called Azure the strongest SA residency story.
- Google: Gemini is not listed for africa-south1. The May version treated it as an SA inference region for Gemini.
- AWS: unchanged. Still Global only from Cape Town, now confirmed for the Claude 5.5 models.
- Tree updated to match: `agents/claude`, `gemini`, `gemini-omni`, `google-adk`, `llama`, `gpt`, `openai-agents-sdk`, the agents and tech hubs, `tech/aws`, and the Microsoft hub, `copilot-sa` and `azure-openai-workers` pages.

**2026-05-14 · Three claims corrected on two explainers**
We corrected `agents/gpt` (Claude on Bedrock "for SA residency") and `tech/microsoft` ("the only major LLM vendor with a South Africa inference region"; "fully in country"). Applied in PR #32, commit `ba8725a`.

`agents/gpt` — comparison table, Claude row
- Before: Best instruction-following, native extended thinking, MCP-native, Bedrock `af-south-1` for SA residency
- After: Best instruction-following, native extended thinking, MCP-native, Bedrock `af-south-1` endpoint with in-country logs (Claude 4.5 inference itself routes globally via cross-Region inference — not strict residency)

`tech/microsoft` — hero copy
- Before: Microsoft is the only major LLM vendor with a South Africa inference region. For the regulated workloads that have to keep prompts and grounding data in country — banking, healthcare, public sector, FAIS-covered advisory — that single fact is the deciding architectural input.
- After: Microsoft offers the most mature path to in-country frontier-model inference in South Africa via Azure OpenAI Regional PTU in `southafricanorth`. Google Vertex AI's `africa-south1` and AWS Bedrock's `af-south-1` are also present in country, but for current frontier closed models neither matches Azure's Regional PTU residency guarantee. For regulated workloads that have to keep prompts and grounding data in country — banking, healthcare, public sector, FAIS-covered advisory — that asymmetry is the deciding architectural input.

`tech/microsoft` — § 02 residency footnote
- Before: Azure OpenAI in `southafricanorth` is fully in country — both the resource and the inference compute are in Joburg.
- After: Azure OpenAI in `southafricanorth` keeps inference in country only on Regional PTU deployments — and currently only for the GPT model versions with local capacity. The default Global Standard SKU keeps data at rest in country but processes prompts and completions in any Microsoft Foundry region globally. The strict-residency path is Regional PTU; the pragmatic path is Global Standard with the M365 Geo data-at-rest commitment. Confirm specific model availability with Microsoft before architectural decisions — current GPT Standard SKU is documented in eight US/Sweden regions only, with SA North coverage via PTU.

07 · Resources

## Primary sources.

- AWS docs (checked Oct 2026) — Claude Sonnet 5.5 model card, regional availability. https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html
- AWS docs — Regional availability by model. https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
- AWS ML Blog (Jan 2026) — Scale AI in South Africa using Amazon Bedrock global cross-Region inference. https://aws.amazon.com/blogs/machine-learning/scale-ai-in-south-africa-using-amazon-bedrock-global-cross-region-inference-with-anthropic-claude-4-5-models/
- Microsoft Learn (Sep 2026) — Region availability for Foundry Models sold by Azure. https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability
- Microsoft Learn (Jul 2026) — Foundry Models lifecycle and support policy. https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements
- Microsoft Learn — Foundry Models deployment types. https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/deployment-types
- Google Cloud (Oct 2026) — Generative AI on Vertex AI, locations. https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- Google Cloud — Locations for machine learning services. https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/locations

## Tools for enforcing residency.

- AWS docs — Bedrock cross-Region inference profiles. https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html
- Open Policy Agent — enforce region and SKU constraints. https://github.com/open-policy-agent/opa
- Cloudflare AI Gateway — provider-agnostic routing. https://github.com/cloudflare/ai-gateway-docs
- know.2nth.ai — vLLM, serving open-weights models on your own compute. https://know.2nth.ai/explainers/agents/vllm
