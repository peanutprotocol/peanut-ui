import { FAQsPanel } from '@/components/Global/FAQs'
import { PROSE_WIDTH } from '@/components/Marketing/constants'
import { DEMO_FAQ_ITEMS } from '../_components/preview-data'

// The content-page FAQ (faq-double-heading A, ruled 2026-10-14): the PANEL
// heading is the only heading — authors pass title= to <FAQ> in mdx and never
// write an h2 above it. Visual twin of what Marketing/mdx/FAQ.tsx renders:
// the inline panel sits in the prose column and follows the prose rhythm.
export default function ContentFaqPreview() {
    return (
        <main className="bg-background-page py-10">
            <article className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
                <p className="mb-6 text-body-m leading-7 text-foreground-secondary">
                    The prose above the panel sets the gap — the inline panel carries no band padding of its own. There
                    is no second title between this paragraph and the heading below.
                </p>
            </article>
            <section className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
                <FAQsPanel heading="FAQ." questions={DEMO_FAQ_ITEMS} inline />
            </section>
        </main>
    )
}
