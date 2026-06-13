---
node: factory/building-blocks/frappe-hr
title: Frappe HR (HRMS)
category: HR & Payroll
upstream: github.com/frappe/hrms
license: GPL-3.0
agent_ready: conditional
mcp_surface: community (no first-party MCP server)
sa_fit: usable, no first-party SA statutory pack
verification_signals: 7/7 (primary source confirmed)
last_validated: 2026-06-13
status: include
---

# Frappe HR (HRMS)

> Factory assessment node. Validated against the upstream repository and official
> Frappe documentation. All version numbers, licence, and feature claims are
> drawn from primary sources — see §09 source-validation log.

Open-source HR and Payroll application built on the Frappe Framework. Split out
of ERPNext as a standalone product from version 14 onward, once the HR modules
matured enough to stand alone. Marketed as a complete HRMS spanning the employee
lifecycle through to payroll and taxation.

---

## 01 · What It Is

Frappe HR is a full-stack HRMS / HRIS application. It runs as a Frappe app
(installed via `bench`), uses the Frappe Framework for its data layer, auth, and
REST API, and ships a Vue-based frontend (Frappe UI) plus a mobile PWA.

The repository describes it as covering 13+ modules — employee management,
onboarding, leave, attendance, expense claims, performance, and payroll. It was
originally a set of modules inside ERPNext; the maintainers state they could not
find a "true" open-source HR product, so they built one, and promoted it to a
separate product at the v14 boundary.

**Stack (confirmed from repo):**

- Backend: Python — 72.8% of the codebase
- Frontend/scripting: JavaScript 15.0%, Vue 9.5%
- Framework: Frappe Framework (Python + JS), Frappe UI (Vue component library)
- Delivery: web desk + mobile PWA

---

## 02 · Why It Matters To The Factory

For the elastic-OS thesis, Frappe HR is interesting because it is one of the few
genuinely OSI-licensed HR systems with a real data model an agent can drive,
sitting on the same framework as ERPNext (`factory/building-blocks/erpnext`).
Shared framework means a single Frappe deployment can run ERP + HR + CRM as
co-located apps against one database abstraction and one REST surface.

**Validated signals (repo, 2026-06-13):**

- 8.1k GitHub stars, 2.4k forks
- 10,444 commits on `develop`
- 308 releases; latest **v16.8.0** (2026-06-03)
- 437 open issues, active CI (codecov, semgrep, mergify in-tree)
- GPL-3.0 licensed — true copyleft OSI licence, **not** fair-code

The v16 line and June 2026 release date confirm this is actively maintained, not
a dormant fork.

---

## 03 · How It Works

Frappe HR inherits the Frappe Framework's DocType model: every entity (Employee,
Leave Application, Salary Slip, Payroll Entry) is a DocType with a JSON schema, a
Python controller, and automatic REST exposure. This is the property that makes
it agent-addressable — the same DocTypes are reachable via the framework's REST
API without bespoke endpoints.

**Confirmed capability areas:**

- **Employee lifecycle** — onboarding, promotions, transfers, exit interviews
- **Leave & attendance** — leave policies, regional holiday import, geolocation
  check-in/out, leave-balance and attendance reports
- **Expense claims & advances** — multi-level approval workflows, integrated with
  ERPNext accounting
- **Performance** — goals, KRAs, self-evaluation, appraisal cycles
- **Payroll & taxation** — salary structures, **configurable income tax slabs**,
  standard payroll runs, off-cycle/additional salaries, salary-slip income breakup
- **Mobile PWA** — leave apply/approve, check-in/out, employee profile

Payroll runs through **Payroll Entry** (bulk salary-slip generation, filterable
by Branch / Department / Designation) and **Payroll Period** (defines the tax
slabs applicable for a period — confirmed in official docs).

### Install (from repo)

```bash
# Local (bench)
bench new-site hrms.localhost
bench get-app erpnext
bench get-app hrms
bench --site hrms.localhost install-app hrms
bench --site hrms.localhost add-to-hosts

# Docker (eval only)
git clone https://github.com/frappe/hrms
cd hrms/docker
docker-compose up
# → http://localhost:8000 · Administrator / admin
```

> Note: the repo lists ERPNext as a get-app dependency in the local path. Treat
> ERPNext as a co-requisite for the accounting-integrated features (expense
> claims, payroll booking).

---

## 04 · Agent-Readiness & MCP Surface

**Primary selection filter for the 2nth.ai stack: does it give an agent something
to drive?** Frappe HR scores *conditional yes*.

- **First-party MCP server: none.** Neither frappe/hrms nor frappe/frappe ships
  an official MCP server as of validation date.
- **REST API: yes, framework-native.** Every DocType is exposed via the Frappe
  REST API — an agent can read/write Employee, Leave, Salary Slip etc. with an
  API key/secret without custom endpoints.
- **Community MCP servers: several, varying maturity.** These wrap the Frappe/
  ERPNext REST API and therefore cover HR DocTypes too:

| Repo | Notes | Caution |
|------|-------|---------|
| `buildswithpaul/Frappe_Assistant_Core` | Frappe app; OAuth 2.0 + PKCE, per-user permission scoping, audit log; Frappe Cloud marketplace install | Most production-shaped option; verify licence + active maintenance before factory use |
| `mascor/frappe-mcp-server` | Frappe app; allowlist of DocTypes/operations, field-level control, audit logging | Security-conscious design; small project — verify maintenance |
| `rakeshgangwar/erpnext-mcp-server` | TypeScript; `erpnext://{doctype}/{name}` resource URIs | Generic ERPNext wrapper |
| `Casys-AI/mcp-erpnext` | npm `@casys/mcp-erpnext`; 120 tools / 14 categories | Broad surface; evaluate scope vs. least-privilege |
| `vyogotech/frappe-mcp-server` | Go; generic any-DocType, any OpenAI-compatible LLM | Generic |

**Factory recommendation:** treat the REST API as the stable, first-party agent
surface. Use a community MCP server only with explicit allowlisting, per-user
permission scoping, and audit logging (the Frappe_Assistant_Core / mascor
designs are the right shape). Do not grant an agent blanket DocType access to a
payroll-bearing system. This is a POPIA-relevant data store.

---

## 05 · South Africa Fit

**Verdict: usable for SA payroll, but there is no first-party SA statutory pack.**

What the framework gives you natively:

- **Configurable income tax slabs** via Payroll Period — this is the mechanism
  for SARS PAYE, which is progressive/slab-based. Confirmed in official docs.
- **Salary components** — can model UIF (1% employee + 1% employer), SDL (1% where
  annual payroll > R500,000), and other statutory deductions as components.
- **Multi-currency / ZAR** — Frappe/ERPNext supports ZAR as base currency.

What it does **not** ship out of the box (no primary source found confirming
first-party support — treat as a gap, not a feature):

- SARS-specific statutory reports: **EMP201** (monthly), **EMP501** (annual
  reconciliation), **IRP5/IT3(a)** tax certificates
- SARS e@syFile / eFiling export formats
- A maintained South African localisation/compliance app equivalent to the India
  localisation

These are achievable through salary components, custom reports, and the hooks/
REST API, but they are **build work**, not configuration. Budget for a SA payroll
specialist to validate PAYE/UIF/SDL calculations and to produce EMP201/EMP501/IRP5
outputs before any production payroll run.

**POPIA note:** Frappe HR holds employee personal information (IDs, salary,
banking, performance). Self-hosting on `africa-south1` / `southafricanorth` /
`af-south-1` keeps data in-country. Any agent/MCP access path must be scoped,
audited, and lawful-basis-documented under POPIA.

---

## 06 · Evolution

- **Pre-v14** — HR exists as modules inside ERPNext
- **v14** — HR modules mature; Frappe HR split into a standalone product
- **v15** — HR module deepened (slab-based tax handling, reporting improvements)
- **v16** — current major line
- **v16.8.0** — latest release, 2026-06-03 (confirmed on repo)

---

## 07 · Decision Guide

**Use when:**

- You want OSI-licensed (GPL-3.0), self-hostable HR/payroll with no per-seat fee
- You already run or plan to run ERPNext — shared framework, one deployment
- You need an agent-addressable HR data model (REST-native DocTypes)
- Data residency matters and you must self-host in an SA region
- You can resource the SA statutory layer (PAYE/UIF/SDL reports, EMP201/501, IRP5)

**Skip / defer when:**

- You need turnkey SARS-compliant payroll today with zero build — a commercial SA
  payroll product (e.g. Sage, PaySpace, SimplePay) ships statutory reports out of
  the box; Frappe HR does not
- You have no Frappe/ERPNext skills and no appetite to acquire them
- You need a vendor-supported first-party MCP integration — only community options
  exist today
- GPL-3.0 copyleft conflicts with how you intend to distribute modifications

---

## 08 · Factory Integration Notes

- **Pairs with:** `factory/building-blocks/erpnext` (co-requisite for accounting-
  integrated HR features). Same `bench`, same DB layer.
- **Deploy target:** Cloud Run + Cloud SQL + Memorystore pattern already defined
  for the Frappe/ERPNext GCP node applies unchanged — HR is just another installed
  app on the same bench.
- **Agent surface:** prefer framework REST API as the stable contract. Gate any
  MCP server behind DocType allowlist + per-user scoping + audit log.
- **SA statutory layer:** track as a discrete build item, not a config toggle.
  Candidate for a future `2nth-skills` entry once a validated SA payroll component
  set + EMP201/501/IRP5 report pack exists.

---

## 09 · Source-Validation Log

All claims above traced to primary sources; corrections noted transparently.

| Claim | Source | Status |
|-------|--------|--------|
| GPL-3.0 licence | github.com/frappe/hrms (repo licence + README) | ✅ confirmed |
| Split from ERPNext at v14 | repo README "Motivation" section | ✅ confirmed |
| Latest release v16.8.0, 2026-06-03 | repo Releases | ✅ confirmed |
| 8.1k stars / 2.4k forks / 10,444 commits / 308 releases | repo header | ✅ confirmed |
| Language split (Python 72.8% etc.) | repo Languages panel | ✅ confirmed |
| 13+ modules, feature list | repo README "Key Features" | ✅ confirmed |
| Built on Frappe Framework + Frappe UI (Vue) | repo "Under the Hood" | ✅ confirmed |
| Payroll Entry / Payroll Period / tax slabs | docs.frappe.io/hr (official) | ✅ confirmed |
| No first-party MCP server | absence in frappe/hrms + frappe/frappe | ⚠️ negative finding — community servers only |
| Community MCP servers exist | individual repos (see §04) | ✅ confirmed; maturity unverified |
| SA PAYE slab / UIF 1%+1% / SDL >R500k | SA payroll references (afrisetup, playroll) | ✅ confirmed (statutory facts) |
| No first-party SA statutory pack (EMP201/501/IRP5) | no primary source found | ⚠️ gap — treated as build work, not feature |

### Corrections / disambiguation

- **"Complete HRMS" is vendor framing, not a residency or compliance claim.** It
  is feature-complete for generic HR; it is **not** SA-statutory-complete.
- **MCP availability is community, not official.** Earlier shorthand of "Frappe
  has MCP" should read "Frappe HR is REST-addressable; MCP servers are third-party."
- **ERPNext dependency:** local install path pulls ERPNext via `get-app`. Accounting-
  integrated HR features assume ERPNext present.

### Primary sources

- github.com/frappe/hrms ↗ (repository, README, releases, licence)
- docs.frappe.io/hr ↗ (official Frappe HR documentation — payroll setup/entry/period)
- github.com/frappe/frappe ↗ · github.com/frappe/frappe-ui ↗ (framework + UI)
- Community MCP: buildswithpaul/Frappe_Assistant_Core, mascor/frappe-mcp-server,
  rakeshgangwar/erpnext-mcp-server, Casys-AI/mcp-erpnext, vyogotech/frappe-mcp-server

---

## 10 · Build-Out Checklist

- [ ] Stand up Frappe HR + ERPNext on the GCP Cloud Run pattern (`af` region)
- [ ] Confirm latest stable major line before pinning (v16.8.0 at validation)
- [ ] Model SA salary components: PAYE (slab), UIF 1%+1%, SDL conditional
- [ ] Validate PAYE/UIF/SDL math with a SA payroll specialist
- [ ] Build EMP201 / EMP501 / IRP5 report outputs (no first-party pack)
- [ ] Document POPIA lawful basis for HR data + any agent access path
- [ ] Choose agent surface: REST API (preferred) vs. allowlisted MCP server
- [ ] If MCP: enforce DocType allowlist + per-user scope + audit log
- [ ] Evaluate community MCP server licence + maintenance before factory adoption
- [ ] Candidate future `2nth-skills` entry: SA payroll component + report pack
