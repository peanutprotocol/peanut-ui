'use client'

import { UsageAudit } from '../../_components/UsageAudit'
import { APP_DIVERGENCE_CATEGORIES } from './audit-app-data'

export default function AppDivergencesPage() {
    return (
        <UsageAudit
            eyebrow="Design System · App Divergences"
            title="What the live product actually renders"
            heroClass="bg-teal-1"
            intro={
                <>
                    The code audit counts every call-site. This one counts only <em>real product</em> usage — greps with{' '}
                    <code className="rounded bg-n-1/10 px-1">/dev</code> and tests removed. A lot of &ldquo;design
                    system&rdquo; exists in code but is rendered on <span className="rounded bg-n-1/10 px-1">zero</span>{' '}
                    app screens (e.g. <code className="rounded bg-n-1/10 px-1">bg-peanut-repeat-*</code>, the{' '}
                    <code className="rounded bg-n-1/10 px-1">Title</code> primitive). Those are labeled{' '}
                    <span className="rounded bg-n-1/10 px-1">showcase-only</span> /{' '}
                    <span className="rounded bg-n-1/10 px-1">dead</span>.
                </>
            }
            categories={APP_DIVERGENCE_CATEGORIES}
            footnote={
                <>
                    <span className="font-bold text-n-1">Method:</span> real usage ={' '}
                    <code>grep -rln … | grep -v /dev/ | grep -v .test.</code> across <code>src/</code>. Every
                    dead/showcase-only claim was independently re-grepped by a second agent (adversarial verify) before
                    being flagged — the verifier defaults to &ldquo;not dead&rdquo; unless it can prove zero product
                    usage. Counts are call-site counts, not render counts.
                </>
            }
        />
    )
}
