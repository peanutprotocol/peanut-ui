// The content-page visual rules. Each entry names a bare demo page under
// /dev/ds-marketing-preview, rendered in an iframe at a true 390/1440 viewport.
// VISUAL rules only — structure and copy rules live in
// content/_system/guidelines/components.md.

import type { PreviewViewport } from '@/app/dev/ds-marketing-preview/_components/viewport'

export interface ContentDemo {
    demo: string
    title: string
    /** the rule, one line */
    rule: string
    /** the code to copy, when there is one */
    code?: string
    heights: Record<PreviewViewport, number>
}

export const CONTENT_DEMOS: ContentDemo[] = [
    {
        demo: 'content-hero',
        title: 'Hero',
        rule: 'Every content page opens with the plain pink Hero, blog included. No Knerd, no mascot.',
        code: `<Hero title="Peanut vs Wise" subtitle="Compare QR payments and transfers" cta="Create an account" ctaHref="https://peanut.me/invite?code=SQUIRRELINVITESYOU&utm_medium=content&utm_source=compare&utm_campaign=wise&utm_content=hero" />`,
        heights: { phone: 620, desktop: 700 },
    },
    {
        demo: 'content-faq',
        title: 'FAQ',
        rule: 'The panel owns its heading. Pass title= to <FAQ>; never write an h2 above it.',
        code: `<FAQ title="Questions about fees">
    <FAQItem question="Is there a fee to receive money?">No. Receiving is free.</FAQItem>
    <FAQItem question="What does a transfer cost?">See the pricing page for your corridor.</FAQItem>
</FAQ>`,
        heights: { phone: 640, desktop: 640 },
    },
    {
        demo: 'content-table',
        title: 'Tables',
        rule: 'Cream header row, white body rows, border-default rules. No tints, no stripes. Wide tables scroll inside their border.',
        heights: { phone: 400, desktop: 380 },
    },
    {
        demo: 'prose-container',
        title: 'Gutter and measure',
        rule: '24px side inset at 390 (px-6), 640px prose column (PROSE_WIDTH), centred.',
        code: `<article className={\`mx-auto \${PROSE_WIDTH} px-6 md:px-4\`}>`,
        heights: { phone: 560, desktop: 480 },
    },
    {
        demo: 'page-header',
        title: 'Page header',
        rule: 'Every non-landing page gets the strip: back circle left, locale switcher right. Home and /lp get none. The (marketing) layout renders it.',
        heights: { phone: 640, desktop: 700 },
    },
]
