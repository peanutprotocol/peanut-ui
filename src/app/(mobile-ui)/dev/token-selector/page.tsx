'use client'

import { useState, type ReactNode } from 'react'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import NetworkListItem from '@/components/Global/TokenSelector/Components/NetworkListItem'
import DevPageShell from '../_components/DevPageShell'
import {
    ComposedPicker,
    FakeCardTrigger,
    ListItemTrigger,
    MOCK_TOKENS,
    TokenOptionList,
    type LeadingKey,
    type SkinKey,
} from './_components/SelectorVariants'

/**
 * /dev/token-selector — three rulings the TokenSelector rebuild needs before a
 * line of it can be written.
 *
 * Q1, the main one: what does a SELECTED list row look like? Six visual
 * languages for "selected" ship today and four different ARIA attributes carry
 * it, `ListItem` has no `selected` prop, and `grep selected src/styles/globals.css`
 * returns nothing — the design system has no selected-state token. ui#3232
 * (merged 2026-09-17) made the NetworkListItem row solid pink and explicitly
 * deferred TokenListItem, so the two lists inside ONE drawer disagree today.
 *
 * Q2: the leading slot. design.md says a ListItem leading slot is one element
 * and "never a hand-rolled composite — no mini-badge overlaid on a logo".
 * TokenListItem and the trigger both do exactly that.
 *
 * Q3: the trigger. It is a `Button variant="stroke"` overridden into a card —
 * shape, height, padding and its own hover state, all respelled at the call
 * site, which law 7 puts in `.btn-*` / `Button` and nowhere else.
 *
 * Every variant below differs ONLY in the selected-state skin: same real
 * `ListItem` rows, same six mock tokens, same markup. The listbox semantics
 * (`role="option"` + `aria-selected`) are on all four — that is the floor, not
 * a choice.
 *
 * Nothing here ships. `Global/TokenSelector/*` is untouched by this PR; the
 * winner is applied to the real components in a separate PR — with a figma
 * board, per design.md — and this directory is deleted then.
 */

// ---------------------------------------------------------------- the notes

interface SkinProposal {
    key: SkinKey
    name: string
    pitch: string
    /** which globals.css token(s) the selected state spends */
    selectedToken: string
    /** does globals.css need a new token for this look */
    newToken: string
    /** where the look is weakest */
    servesWorse: string
    /** does it also answer the OTHER list in the same drawer */
    networkRow: string
    /** the WCAG 1.4.1 answer */
    colourOnly: string
}

const SKIN_PROPOSALS: SkinProposal[] = [
    {
        key: 'fill',
        name: 'Fill',
        pitch: 'The selected row is a solid brand block, and the title and body switch to the token that exists for text on a brand fill.',
        selectedToken:
            'bg-action-primary + text-foreground-over-color-primary (#000000). Both exist. But the second has zero product call sites, and the DS audit (audit-data.ts:5613) lists it among four tokens to DELETE as exact hex duplicates — it is the same #000000 as foreground-primary. Identical pixels either way; ruling this skin also rules whether that token lives.',
        newToken:
            'No. Both tokens exist, and it kills the alpha hack: solid action-primary instead of action-primary/10.',
        servesWorse:
            'A long list. Pink is also the CTA colour, so a filled row inside a scrolling list can read as a button to press rather than as the state of the row. It is also the loudest thing on a sheet that already has a pink primary button under it.',
        networkRow:
            'Directly. This IS what ui#3232 already shipped on NetworkListItem, so picking Fill ratifies that change and ends the disagreement inside the drawer instead of leaving it pending.',
        colourOnly: 'YES — and that is the objection. WCAG 1.4.1 says colour must never be the only signal.',
    },
    {
        key: 'check',
        name: 'Check',
        pitch: 'A trailing check glyph and nothing else: no fill, no border change, no colour change.',
        selectedToken:
            'None. The row keeps border-border-default + bg-background-default and gains a 20px `check` Icon in the trailing slot.',
        newToken:
            'No — and it is the only look that needs no surface at all, so it cannot collide with a token that already means something else.',
        servesWorse:
            'Scanning. On a six-row list the only difference between selected and not is a 20px glyph at the far right edge, which is the last place the eye lands on a left-to-right row. It also competes with the trailing slot when a row already carries a badge or a value.',
        networkRow:
            'Works, but weakly, and it reverses ui#3232 — that PR moved NetworkListItem TO a fill after "find the real DS colour". Picking Check means undoing a merged change.',
        colourOnly: 'No. The signal is a glyph; colour carries nothing.',
    },
    {
        key: 'border',
        name: 'Border',
        pitch: 'The selected row keeps the normal black border; every UNSELECTED row drops to border-border-subtle. Selection by recession, not by addition.',
        selectedToken:
            'border-border-default on the selected row; border-border-subtle on the rest. Precedent: CurrencySelect and AvatarPicker both already do this.',
        newToken:
            'No, but there is a COLLISION to weigh: border-border-subtle is already the disabled border (ListItem draws disabled as border-border-subtle + bg-background-disabled). Under Border, every unselected row wears the disabled border, so "not chosen" and "cannot be chosen" look the same at a glance.',
        servesWorse:
            'A grouped list. Contiguous rows share one border box, so changing a border colour per row inside the group produces a seam at every boundary rather than a clean outline.',
        networkRow:
            'Works, and it is the quietest option in a drawer that stacks two lists. But it still reverses ui#3232.',
        colourOnly:
            'Technically no — a border weight/colour change is not hue alone — but the difference between #000000 and #9ca3af at 1px is close enough that it should be treated as a colour-only signal.',
    },
    {
        key: 'fill-check',
        name: 'Fill + check (recommended)',
        pitch: 'Both channels: the brand fill AND the trailing check. Variant 1 plus variant 2, nothing new invented.',
        selectedToken:
            'bg-action-primary + text-foreground-over-color-primary + a 20px `check` Icon. Every one of them already exists.',
        newToken: 'No.',
        servesWorse:
            'Nothing, visually — it inherits Fill’s loudness, and the glyph costs the trailing slot on a row that also wants a value or a badge. That is the one real cost: Q2’s L2 (chain as a trailing StatusBadge) and this skin compete for the same slot.',
        networkRow:
            'Directly, and it is a strict addition to ui#3232 rather than a reversal: the fill already shipped, this adds the second channel on top of it.',
        colourOnly:
            'No — and that is the argument for it. WCAG 1.4.1 is satisfied, and the DS’s own ruled Tabs look already carries two channels (colour + weight) for the same reason.',
    },
]

interface LeadingProposal {
    key: LeadingKey
    name: string
    pitch: string
    verdict: string
}

const LEADING_PROPOSALS: LeadingProposal[] = [
    {
        key: 'logo',
        name: 'L1 — token logo alone (recommended)',
        pitch: 'One element in the leading slot, exactly as the board says. The chain moves to the body line.',
        verdict:
            'Zero invention. The chain is already the tab filter above the list, so the corner badge was repeating a fact the user just chose.',
    },
    {
        key: 'badge',
        name: 'L2 — token logo, chain as a trailing badge',
        pitch: 'Leading stays one element; the chain rides the trailing slot, where "badge" is already sanctioned vocabulary.',
        verdict:
            'Legal, but it spends the trailing slot — which the Check and Fill + check skins also want — and StatusBadge has no "network" member in its status enum. This borrows `custom` + customText. A real chain badge needs a board row; flagged, not decided (law 6).',
    },
    {
        key: 'composite',
        name: 'L3 — today, banned by design.md',
        pitch: 'A 24px token logo with a 16px chain logo pinned to its corner, inside a ring.',
        verdict:
            'design.md, ListItem section, verbatim: "never a hand-rolled composite — no mini-badge overlaid on a logo." Shown so the comparison is honest. The shipped one also rings the badge in border-white with dead dark: siblings — layout.tsx hardcodes data-theme="light", so no dark: class in this component has ever rendered.',
    },
]

interface Violation {
    where: string
    fix: string
    rule: string
}

const VIOLATIONS: Violation[] = [
    {
        where: 'NetworkListItem.tsx:37',
        fix: 'The row is a ListItem, which has no fixed height. Nothing wraps a card in a Button.',
        rule: 'A 65.10px row (32px avatar + p-4) sits inside .btn’s fixed h-11 (globals.css:835) 43.99px box and spills ~10px past it on each side. Measured in the browser, evidence below. Law 3 / law 7.',
    },
    {
        where: 'TokenListItem.tsx:98 + TokenSelector.tsx:546',
        fix: 'No ring, no raw palette — the leading slot is one element.',
        rule: 'border-white + dark:border-black + dark:bg-gray-600 are raw palette (laws 1 and 2), and the dark: variants are dead: layout.tsx:160 hardcodes data-theme="light".',
    },
    {
        where: 'TokenListItem.tsx:97-111 + TokenSelector.tsx:545',
        fix: 'Q2 / L1: token logo alone, chain on the body line.',
        rule: 'ListItem leading is ONE element — "never a hand-rolled composite, no mini-badge overlaid on a logo".',
    },
    {
        where: 'TokenListItem.tsx:60 + NetworkListItem.tsx:36',
        fix: 'Both rows are the real ListItem.',
        rule: 'A hand-rolled Card + flex re-implements a component that exists. Law 7 / DRY.',
    },
    {
        where: 'TokenSelector.tsx:429',
        fix: 'Section renders its own text-heading-card; nothing is passed.',
        // the offending class strings are described, not quoted: a type token
        // beside a weight utility is itself a ratcheted lint metric, and it has
        // no allowlist for prose outside /dev/ds/audit.
        rule: 'titleClassName passes a secondary colour AND a medium weight utility, which stacks on the Section heading’s own text-body-m-semibold. A type token carries its own weight.',
    },
    {
        where: 'TokenListItem.tsx:118',
        fix: 'The body line is the ListItem body token, untouched.',
        rule: 'A medium weight utility stacked on text-body-xs — same drift.',
    },
    {
        where: 'TokenSelector.tsx:61-70',
        fix: 'The page and the drawer both use 0_Bruddle/Section.',
        rule: 'A local Section duplicates the DS one and renders text-body-m-semibold where the DS Section renders text-heading-card. Same name, two looks.',
    },
    {
        where: 'TokenSelector.tsx:579 + TokenListItem.tsx:143 + NetworkListItem.tsx:87',
        fix: 'ListItem draws chevron-right at 20 through its own chevron prop.',
        rule: 'chevron-up rotated 90° at size 24. The board says the trailing chevron is 20, and chevron-right is in the registry.',
    },
    {
        where: 'NetworkListItem.tsx:50 vs TokenListItem.tsx:63,74',
        fix: 'One skin, applied to both lists.',
        rule: 'Solid bg-action-primary for a selected network, bg-action-primary/10 for a selected token — the same concept, two looks, in one drawer. This is Q1.',
    },
    {
        where: 'TokenListItem.tsx (whole file)',
        fix: 'role="listbox" / role="option" + aria-selected on every skin.',
        rule: 'No aria-selected and no aria-pressed anywhere: a screen reader cannot tell which token is picked.',
    },
    {
        where: 'TokenSelector.tsx:491',
        fix: '0_Bruddle/Notification, which sets role="alert" for attention and error itself.',
        rule: 'A hand-rolled attention banner (bg-background-badge-attention + p-3) instead of the component, and no role at all.',
    },
    {
        where: 'NetworkListView.tsx:69',
        fix: 'Network filtering is the Tabs row inside the sheet. No page header is rendered inside a drawer.',
        rule: 'A page-level NavHeader rendered INSIDE a DrawerContent. No board and no page recipe covers that.',
    },
    {
        where: 'NetworkListView.tsx:77',
        fix: 'One gap-4 column.',
        rule: 'space-y-2 AND gap-3 on the same flex column — 20px effective, off the spacing scale.',
    },
    {
        where: 'TokenListItem.tsx:62,73',
        fix: 'One Card, one shadow system, no wrapper.',
        rule: 'A soft shadow-sm wrapper under a hard shadow-4 card: two shadow systems on one row.',
    },
    {
        where: 'TokenListItem.tsx:64',
        fix: 'ListItem disabled — it already draws border-border-subtle + bg-background-disabled.',
        rule: 'opacity-70 for disabled. design.md marks the disabled treatment RESOLVED, and opacity is not it.',
    },
    {
        where: 'TokenSelector.tsx:585',
        fix: 'Nothing. DrawerContent’s scroll area already caps and centres the column.',
        rule: 'mx-auto md:max-w-2xl inside a scroll area that is already mx-auto md:max-w-xl — dead, and a desktop-only width is against the device rules.',
    },
    {
        where: 'TokenSelector.tsx:307-314',
        fix: 'Substring match on symbol, name and chain. Type "usd" in the drawer above.',
        rule: 'Exact match (symbol === query, address === query, name === query), so "usd" returns nothing at all.',
    },
    {
        where: 'TokenSelector.tsx:411',
        fix: 'The search field sits ABOVE the tabs, outside every panel.',
        rule: 'SearchInput lives inside the tab panel, so every tab switch unmounts it and takes the focus and caret with it.',
    },
    {
        where: 'TokenSelector.tsx:238-254',
        fix: 'Not answered here — flagged. A skeleton row needs a board.',
        rule: 'There is no skeleton anywhere. An unloaded catalog renders a hardcoded USDC-on-Arbitrum row that looks like real data.',
    },
    {
        where: 'TokenSelector.tsx:49',
        fix: 'Not answered here — flagged. Logo URLs are data, not component source.',
        rule: 'A hardcoded assets.coingecko.com URL is baked into the component as a fallback.',
    },
]

// ---------------------------------------------------------------- scaffold

const Demo = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2">
        <p className="text-label-m text-foreground-secondary uppercase">{label}</p>
        <div className="bg-background-default p-4">{children}</div>
    </div>
)

const NoteRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1 py-3">
        <p className="text-label-m text-foreground-secondary uppercase">{label}</p>
        <p className="text-body-s text-foreground-primary">{children}</p>
    </div>
)

const NoteCard = ({ children }: { children: ReactNode }) => (
    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
        {children}
    </Card>
)

/** Each skin gets its own selection state, so scrolling the page compares looks, not clicks. */
const SkinDemo = ({ skin }: { skin: SkinKey }) => {
    const [selectedId, setSelectedId] = useState(MOCK_TOKENS[0].id)
    return (
        <TokenOptionList
            tokens={MOCK_TOKENS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            skin={skin}
            leading="logo"
            aria-label={`${skin} tokens`}
        />
    )
}

const LeadingDemo = ({ leading }: { leading: LeadingKey }) => {
    const [selectedId, setSelectedId] = useState(MOCK_TOKENS[0].id)
    return (
        <TokenOptionList
            tokens={MOCK_TOKENS.slice(0, 4)}
            selectedId={selectedId}
            onSelect={setSelectedId}
            skin="fill-check"
            leading={leading}
            aria-label={`${leading} leading`}
        />
    )
}

export default function TokenSelectorProposalsPage() {
    const [triggerToken] = useState(MOCK_TOKENS[0])

    return (
        <DevPageShell
            title="Token selector looks"
            description="Three rulings the TokenSelector rebuild needs first: what a selected row looks like, what goes in the leading slot, and what the trigger is. Every variant uses the same real ListItem rows and the same six mock tokens. Nothing here ships."
            width="prose"
        >
            <div className="flex flex-col gap-10">
                <Notification priority="info" title="The design system has no selected-state token">
                    Six visual languages for &ldquo;selected&rdquo; ship today and four different ARIA attributes carry
                    it. <code>ListItem</code> has no <code>selected</code> prop, and{' '}
                    <code>grep selected src/styles/globals.css</code> returns nothing. The one obvious candidate is
                    already spent twice: <code>bg-background-disabled</code> is both the pressed and the disabled fill
                    in ListItem.tsx:77-78, so it cannot also mean selected. The design system says so itself:{' '}
                    <code>0_Bruddle/Tabs.tsx</code>, whose Weight look kush ruled on 2026-09-18, carries this in its own
                    docblock — &ldquo;Because there is no fill, this look says NOTHING about how a selected list row
                    should look. The app-wide selected-surface question is still open — see ui#3232&rsquo;s pink
                    NetworkListItem.&rdquo; That open question is this page. Picking a skin below closes it.
                </Notification>

                <Section title="0 — what ships today" className="gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        Every row is a real call site, read at this commit. The last column is what a screen reader is
                        told.
                    </p>
                    <NoteCard>
                        <NoteRow label="TokenSelector network row — Components/NetworkListItem.tsx:50">
                            Solid <code>bg-action-primary</code> · <code>aria-pressed</code>
                        </NoteRow>
                        <NoteRow label="TokenSelector token row — Components/TokenListItem.tsx:63,74">
                            <code>bg-action-primary/10</code>, applied TWICE (wrapper and card) · no ARIA at all
                        </NoteRow>
                        <NoteRow label="CountryCombobox option — Common/CountryCombobox.tsx:226">
                            Solid <code>bg-action-primary</code> + <code>text-foreground-inverse</code> + trailing check
                            · <code>aria-selected</code>
                        </NoteRow>
                        <NoteRow label="BaseSelect item — 0_Bruddle/BaseSelect.tsx:121">
                            Solid <code>bg-action-primary</code> + <code>text-foreground-inverse</code> + check
                            indicator · radix <code>data-state=checked</code>
                        </NoteRow>
                        <NoteRow label="LanguageView row — Settings/LanguageView.tsx:72">
                            Trailing <code>check</code> icon only, no fill · no ARIA. The only ListItem-native precedent
                            in the app.
                        </NoteRow>
                        <NoteRow label="CurrencySelect row — LandingPage/CurrencySelect.tsx:251,280">
                            <code>border border-border-default</code> + trailing success icon, no fill ·{' '}
                            <code>aria-selected</code>
                        </NoteRow>
                        <NoteRow label="AvatarPicker tile — Avatar/AvatarPicker.tsx:164">
                            <code>border-2 border-border-default</code> · <code>aria-checked</code>
                        </NoteRow>
                        <NoteRow label="LocaleSwitcher — Marketing/LocaleSwitcher.tsx:126">
                            <code>bg-action-primary/20</code> · <code>aria-current</code>
                        </NoteRow>
                        <NoteRow label="Already ruled once">
                            ui#3232 (merged 2026-09-17) changed NetworkListItem from <code>/10</code> to solid pink
                            after &ldquo;find the real DS colour&rdquo;, and explicitly deferred TokenListItem. So the
                            two lists inside ONE drawer disagree today.
                        </NoteRow>
                    </NoteCard>
                </Section>

                {SKIN_PROPOSALS.map((proposal, index) => (
                    <Section key={proposal.key} title={`${index + 1} — ${proposal.name}`} className="gap-4">
                        <p className="text-body-s text-foreground-secondary">{proposal.pitch}</p>

                        <Demo label="a · six tokens, one selected — tap a row to move the selection">
                            <SkinDemo skin={proposal.key} />
                        </Demo>

                        <NoteCard>
                            <NoteRow label="Selected token">{proposal.selectedToken}</NoteRow>
                            <NoteRow label="Needs a new globals.css token">{proposal.newToken}</NoteRow>
                            <NoteRow label="Serves this worse">{proposal.servesWorse}</NoteRow>
                            <NoteRow label="As a NetworkListItem selected row">{proposal.networkRow}</NoteRow>
                            <NoteRow label="Colour is the only channel">{proposal.colourOnly}</NoteRow>
                        </NoteCard>
                    </Section>
                ))}

                <Section title="5 — the leading slot" className="gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        design.md, ListItem section, verbatim: &ldquo;ListItem leading is one element: an IconBubble, a
                        flag, a brand/chain logo, or an avatar. never a hand-rolled composite — no mini-badge overlaid
                        on a logo.&rdquo; All three rows below use the recommended Fill + check skin, so only the
                        leading slot changes.
                    </p>
                    {LEADING_PROPOSALS.map((proposal, index) => (
                        <div key={proposal.key} className="flex flex-col gap-2">
                            <Demo label={`${'abc'[index]} · ${proposal.name}`}>
                                <LeadingDemo leading={proposal.key} />
                            </Demo>
                            <NoteCard>
                                <NoteRow label="Pitch">{proposal.pitch}</NoteRow>
                                <NoteRow label="Verdict">{proposal.verdict}</NoteRow>
                            </NoteCard>
                        </div>
                    ))}
                </Section>

                <Section title="6 — the trigger" className="gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        Today the trigger is a <code>Button variant=&quot;stroke&quot;</code> overridden into a card:{' '}
                        <code>min-h-16 rounded-sm bg-background-default p-4</code> plus two hover overrides that neuter
                        the Button&rsquo;s own press feedback. design.md law 7: &ldquo;this lives in the{' '}
                        <code>.btn-*</code> classes / Button — never re-implement per call site.&rdquo;
                    </p>
                    <Demo label="a · T1 — a real ListItem with a chevron (recommended)">
                        <ListItemTrigger token={triggerToken} onClick={() => undefined} />
                    </Demo>
                    <Demo label="b · T2 — today, a button beaten into a card">
                        <FakeCardTrigger token={triggerToken} onClick={() => undefined} />
                    </Demo>
                    <NoteCard>
                        <NoteRow label="T1 — real ListItem">
                            A row that opens a picker IS a list row: <code>position=&quot;single&quot;</code>, title,
                            body, chevron. No className, no shape override, no height override, and the press state,
                            focus ring and haptic come from the component.
                        </NoteRow>
                        <NoteRow label="T2 — today">
                            Overrides the Button board&rsquo;s shape (pill to rounded-sm), its height (h-11 to
                            min-h-16), its padding (px-3 to p-4) and its hover. The 4px shadow is already the stroke
                            default, so <code>shadowSize=&quot;4&quot;</code> is a no-op kept from an older branch.
                        </NoteRow>
                    </NoteCard>
                </Section>

                <Section title="7 — the composed picker" className="gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        The whole thing, interactive, built only from DS parts and the recommended skin. Open it, type{' '}
                        <code>usd</code>, and switch a tab while the field has focus.
                    </p>
                    <Demo label="a · open the drawer">
                        <ComposedPicker skin="fill-check" leading="logo" />
                    </Demo>
                    <NoteCard>
                        <NoteRow label="The search field is above the tabs">
                            Today it lives inside the tab panel (TokenSelector.tsx:411), so every tab switch unmounts it
                            and takes the focus and the caret with it. Above the tabs it survives.
                        </NoteRow>
                        <NoteRow label="Search is substring">
                            Today&rsquo;s is exact match (TokenSelector.tsx:307-314), so typing <code>usd</code> returns
                            nothing. Here it matches symbol, name and chain.
                        </NoteRow>
                        <NoteRow label="The rows are one grouped card">
                            <code>getCardPosition(i, n)</code> makes contiguous rows sharing one border. Today it is N
                            separate <code>position=&quot;single&quot;</code> cards in a <code>gap-3</code> stack.
                        </NoteRow>
                        <NoteRow label="The network row is a contentless Tabs">
                            This branch is based on ui#3251, so <code>Tabs</code> here is the ruled Weight look
                            (TASK-22707): type only, no rule, no border, no fill. <code>content</code> is now optional,
                            and the network row omits it on every tab — only the trigger row renders, and the token list
                            is a normal sibling beneath it. That is the shape the <code>Tabs</code> docblock prescribes
                            for a value toggle.
                        </NoteRow>
                        <NoteRow label="Flagged, not invented (law 6)">
                            <code>ListItem</code> has no <code>selected</code> prop and forwards no <code>role</code> /{' '}
                            <code>aria-selected</code>, so the listbox semantics ride a wrapper element and the row
                            loses ListItem&rsquo;s own <code>onClick</code> haptic. The promotion PR should add{' '}
                            <code>selected</code> + ARIA to <code>ListItem</code> itself rather than repeat this wrapper
                            at every call site. Same for the empty catalog: there is no skeleton board, so no skeleton
                            is proposed.
                        </NoteRow>
                    </NoteCard>
                </Section>

                <Section title="8 — conformance" className="gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        Every row is a design.md rule the shipped selector breaks, the line it breaks it on, and what
                        the proposal above does instead. Two rows are flagged rather than answered.
                    </p>
                    <NoteCard>
                        {VIOLATIONS.map((violation) => (
                            <div key={violation.where} className="flex flex-col gap-1 py-3">
                                <p className="text-label-m text-foreground-secondary uppercase">{violation.where}</p>
                                <p className="text-body-s text-foreground-primary">{violation.rule}</p>
                                <p className="text-body-s text-foreground-secondary">{violation.fix}</p>
                            </div>
                        ))}
                    </NoteCard>
                    <Demo label="evidence for row 1 · the REAL NetworkListItem, imported unchanged">
                        <NetworkListItem chainId="42161" name="Arbitrum" iconUrl="" isSelected />
                    </Demo>
                    <p className="text-body-s text-foreground-secondary">
                        The row above is <code>Global/TokenSelector/Components/NetworkListItem</code> itself, not a
                        reproduction. Measured in the browser at 375px: the <code>Button</code> box is{' '}
                        <code>43.99px</code> (<code>.btn</code>&rsquo;s fixed <code>h-11</code>, globals.css:835) and
                        the <code>Card</code> inside it is <code>65.10px</code>, starting <code>10.55px</code> above the
                        button&rsquo;s own top edge. The card spills roughly 10px past the control on each side. The
                        drawn row and the control&rsquo;s box are two different rectangles, so the focus ring, the tap
                        target and every gap around the row are computed on a height the user never sees.
                    </p>
                </Section>

                <Notification priority="info" title="Scope">
                    These looks live only under /dev/token-selector. <code>Global/TokenSelector/TokenSelector.tsx</code>
                    , <code>TokenListItem</code>, <code>NetworkListItem</code> and <code>NetworkListView</code> are
                    untouched by this PR. The winner is applied to the real components in a separate PR — with a figma
                    board, per design.md — and this directory is deleted then.
                </Notification>
            </div>
        </DevPageShell>
    )
}
