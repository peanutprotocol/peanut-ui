// The content-page visual rules (drift-audit rulings of 2026-10-14/15). Each
// entry names a bare demo page under /dev/ds-marketing-preview, rendered in an
// iframe at a true 390/1440 viewport. VISUAL rules only — structure rules live
// in content/_system/guidelines/components.md.

import type { PreviewViewport } from '@/app/dev/ds-marketing-preview/_components/viewport'

export interface ContentDemo {
    demo: string
    title: string
    rule: string
    heights: Record<PreviewViewport, number>
    /** a demo that shows a ruled state a fix branch still owes carries the note */
}

export const CONTENT_DEMOS: ContentDemo[] = [
    {
        demo: 'content-hero',
        title: 'Plain pink hero',
        rule: 'Every content page opens with the plain pink mdx Hero — compare, send-to, pricing, help, and the blog (which gains it). No knerd, no mascot: those belong to the LP heroes.',
        heights: { phone: 620, desktop: 700 },
    },
    {
        demo: 'content-faq',
        title: 'Content FAQ',
        rule: 'The panel heading is the ONLY heading — authors pass title= to <FAQ> in mdx and never write an h2 above it. Inline, the panel sits in the prose column and follows the prose rhythm.',
        heights: { phone: 640, desktop: 640 },
    },
    {
        demo: 'content-table',
        title: 'Table treatment',
        rule: 'Plain tokens, no tints: cream header row (background-page), white body rows (background-default), full-strength border-default rules. A table wider than the phone scrolls inside its border.',
        heights: { phone: 400, desktop: 380 },
    },
    {
        demo: 'prose-container',
        title: 'Gutter and prose measure',
        rule: 'One 24px side inset at 390 — bands, prose and footer share it — and the 640 prose container, always centred. The pink strips in the demo are the inset itself.',
        heights: { phone: 560, desktop: 480 },
    },
    {
        demo: 'page-header',
        title: 'Page header',
        rule: 'Every non-landing marketing page carries the strip: cream row, back circle floating over its left edge, locale switcher flush right. Home and /lp keep the bare hero. The brand book’s nav bar is marked outdated.',
        heights: { phone: 640, desktop: 700 },
    },
]
