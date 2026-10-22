// The landing-page recipe data. Each framed demo names a bare page under
// /dev/ds-marketing-preview, rendered in an iframe at a true 390/1440 viewport
// so the breakpoints really switch.

import type { PreviewViewport } from '@/app/dev/ds-marketing-preview/_components/viewport'

export interface HeroRecipe {
    demo: string
    name: string
    /** where this hero goes, one line */
    useWhen: string
    /** the import to copy */
    component: string
    heights: Record<PreviewViewport, number>
}

export const HERO_RECIPES: HeroRecipe[] = [
    {
        demo: 'key-visual-hero',
        name: 'Key visual',
        useWhen: 'Home and /lp only.',
        component: "import { Hero } from '@/components/LandingPage/hero'",
        heights: { phone: 844, desktop: 900 },
    },
    {
        demo: 'product-split-hero',
        name: 'Product split',
        useWhen: 'Star-feature and campaign LPs. Never rebuild the split by hand.',
        component: "import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'",
        heights: { phone: 1000, desktop: 760 },
    },
    {
        demo: 'product-split-hero-center',
        name: 'Product split, centred',
        useWhen:
            'Star-feature LPs, through StarLpHero in Marketing/StarLp. Phones put the art between the copy and the CTA.',
        component: "import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'",
        heights: { phone: 1000, desktop: 760 },
    },
    {
        demo: 'content-hero',
        name: 'Content hero',
        useWhen: 'Every content page, blog included.',
        component: "import { Hero } from '@/components/Marketing/mdx/Hero'",
        heights: { phone: 620, desktop: 700 },
    },
]

export interface ContainerSpec {
    label: string
    px: number
    className: string
    /** quarter-scale bar width (v4 numeric spacing: px / 4) */
    barClass: string
}

/** three containers, always centred */
export const CONTAINER_SET: ContainerSpec[] = [
    { label: 'LP folds', px: 1280, className: 'max-w-6xl', barClass: 'w-80' },
    { label: 'Content hubs', px: 720, className: 'HUB_WIDTH', barClass: 'w-45' },
    { label: 'Prose', px: 640, className: 'PROSE_WIDTH', barClass: 'w-40' },
]

export interface PaddingStep {
    label: string
    /** full-scale block height (heights are not spacing classes, so the
     *  96px step can render at true size without an off-scale padding) */
    barClass: string
}

/** one section step — 64 at 390, 96 at 1440 */
export const SECTION_PADDING: PaddingStep[] = [
    { label: '64px at 390 (spacing step 16)', barClass: 'h-16' },
    { label: '96px at 1440 (spacing step 24)', barClass: 'h-24' },
]

export const CTA_SNIPPET = `import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'

// on a pink or yellow band
<Button variant="secondary" size="large" href="/setup" className={\`w-fit \${CTA_MOTION}\`}>
    Get the app
</Button>

// on cream or on the black band
<Button variant="primary" size="large" href="/setup" className={\`w-fit \${CTA_MOTION}\`}>
    Get the app
</Button>`
