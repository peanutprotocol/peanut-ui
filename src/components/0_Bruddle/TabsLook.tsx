'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { PILL_THUMB_SELECTED, PILL_TINT_SELECTED, PILL_TRACK, PILL_TRACK_INVERTED } from './PillSurface'

/**
 * TASK-22707 scaffolding — the 6 candidate looks for the ONE tabs component,
 * plus a context that lets `/dev/tabs-proposals/*` re-skin a REAL screen
 * without editing that screen.
 *
 * Why a context and not a prop: the proposal pages mount real product and
 * marketing surfaces (MantecaLimitsView, ExplorerHeader, FilterPanel,
 * RhinoDepositView, TokenSelector, the MDX Tabs adapter) six times each. Those
 * screens own their own tab markup several levels down, so a prop would mean
 * editing every call site to carry a demo-only value. `Tabs` and
 * `SegmentedControl` read this context instead: with no provider above them —
 * which is every shipped screen — they render exactly as they do on dev today.
 *
 * Nothing here ships. The winning look is written into `Tabs` directly in a
 * separate PR and this file is deleted with `/dev/tabs-proposals`.
 */

export type TabsLook = 'rule' | 'awning' | 'blush' | 'frame' | 'weight' | 'track' | 'navA' | 'navB'

/** the original six, still rendered by /dev/tabs-proposals and its surfaces page */
export const TABS_LOOK_KEYS: TabsLook[] = ['rule', 'awning', 'blush', 'frame', 'weight', 'track']

/** the bottom-nav look, in its two polarities — /dev/tabs-proposals/nav */
export const NAV_LOOK_KEYS: TabsLook[] = ['navA', 'navB']

export const TABS_LOOK_NAMES: Record<TabsLook, string> = {
    rule: 'Rule',
    awning: 'Awning',
    blush: 'Blush',
    frame: 'Frame',
    weight: 'Weight',
    track: 'Track',
    navA: 'A — selected white (matches BottomNav)',
    navB: 'B — selected page tint',
}

interface LookStyle {
    list: string
    trigger: string
}

// the one focus treatment (matches .btn in globals.css). #3251's pill had none.
export const TAB_FOCUS_RING =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// the same ring, drawn unconditionally, so a screenshot can show the focus
// state — :focus-visible cannot be forced from CSS. Demo-only.
export const TAB_FORCED_RING = 'z-10 outline-[3px] outline-solid outline-action-focus'

// every trigger, whatever the skin
export const TAB_TRIGGER_BASE =
    'relative flex min-h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap transition-colors duration-instant'

// the ring must not clip at the scroll edges, so the wrapper owns overflow with
// a 4px inner gutter (>=3px ring) and a negative margin to keep the layout
export const TAB_SCROLL_WRAP = '-m-1 overflow-x-auto p-1'

export const TAB_LOOKS: Record<TabsLook, LookStyle> = {
    /**
     * Rule — the row sits on a full-width 1px rule; the active tab thickens it
     * to 2px under its own label. No fill anywhere.
     * selected token: `border-border-default` + `text-foreground-primary`.
     */
    rule: {
        list: 'border-b border-border-default',
        trigger:
            'border-b-2 border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Awning — the affordance sits on TOP: the active tab wears a 2px brand cap
     * over a white fill, so the row reads as a set of cards standing up.
     * selected token: `border-action-primary` cap + `bg-background-default`.
     */
    awning: {
        list: 'gap-1',
        trigger:
            'rounded-b-sm border-t-2 border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-action-primary data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Blush — the active tab is a solid brand block. The loudest option, and the
     * one that ratifies `action-primary` as THE selected surface app-wide
     * (which is what ui#3232 already did to NetworkListItem).
     * selected token: `bg-action-primary` + `text-foreground-over-color-primary`.
     */
    blush: {
        list: 'gap-2',
        trigger:
            'rounded-sm px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:bg-action-primary data-[state=active]:text-foreground-over-color-primary',
    },

    /**
     * Frame — the active tab is a bordered white box, the shipped `card` look
     * with the weld cut off. Same geometry panelled and standalone.
     * selected token: `border-border-default` + `bg-background-default`.
     */
    frame: {
        list: 'gap-2',
        trigger:
            'rounded-sm border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Weight — type only: no rule, no border, no fill. The active label goes
     * black and semibold, the rest stay secondary.
     * The two states carry two DIFFERENT type tokens rather than one token plus
     * a font-weight utility — a type token owns its own weight (design.md type
     * rules), and the states are mutually exclusive so nothing stacks.
     * selected token: `text-foreground-primary` + body-m-semibold. Nothing else.
     */
    weight: {
        list: 'gap-6',
        trigger:
            'px-0 text-foreground-secondary active:text-action-ghost-hover data-[state=inactive]:text-body-m data-[state=active]:text-body-m-semibold data-[state=active]:text-foreground-primary',
    },

    /**
     * Track — the row is a recessed container and the active tab is a card
     * raised out of it. The only look here that needs a surface the DS does not
     * have: `background-page` is the PAGE tint, borrowed as a track.
     * selected token: `bg-background-default` + `border-border-default`,
     * on a track that wants a NEW `--color-background-track`.
     */
    track: {
        list: 'gap-0.5 rounded-sm bg-background-page p-0.5',
        trigger:
            'rounded-sm border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },

    /**
     * A — the bottom nav, standing still. Same bar as `Global/BottomNav`: a
     * bordered pill track on the page tint with a bordered WHITE chip on the
     * selected tab. `shadow-4`, the spring and the sliding thumb are dropped,
     * so this is the nav's resting geometry and nothing else.
     * selected token: `bg-background-default` + `border-border-default`,
     * on a `bg-background-page` track. No new token.
     */
    navA: {
        list: `gap-0 p-0.5 ${PILL_TRACK}`,
        trigger: `rounded-round border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover ${PILL_THUMB_SELECTED} data-[state=active]:text-foreground-primary`,
    },

    /**
     * B — the same bar with the two fills swapped: a white track, and the
     * selected chip carries the page tint. Every other pixel is identical to A,
     * so the pair isolates ONE decision — which fill means selected.
     * selected token: `bg-background-page` + `border-border-default`,
     * on a `bg-background-default` track. No new token.
     */
    navB: {
        list: `gap-0 p-0.5 ${PILL_TRACK_INVERTED}`,
        trigger: `rounded-round border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover ${PILL_TINT_SELECTED} data-[state=active]:text-foreground-primary`,
    },
}

const TabsLookContext = createContext<TabsLook | null>(null)

/** null on every shipped screen — `Tabs` and `SegmentedControl` then use their own styles */
export const useTabsLook = (): LookStyle | null => {
    const look = useContext(TabsLookContext)
    return look ? TAB_LOOKS[look] : null
}

/** dev only: re-skin every `Tabs` / `SegmentedControl` in the subtree */
export const TabsLookProvider = ({ look, children }: { look: TabsLook; children: ReactNode }) => (
    <TabsLookContext.Provider value={look}>{children}</TabsLookContext.Provider>
)
