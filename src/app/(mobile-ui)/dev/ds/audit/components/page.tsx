'use client'

import { UsageAudit, type UsageCategory } from '../../_components/UsageAudit'

// build-time gate — mirrors DEV_TOOLS_ENABLED; see ../page.tsx for why the
// condition must stay inline. drops ~58KB of audit data from prod bundles.
const BIG_COMPONENT_CATEGORIES: UsageCategory[] =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- see ../page.tsx
          (require('./audit-components-data') as typeof import('./audit-components-data')).BIG_COMPONENT_CATEGORIES
        : []

export default function BigComponentsPage() {
    return (
        <UsageAudit
            eyebrow="Design System · Big Components"
            title="Modals, drawers, lists & cards"
            heroClass="bg-avatar-purple-border"
            intro={
                <>
                    The primitives are small; the real inconsistency lives in the <em>large composite</em> components.
                    The app has many near-identical modals, several unrelated drawer patterns, and a handful of list/row
                    implementations that never share code. Each row shows its real product usage and how it diverges
                    from its siblings — this is the drawer/modal/list consolidation worklist.
                </>
            }
            categories={BIG_COMPONENT_CATEGORIES}
            footnote={
                <>
                    <span className="font-bold text-foreground-primary">Method:</span> every modal / drawer / list /
                    composite-card component was enumerated by grep, real usage counted (excl <code>/dev</code> +
                    tests), and divergences characterized (radius, padding, close behavior, header pattern).
                    Dead/showcase-only claims were independently re-verified.
                </>
            }
        />
    )
}
