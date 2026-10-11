# Attention manager

**Rule:** never two calls to action at once. At any moment the app shows at most one interrupt (modal or drawer) and at most one card in the Home attention zone, chosen by one function.

Design proposal (figures, ranked list, open decisions): the "Attention Manager" page shared on 2026-10-11. Product source for the journey order: Notion, _User Journey: Prioritized activation and retention actions_.

## Why

Every self-opening prompt used to decide for itself (`HomeModals`' boolean chain, `legalConsentGate`, the overlay registry, per-prompt guards). Whenever two rules were true at once, both fired: on 2026-10-07 the updated-terms modal and the "Peanut is open to everyone" drawer showed together. Each fix taught one prompt about the others; the next prompt started from zero.

## Model (`src/features/attention`)

| Piece                   | File                    | What it is                                                                                                                                                              |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AttentionAsk`          | `types.ts`              | tier (urgency), rank (order inside the tier), surfaces, `eligible(state)`, policy (budget, snooze, expiry, fatigue)                                                      |
| `JourneyState`          | `journeyState.ts`       | one plain object built from hooks the app already has (`/users/me`, capabilities, identity, wallet, card, push, consent)                                                 |
| `decide()`              | `decide.ts`             | pure: `(state, asks, ledger, session) → { interrupt, zone }`; sticky open interrupt, tier budgets, `unknown` holds lower tiers until the 4 s settle deadline, zone fatigue |
| Ledger                  | `ledger.ts`             | shown / dismissed / snoozed per ask in `UserPreferences.attention`; reads the old per-prompt fields once so upgraded devices are not re-asked                            |
| Registry                | `registry.ts`           | the asks, in tier then rank order                                                                                                                                       |
| Provider                | `AttentionProvider.tsx` | mounted in the mobile layout; re-decides on state, ledger and route changes                                                                                             |

Tiers rank urgency among asks eligible at the same moment. Journey dependencies live in `eligible()`, never in rank: "finish card setup" needs an active card, so it is never live for a user who still has to verify.

| Tier | Who                                                                          | Interrupt budget                                             |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | terms, unprotected balance, verification due, half-done action, half-done card | any session                                                  |
| 2    | the checklist (install, verify, add money, card, first payment), blocked card  | never (the download prompt opts into `session`)              |
| 3    | repeat use                                                                   | one per session, none after a T1                             |
| 4    | backup passkey, push, email, saved recipient                                 | one per session, none after a T1 (contextual moments later)  |
| 5    | invite, rewards, profile, review, campaigns                                  | never                                                        |
| 6    | announcements                                                                | only if the zone is idle, session ≥ 3, one per 7 days        |

## Phases

1. **Foundation, shadow mode** (ui#3658). Types, state, `decide()`, ledger, registry with the ten asks that exist today, provider. Nothing rendered through the manager; it captured `attention_decided { shadow: true, … }` once per distinct decision.
2. **Interrupts** (stacked on 1). The seven self-opening overlays render through `AttentionInterrupt` in the layout, each as a render-only surface with `onActed` / `onDismissed` / `onSnoozed` (`surfaces.tsx`). `HomeModals`' chain, `legalConsentGate` and the per-drawer guards are gone. The push store refuses a money-moment pre-prompt while a manager surface is up, and the manager's Home push ask stands down after a store prompt. The manager emits the legacy `modal_shown` / `modal_dismissed` / `modal_cta_clicked` next to `attention_shown` / `attention_acted` / `attention_dismissed` / `attention_snoozed`; components no longer capture them. Closes the incident class.
3. **Zone** (stacked on 2). One card, the manager's pick, through `AttentionZone` on Home (`zoneSurfaces.tsx`). The checklist until the first payment; after it, the next-best action with rotation: a T3+ card that held the zone three sessions in a row yields for one session (`pickWithFatigue`). The nine carousel slides became asks with one small card each (`surfaces/zone/`); the carousel and `useHomeCarouselCTAs` are gone. The zone holds (renders nothing) while a higher zone tier is still loading, so a lower card never flashes before the checklist. Legacy carousel closes are read into the ledger by slide id.
4. **New asks** (stacked on 3). Nine cards, one file each in `surfaces/zone/`: virtual account, next payment, share bank details, request money, send money, backup passkey, add email, rewards, complete profile. Eligibility lives in `registry.ts`; copy in the four app locales under `home.carousel`. `GET /users/me` gained `passkeyCount` (peanut-api-ts); the balance warning is `done` at two credentials and the backup card shows at one. Not built: save a recipient and sync contacts, which have no feature behind them yet.
5. **Server ledger.** JSON column and endpoint; cross-device dismissals.
6. **Push and email.** The same `decide()` on the API with inactivity delays; completing a step cancels its reminders everywhere.

## Reading the trace

`attention_decided` carries `candidates` (eligible asks in priority order) and `reasons` (why each candidate was not the interrupt), plus `suspended` and `overlay_open` when a user-opened overlay held the manager back. In local builds the same payload is logged as `[attention]`.

## Adding an ask

One file in `asks/` (eligibility, policy, version) registered in `registry.ts`, a surface component taking `AskSurfaceProps` registered in `surfaces.tsx` (a parity test fails otherwise), and a row in `decide.test.ts` for every ask it can collide with. The component never decides whether to show; it renders visible when mounted and answers through the three callbacks.
