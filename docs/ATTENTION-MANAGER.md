# Attention manager

**Rule:** one pick per surface. At any moment the app shows at most one interrupt (modal or drawer), one card in the Home attention zone, one inline notice across mounted page slots, and one banner, chosen by one function.

Design proposal (figures, ranked list, open decisions): the "Attention Manager" page shared on 2026-10-11. Product source for the journey order: Notion, _User Journey: Prioritized activation and retention actions_.

## Why

Every self-opening prompt used to decide for itself (`HomeModals`' boolean chain, `legalConsentGate`, the overlay registry, per-prompt guards). Whenever two rules were true at once, both fired: on 2026-10-07 the updated-terms modal and the "Peanut is open to everyone" drawer showed together. Each fix taught one prompt about the others; the next prompt started from zero.

## Model (`src/features/attention`)

| Piece                   | File                    | What it is                                                                                                                                                              |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AttentionAsk`          | `types.ts`              | tier (urgency), rank (order inside the tier), surfaces, `eligible(state)`, policy (budget, snooze, expiry, fatigue)                                                      |
| `JourneyState`          | `journeyState.ts`       | one plain object built from hooks the app already has (`/users/me`, capabilities, identity, wallet, card, push, consent)                                                 |
| `decide()`              | `decide.ts`             | pure: `(state, asks, ledger, session) → { interrupt, zone, inline, banner }`; sticky open interrupt, tier budgets, each `unknown` ask holds lower-priority interrupts for 4 s from when it turned `unknown` on the current route, zone fatigue |
| Ledger                  | `ledger.ts`             | shown / dismissed / snoozed per ask in `UserPreferences.attention`; copies the old per-prompt closes in once per user (and syncs them) so upgraded devices are not re-asked |
| Registry                | `registry.ts`           | local eligibility and rendering handlers; policy comes from the backend catalogue                                                                                                                                       |
| Provider                | `AttentionProvider.tsx` | mounted in the mobile layout; re-decides on state, ledger and route changes                                                                                             |

Tiers rank urgency among asks eligible at the same moment. Journey dependencies live in `eligible()`, never in rank: "finish card setup" needs an active card, so it is never live for a user who still has to verify.

| Tier | Who                                                                          | Interrupt budget                                             |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | install the app (web), maintenance banner, terms, arrival in a new country, unprotected balance, due and advisory document requests, half-done action, half-done card (`finish-card-setup` on the existing card permission, then `finish-card-funding` on managed funding; the server's funding decision picks one) | any session |
| 2    | the checklist (verify, add money, first payment by card or QR), blocked card | never |
| 3    | repeat use: virtual account, QR payment and its ID check, card offer, next payment, share bank details, request money, send money; inline: verification deadline, limit cap | one per session, none after a T1 (no T3 ask opens by itself today) |
| 4    | backup passkey, push, email                                                  | one per session, none after a T1 (contextual moments later)  |
| 5    | user interview, invite, rewards, profile, bug bounty                         | never                                                        |
| 6    | announcements (the early-user drawer)                                        | only if the zone is idle, session ≥ 3, one per 7 days        |

## Phases

1. **Foundation, shadow mode** (ui#3658). Types, state, `decide()`, ledger, registry with the ten asks that exist today, provider. Nothing rendered through the manager; it captured `attention_decided { shadow: true, … }` once per distinct decision.
2. **Interrupts** (stacked on 1). The seven self-opening overlays render through `AttentionInterrupt` in the layout, each as a render-only surface with `onActed` / `onDismissed` / `onSnoozed` (`surfaces.tsx`). `HomeModals`' chain, `legalConsentGate` and the per-drawer guards are gone. The push store refuses a money-moment pre-prompt while a manager surface is up, and the manager's Home push ask stands down after a store prompt. The manager emits the legacy `modal_shown` / `modal_dismissed` / `modal_cta_clicked` next to `attention_shown` / `attention_acted` / `attention_dismissed` / `attention_snoozed`, with the extra properties the old prompt sent (`legacyProps` on the ask: `documents`, `trigger`, `cta`); components no longer capture them. Closes the incident class.
3. **Zone** (stacked on 2). One card, the manager's pick, through `AttentionZone` on Home (`zoneSurfaces.tsx`). The checklist until the first payment; after it, the next-best action with rotation: a T3+ card that held the zone for its allowed run (`maxConsecutiveSessions`, default 3) rests one session and the slot goes to the least recently shown fresh card (`pickZone`, `isFatigued`, `leastRecentlyShown`); a yield card already booked this session keeps the zone for the rest of it. The nine carousel slides became asks with one small card each (`surfaces/zone/`); the carousel and `useHomeCarouselCTAs` are gone. The zone renders nothing while a zone ask that outranks the pick (tier, then rank) is `unknown`, until its 4 s settle window ends, so a lower card never flashes before the checklist. Only asks this device can show count (`surfaceWhen.zone`), for the hold and for "zone idle". Legacy carousel closes are read into the ledger by slide id.
4. **New asks** (stacked on 3). Nine cards, one file each in `surfaces/zone/`: virtual account, next payment, share bank details, request money, send money, backup passkey, add email, rewards, complete profile. Eligibility lives in `registry.ts`; copy in the four app locales under `home.carousel`. `GET /users/me` gained `passkeyCount` (peanut-api-ts); the balance warning is `done` at two credentials and the backup card shows at one, on iPhone and Android only (native or mobile web: the backup guide has no desktop steps). That device check is the ask's `deviceGate` over the `deviceType` journey fact, and it applies over a server verdict too, since the server cannot see the device. Not built: save a recipient and sync contacts, which have no feature behind them yet.
5. **Server ledger** (stacked on 4; peanut-api-ts#1838). Every ledger entry carries `updatedAt`; a write mirrors the whole store to the profile (`ledgerSync.ts`, debounced 2 s, one call per quiet period, swallowed when offline). The profile's copy comes back on `/users/me` as `attention` and `readLedger` merges it with the device's copy field by field (`mergeEntry`): show histories are unioned; the answer (dismissal, snooze and their version) comes from the newer `updatedAt`, and an entry without an answer (a show, from either side) never erases one. Only answers stamp `updatedAt`. The server merges the same way, so two devices agree and a stale device never erases a newer dismissal. Zone rotation counters (`lastSessionShown`, `consecutiveSessions`) count this device's sessions and are not synced. One pending sync per user; it is sent at once on `pagehide`, a hidden `visibilitychange` and the native app pause, and `flushLedgerSync(userId)` sends it before logout. If storage refuses a write, the answer still holds for the load (an in-memory copy) and still syncs.
6. **Push and email** (peanut-api-ts#1838). `decide.ts` runs in both app and API against policies derived from the same backend catalogue (`src/attention/`) and `types.ts` keeps every field `decide()` reads, with a server registry of the asks the server can judge from its own facts and a state builder that reads everything it cannot see as settled and quiet. `nextAttentionAsk` returns the one next action for a user the way Home would. `GET /users/me/attention` sends the ranking and the server's verdicts to the app, which uses them over its own. A server `show` waits as `pending` while the app cannot render the ask (`renderable`): the terms modal lists the documents from the app's own consent check. The lifecycle email job maps each step to its ask (verify / fund / first spend → the checklist; create card → the checklist before activation and the card offer after, picked by the dispatcher from the user's facts; win back → next payment): a step the user dismissed or snoozed on the phone is held (`skip: 'attention'`), and a delivered email is recorded on the ledger as a show, so the phone's frequency rules see it. Completing a step needs no cancellation: the verdict is derived from state on both sides.

## Reading the trace

`attention_decided` carries `candidates` (eligible asks in priority order) and `reasons` (why each candidate was not the interrupt), plus `suspended` and `overlay_open` when a user-opened overlay held the manager back. In local builds the same payload is logged as `[attention]`.

## Adding an ask

One policy row in the API `src/attention/catalogue.ts` (tier, rank, surfaces, budgets, snooze, expiry and email mappings), a `defineAsk` entry in UI `registry.ts` for local eligibility/version handlers, a surface component taking `AskSurfaceProps` in the matching surface map (`surfaces.tsx`, `zoneSurfaces.tsx`, `inlineSurfaces.tsx` or `bannerSurfaces.tsx`; a parity test fails otherwise), and a row in `decide.test.ts` for every ask it can collide with. The component never decides whether to show; it renders visible when mounted and answers through the three callbacks.


## Surfaces and presentation

- Interrupt: one self-opening overlay. Its registry presentation is modal or drawer; AskShell renders it. Legal consent, post-verification action, card setup, card funding, install app, and Home push use modals; arrival, balance backup and early user use drawers.
- Zone: one Home card with its existing bespoke component and fatigue policy.
- Inline: one notice across the mounted bank-transfer and limits slots. Tier/rank wins, then mounted-slot order; slot context supplies the deadline. No budget, rotation, or settle hold. A picked interrupt cannot also be the inline notice.
- Banner: the first live banner ask by tier/rank, independent of the other picks. Maintenance keeps the existing feature/global copy and evaluates locally on routes without a provider.

A surface that throws (a render error or a lazy chunk that fails to load) is not an answer: its ask is skipped for the rest of the app load for that account, nothing is written to the ledger, and the manager reports `attention_crashed`. The boundaries try the chunk-error reload first, and every surface import retries a failed chunk once. A page's own error is not the manager's: it goes on to the app's error handling, and the manager stays on.

## When something breaks

One fault never takes every prompt down:

- **An ask's rule throws** (`eligible`, `version`, `surfaceWhen`, …): that ask reads `ineligible` and the others still decide. Sentry gets one report per rule and load (tags `ask`, `rule`), PostHog `attention_crashed { ask, rule }` (`faults.ts`).
- **A fact throws** (a selector over app data in `journeyState.ts`): it reads as its fallback, the value that hides the asks reading it or "not loaded". One Sentry report per fact (tag `fact`).
- **The engine throws** (anything else in the provider): the engine runs beside the app, not around it, so no page remounts and nothing the user typed is lost. The hosts render nothing, Sentry is paged, and the engine starts again on the next route, at most `ENGINE_RETRIES` (2) times per load.
- **A pick shows nothing** (a surface that still checks its own conditions disagrees with the verdict): if no modal or drawer is on screen 10 s after its code loaded (`SURFACE_SHOW_DEADLINE_MS`), the ask is skipped for the load, PostHog gets `attention_crashed` and Sentry a warning. It no longer holds the interrupt slot for the session.
- **Two overlays at once**: a manager prompt and another modal or drawer open together for more than a second send one Sentry warning per load (`overlay-visibility.ts`). The app-store review sheet never opens over a manager prompt.
- **A malformed server answer**: legacy ranking rows and unknown verdicts are discarded individually. A supported live catalogue must contain every supported ask and valid settings; invalid, truncated or unsupported catalogues fall back atomically to the generated snapshot. It never silently combines live and bundled policies.

**Off switch.** The API kill switch `disabledAttentionAsks` (served by `GET /config/kill-switches`; the app reads it on open and on resume, on native too) lists asks the app never shows; `*` turns every ask off, and an open one closes. A listed ask also stops holding other asks' push and email nudges. Flip it from peanut-api-ts with `scripts/flip-rail-gates.ts --set disabledAttentionAsks=install-app` (dry run unless `--apply`). The API's nudge gate has its own: `notificationsBypassAttentionGate=true` sends nudges as before the gate.

Busy means no new interrupt: an existing interrupt stays eligible, and zone, inline, and banner remain visible behind user-opened overlays. A gate still clears the non-interrupt picks. Inline and banner impressions are booked once per account, app session, ask, and surface. Missing slots and failed slot conditions appear in the decision trace.

Toasts and user-opened in-flow modals stay outside the manager. Zone cards retain their bespoke components.

## Home: one component, anchored by the to-do list

Home renders one attention component, `HomeAttention` (`AttentionZone.tsx`). It shows the to-do list until its applicable activation steps are complete, then the next-best action with rotation. A user with no card or QR spend path can complete the list without a payment; current money and verification still follow the shared resolver.

While the to-do list is live it anchors Home (`policy.anchorsHome` on `checklist` and `blocked-card`):

- Only a strictly higher tier (tier 1) may take the card or open an interrupt on Home. Same-tier and lower-tier asks are held, with trace reason `held by the to-do list`. Announcements wait until the list is done.
- The Home push pre-prompt is the exception (`policy.overAnchor`, Slava 2026-11-03): as before the manager, it may open over the list, within its own budget (from the third session, one per session, none after a tier 1 interrupt). Its native card still waits.
- Installing the app is the most critical ask (tier 1, rank 0, Slava 2026-10-12): on the web it opens over the to-do list, ahead of updated terms.
- A tier 1 card replaces the list for as long as it is live (Slava, 2026-10-12); the list returns once the card is dealt with. `ZonePick.underlay` names the list it replaced, reported as `zone_replaced` on `attention_decided`.
- Off Home the anchor does not apply.

The to-do list's count comes from `checklistProgress()` in `activation-step.utils.ts`.


## One source for product rules

`peanut-api-ts/src/attention/catalogue.ts` is the policy source. Both API asks and API ranking derive their metadata from it; lifecycle email mappings derive from the same rows. `GET /users/me/attention` returns the versioned catalogue, shared settings, server verdicts, bounded explanations and authoritative full-history facts. The app applies the live supported catalogue over its local rendering and device handlers.

The generated `src/features/attention/catalogue.generated.json` and `onboarding.generated.ts` are compatibility artifacts, never independent policy files to edit. Regenerate and verify both from the API worktree:

```sh
node --import tsx scripts/export-attention-catalogue.mjs --output <ui-worktree>/src/features/attention/catalogue.generated.json
node --import tsx scripts/export-attention-catalogue.mjs --output <ui-worktree>/src/features/attention/catalogue.generated.json --check
```

The canonical onboarding resolver lives in API `src/attention/onboarding.ts`. The server cannot observe every device or client flag, passkey ceremony, live wallet state or open overlay. It returns unknown where necessary; the app evaluates those inputs using the generated resolver and local handlers. Unavailable history never becomes empty history.

The authenticated `/dev/attention` page renders the catalogue and settings, identifies whether live or generated policy is in use, and explains the current user's eligibility and a read-only Home decision. It does not impersonate another account, open a prompt, consume a message budget or write a dismissal. Product can inspect rules in one place; changing the backend source still requires normal code review and release. A live rules editor is outside this change.

Within a tier, lower rank wins; equal ranks retain catalogue order. There is one pick per surface, so an independent banner can coexist with an interrupt. Tier3/4 interrupts consume their session allowance, tier1 can follow another tier1, and tier6 waits for a quiet third-or-later session with an idle Home card and a seven-day cooldown. Eligible losers are reevaluated after the winner changes or the relevant budget renews; there is no queue of stale rendered messages.
