# Model selection, timeline & cost plan (macOS port)

Which Claude model to use at each remaining milestone of the macOS port, a
realistic calendar timeline, and a cost/subscription recommendation.

- **Execution plan (milestones M0–M8):** [`macos-app-execution-plan.md`](macos-app-execution-plan.md)
- **Feasibility & option comparison:** [`macos-app-plan.md`](macos-app-plan.md)
- **Tracking issue:** [#2](https://github.com/pcpcchen-coder/TranslationKonjac/issues/2)

> **Pricing snapshot date: 2026-07-02.** Anthropic pricing, plan limits, and
> especially the Fable 5 promotional terms below are moving targets — one of
> the numbers in this doc (the Fable 5 inclusion window) expires **2026-07-07**,
> five days after this was written. Re-check
> [claude.com/pricing](https://claude.com/pricing) and
> [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing)
> before committing budget. Sources are listed at the bottom.

## 1. The three models, in plain terms

| Model | API price (in/out per MTok) | Official positioning | Where it fits this project |
|---|---|---|---|
| **Sonnet 5** | $2 / $10 (intro, through 2026-08-31; $3/$15 after) | "Frontier intelligence at scale, built for coding, agents, and enterprise workflows" — now Anthropic's **default** model for Claude Code, closing the agentic-coding gap with Opus | **The workhorse.** Use for almost everything below. |
| **Opus 4.8** | $5 / $25 | "Complex agentic coding and enterprise work" — multi-hour autonomous agents, **large-scale refactoring**, complex systems engineering | Reserve for the one milestone that's a genuine risky refactor (M5), or when Sonnet gets stuck. |
| **Fable 5** | $10 / $50 | Anthropic's most capable widely-released model, built for **long-running agents that plan across stages, delegate to sub-agents, and check their own work over days** | Optional. This project's milestones are individually well-scoped, which is exactly the case Fable is *not* needed for — see §4. |

Fable 5 is **not** a cheap/fast tier — it's the most expensive of the three (2x
Opus, ~4-5x Sonnet). It's also the newest and least battle-tested: it was
paused in mid-2026 over a U.S. export-control review and only became generally
available again around 2026-07-01. Treat it as a premium, slightly-less-proven
option, not a default.

**A cheaper lever than switching models:** Sonnet and recent Opus models
support an `effort` parameter (`low`/`medium`/`high`/`xhigh`/`max`). Anthropic's
own guidance recommends `xhigh` for coding and high-autonomy work on Opus
before reaching for a pricier model. In Claude Code's Agent/Workflow tools this
is the `effort` option — try bumping it before switching model tiers.

*(Footnote: Fable 5, Mythos 5, Opus 4.7+, and Sonnet 5 use a newer tokenizer
that produces ~30% more tokens than older models for the same text — factor
that in when comparing "cost per task" rather than just $/MTok.)*

## 2. Model recommendation per milestone

Baseline milestones from the execution plan (M0, M1 already done):

| Milestone | Nature of the work | Recommended model | Why |
|---|---|---|---|
| M2 — Session server + Keychain | Mechanical: IPC, `keytar`, first-run dialog | **Sonnet 5** | Routine pattern, same shape as M1 (already Sonnet-built) |
| M3 — Permissions & native shell | Small, mechanical menu/plist work | **Sonnet 5** | Low complexity, low token volume |
| M4 — Settings page | New UI + IPC for API-key read/write | **Sonnet 5**, then run `/security-review` | Standard UI work; the risk is the API key leaking to the renderer, which a targeted security review skill catches better than a pricier model would |
| M5 — Remove tab capture + refactor `app.js` + audio verification | **Highest-risk milestone.** Editing the most complex file (1072 lines) without breaking the echo-guard/isolation logic | **Opus 4.8 at `effort: xhigh`** | This *is* Opus's stated sweet spot: "large-scale refactoring, complex systems engineering." Follow with `/code-review` before the on-device BlackHole/LINE verification pass (which is human+hardware, not model-dependent) |
| M6 — Sign, notarize, package | Mostly config (entitlements, electron-builder); debugging is trial-and-error against Apple's notary service | **Sonnet 5**, escalate a specific stuck sub-problem to **Opus 4.8** if notarization fails repeatedly with an opaque error | Don't pre-pay for Opus on config authoring; escalate only when actually stuck |
| M7 — In-app update (electron-updater) | Well-documented library integration | **Sonnet 5** | Standard pattern |
| M8 — QA matrix + docs | Docs are mechanical writing; QA execution is manual human testing on hardware | **Sonnet 5** for docs; run `/security-review` once more before the first real DMG ships | No model does the physical LINE-call test for you |

### Where would Fable 5 actually help?

The one shape in this project that matches Fable's design goal — "plan across
stages, delegate to sub-agents, check its own work, over days" — is running
**M2 through M7 as a single long, mostly-unsupervised autonomous pass** (e.g.
via the `autopilot` skill or a custom `Workflow`), where you want maximum trust
that the agent self-corrects without you reviewing every step.

This project's remaining scope doesn't need that: the milestones are already
individually scoped in issue #2, so supervised Sonnet/Opus sessions per
milestone (as above) are both cheaper and give you natural checkpoints to
review before moving on. **Recommendation: skip Fable 5 for this project**,
unless you specifically want to try the "feed it the whole issue and walk
away" style of working — in which case do it before the terms in §5 change
(2026-07-07), since after that Fable use on a subscription plan converts from
"included in your weekly limit" to metered usage credits.

## 3. Timeline

The remaining milestones split into two phases with very different
constraints:

### Phase A — cloud/remote-buildable (M2, M3, M4, M7, M8-docs)
No Mac hardware required — can run in a remote Claude Code session exactly
like this one (or locally). Original person-day estimate: ~2.75 days. In
practice, agent-driven work on already-scoped milestones tends to run much
faster than a human coding day — M1 (comparable or larger scope than M2/M3
individually) was completed in a single session. Realistic estimate: **2–4
focused agent sessions**, i.e. roughly **1–2 calendar days** if done back to
back, or about a week if you review one milestone per evening.

### Phase B — Mac-hardware-required (M5 code + verification, M6, M8-QA)
Bounded by real-world, non-Claude constraints:
- Apple Developer ID enrollment: not instant, budget up to 1–2 calendar days
  of waiting even though the paperwork itself is quick.
- First notarization: inherently trial-and-error against Apple's notary
  service; each submission takes minutes, and cert/entitlement issues often
  take a couple of iterations.
- LINE call testing needs a second person on the other end of the call.

Realistic estimate: **2–4 calendar days**, dominated by waiting and hardware
iteration, not coding time. Run Claude Code locally on the Mac mini for this
phase (same subscription as this remote session — see §5, it's tied to your
account, not the machine).

**Total: roughly 1–2 weeks elapsed** at a hobbyist, part-time pace; as little
as 3–4 days if you dedicate full days and already have the Developer ID ready
before you start.

## 4. Cost estimate (token usage)

These are order-of-magnitude estimates, not telemetry — Claude Code doesn't
expose a reliable way to pre-measure a milestone's token cost, and actual usage
depends heavily on how many iterations/corrections happen. Method: rough
input/output token volume per milestone scaled to the files involved (e.g.
`app.js` is ~1,072 lines / ~40KB, touched multiple times during M5's refactor),
priced at *sticker* rates with **no caching discount** (a deliberate
worst-case; Claude Code's automatic prompt caching typically makes real cost
lower than this).

| Milestone | Model | Rough tokens (in/out) | Sticker-price cost |
|---|---|---|---|
| M2 | Sonnet 5 | 250K / 20K | ~$0.70 |
| M3 | Sonnet 5 | 120K / 8K | ~$0.32 |
| M4 | Sonnet 5 | 350K / 30K | ~$1.00 |
| M5 | Opus 4.8 | 500K / 35K | ~$3.40 |
| M6 | Sonnet 5 | 300K / 20K | ~$0.80 |
| M7 | Sonnet 5 | 280K / 20K | ~$0.76 |
| M8 | Sonnet 5 | 150K / 15K | ~$0.45 |
| **Total (recommended mix)** | | | **~$7.5** |

Sensitivity — same work, different model choice for *everything* (illustrates
that model choice is a quality/risk decision, not really an affordability
one):

| Scenario | Total (sticker price) | vs. recommended mix |
|---|---|---|
| All Sonnet 5 (skip Opus even for M5) | ~$4.60 | 0.6x — cheaper, but risky on the one milestone that most needs a careful hand |
| **Recommended mix (Sonnet + Opus for M5)** | **~$7.5** | 1x |
| All Opus 4.8 | ~$18 | 2.5x |
| All Fable 5 | ~$36 | ~5x |

Even doubling or tripling every number here for real-world iteration/retries,
total metered cost for finishing this project lands **in the tens of dollars**,
regardless of which model tier you pick. That's the real takeaway: **don't
optimize model choice to save money — pick the model that fits the task
(§2), and pick your subscription for convenience/rate-limits, not because raw
API cost would otherwise be scary.**

## 5. Subscription vs. pay-as-you-go — what's most cost-effective

| Option | Price | What you get | Verdict for this project |
|---|---|---|---|
| **API pay-as-you-go** | Metered, ~$0.01–0.05/day realistic pace (see §4) | No flat fee, needs Console billing set up | Cheapest in absolute dollars, but adds billing-account friction for a ~1–2 week hobby project |
| **Claude Pro** | $20/mo | Claude Code in terminal/web/desktop, Sonnet + Opus access, comfortable for focused solo sessions | **Recommended default.** Covers this entire project with margin, even with Opus on M5. If you don't already have a paid plan, get this one and cancel after, or keep it for ongoing maintenance. |
| **Claude Max 5x** | $100/mo | 5x Pro throughput, 140–280 Sonnet-hours/week, Fable 5 included at up to 50% of weekly limit **through 2026-07-07** | Worth it only if you want to blast through Phase A in one long day, lean on Opus/Fable as your default rather than the exception, or you hit Pro's rate limit mid-milestone |
| **Claude Max 20x** | $200/mo | 20x Pro throughput | Overkill for a solo project this size — skip |
| **Team Premium** | $100/seat/mo (annual) | Max-5x-equivalent + SSO/shared projects | Irrelevant — this is a solo project |

**Recommendation: Claude Pro ($20/mo)** if you don't already have a Claude
subscription. It comfortably covers the whole remaining scope (§4's worst-case
total is a fraction of one month's fee), works identically for this remote
session and for local Claude Code on the Mac mini during Phase B, and there's
no reason to pay more for a project this size. Only reach for **Max 5x** as a
temporary one-month upgrade if you specifically want to (a) work through
several milestones in a single long day, or (b) try the Fable-5
autonomous-run idea from §2 before the 2026-07-07 cutoff.

### Non-Claude costs (unchanged from the execution plan)

- **Apple Developer ID: US$99/year** — required for signing/notarization (M6)
  and for in-app update to work (M7). This is the only hard, non-optional cost
  beyond whatever Claude plan you pick.
- **OpenAI Realtime API usage** (running the translation feature itself) is a
  pre-existing cost of the app, unchanged by this port, and out of scope here.

## 6. Summary

1. **Default to Sonnet 5** for M2, M3, M4, M6, M7, M8.
2. **Use Opus 4.8 at `effort: xhigh`** specifically for M5's `app.js` refactor;
   escalate a specific stuck sub-problem to Opus during M6 if notarization
   debugging stalls on Sonnet.
3. **Skip Fable 5** unless you want one long, hands-off autonomous run across
   several milestones — and if so, do it before 2026-07-07.
4. Run `/security-review` after M4 (API-key IPC) and again before the first
   real DMG ships; run `/code-review` after M5's refactor.
5. **Timeline: ~1–2 weeks** part-time (Phase A ~1–2 days cloud-buildable,
   Phase B ~2–4 days gated by Apple/hardware, not coding speed).
6. **Cost: get Claude Pro ($20/mo)** — this project's token usage is a small
   fraction of that regardless of model mix; the only mandatory hard cost is
   the **$99/year Apple Developer ID**.

## Sources

- [Claude Platform pricing](https://platform.claude.com/docs/en/about-claude/pricing) — model pricing table, prompt caching, tokenizer note (fetched 2026-07-02)
- [Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) — official positioning for Opus 4.8 / Sonnet 5 / Fable 5 / Haiku 4.5, `effort` parameter guidance (fetched 2026-07-02)
- [Claude Fable](https://www.anthropic.com/claude/fable) and [Introducing Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5) — Fable 5 launch positioning
- [Redeploying Claude Fable 5](https://www.anthropic.com/news/redeploying-fable-5) — pause/redeployment timeline (corroborated by mainstream coverage, e.g. [NBC News](https://www.nbcnews.com/business/business-news/commerce-department-gives-green-light-anthropic-bring-back-fable-5-rcna352501), [Al Jazeera](https://www.aljazeera.com/economy/2026/7/1/us-lifts-restrictions-on-powerful-ai-models-fable-mythos-anthropic-says))
- [Claude plans & pricing](https://claude.com/pricing) and [What is the Max plan?](https://support.claude.com/en/articles/11049741-what-is-the-max-plan) — Pro/Max/Team pricing and usage limits (secondary-sourced via search; the pages themselves blocked automated fetching, so verify directly before budgeting)

⚠️ Several low-quality aggregator sites surfaced during this research (not
cited above) contained fabricated or garbled claims — e.g. one described
Fable 5's export-control pause as an outright ban with invented specifics.
Only the Anthropic-primary and mainstream-news sources above were used for
factual claims in this document.
