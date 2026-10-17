// The landing-page recipe data (drift-audit rulings of 2026-10-14/15). Each
// framed demo names a bare page under /dev/ds-marketing-preview, rendered in
// an iframe at a true 390/1440 viewport so the breakpoints really switch.

import type { PreviewViewport } from '@/app/dev/ds-marketing-preview/_components/viewport'

export interface HeroRecipe {
    demo: string
    name: string
    /** the one-line placement rule (q4) */
    useWhen: string
    heights: Record<PreviewViewport, number>
    /** a demo that stands in for work another branch owes carries the note */
    note?: string
}

export const HERO_RECIPES: HeroRecipe[] = [
    {
        demo: 'key-visual-hero',
        name: 'Key visual',
        useWhen: 'Use when: the page is the main LP — home and /lp, nowhere else.',
        heights: { phone: 844, desktop: 900 },
    },
    {
        demo: 'product-split-hero',
        name: 'Product split',
        useWhen: 'Use when: a star-feature or campaign sub-LP leads with the one product it sells.',
        heights: { phone: 1000, desktop: 760 },
        note: 'Component: Marketing/ProductSplitHero — /shhhhh is the first caller. Star-feature LPs build on it; never rebuild the split by hand.',
    },
    {
        demo: 'content-hero',
        name: 'Plain pink content hero',
        useWhen: 'Use when: every content page — compare, send-to, pricing, help, and the blog (which gains it).',
        heights: { phone: 620, desktop: 700 },
    },
]

export interface ContainerSpec {
    label: string
    px: number
    role: string
    /** quarter-scale bar width (v4 numeric spacing: px / 4) */
    barClass: string
}

/** container-grid A: three containers, always centred */
export const CONTAINER_SET: ContainerSpec[] = [
    { label: 'Landing', px: 1280, role: 'LP folds (max-w-6xl)', barClass: 'w-80' },
    { label: 'Hub', px: 720, role: 'content hubs — rows, not sentences (HUB_WIDTH)', barClass: 'w-45' },
    { label: 'Prose', px: 640, role: 'reading column (PROSE_WIDTH)', barClass: 'w-40' },
]

export interface PaddingStep {
    label: string
    /** full-scale block height (heights are not spacing classes, so the
     *  96px step can render at true size without an off-scale padding) */
    barClass: string
}

/** section-rhythm A: one section step — 64 at 390, 96 at 1440 */
export const SECTION_PADDING: PaddingStep[] = [
    { label: '64px — band padding at 390', barClass: 'h-16' },
    { label: '96px — band padding at 1440', barClass: 'h-24' },
]

/** cta-on-band-variant E + cta-hierarchy A + cta-casing B */
export const CTA_RULES = [
    'On a coloured band (pink, yellow): Button variant=secondary size=large — the white pill, 48px tall, 24px inset, 18px label (ruled 2026-10-17, konrad) — no visual overrides.',
    'Every marketing CTA is size=large: the DS default (44px, 12px inset) is a fill-width geometry and reads cramped once the pill hugs its label.',
    'On cream (the page ground): Button variant=primary — the pink pill.',
    'On a dark ground (the gray-950 black band): Button variant=primary — the black offset shadow does not read on black, the pink fill does.',
    'Labels are sentence case everywhere.',
]

/** the marketing CTA motion layer (ruled 2026-10-16, konrad) */
export const CTA_MOTION_RULES = [
    'Every marketing CTA is the plain DS Button plus CTA_MOTION (the .cta-motion class) — one class, no per-site variant.',
    'Entrance: on mount the CTA fades in from 4px low and 0.75deg tilted, 500ms on ease-spring.',
    'Hover (real-hover devices only): the CTA drops 6px and tilts 0.75deg, 500ms on ease-spring; the 4px DS press still applies on top.',
    "Geometry, variant, colour and the press stay the DS Button's: w-fit, size=large, no overrides.",
    'prefers-reduced-motion: no entrance, no hover move, no parked offset — only the DS press.',
    'App screens never take it; the sticky mobile CTA keeps its own slide-in.',
]
