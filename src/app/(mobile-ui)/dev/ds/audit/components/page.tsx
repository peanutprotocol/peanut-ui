'use client'

import { UsageAudit } from '../../_components/UsageAudit'
import { BIG_COMPONENT_CATEGORIES } from './audit-components-data'

export default function BigComponentsPage() {
    return (
        <UsageAudit
            eyebrow="Design System · Big Components"
            title="Modals, drawers, lists & cards"
            heroClass="bg-primary-4"
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
                    <span className="font-bold text-n-1">Method:</span> every modal / drawer / list / composite-card
                    component was enumerated by grep, real usage counted (excl <code>/dev</code> + tests), and
                    divergences characterized (radius, padding, close behavior, header pattern). Dead/showcase-only
                    claims were independently re-verified.
                </>
            }
        />
    )
}
