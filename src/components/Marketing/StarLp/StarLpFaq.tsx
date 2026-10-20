import { FAQsPanel } from '@/components/Global/FAQs'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { PROSE_WIDTH } from '@/constants/layout.consts'
import { faqSchema } from '@/lib/seo/schemas'
import { MARKETING_BAND_PADDING } from '@/constants/layout.consts'
import type { StarLpFaqProps } from './starLp.types'

/** The DS FAQ fold, heading "FAQ.", flat on cream, with FAQPage JSON-LD and an optional legal line. */
export function StarLpFaq({ items, footnote }: StarLpFaqProps) {
    const schema = faqSchema(items.map(({ question, answer }) => ({ question, answer })))
    return (
        <section className={`bg-background-page text-foreground-primary ${MARKETING_BAND_PADDING}`}>
            {schema && <JsonLd data={schema} />}
            {/* the panel's own pb-12 would stack on the band padding: the fold keeps the 64/96 step */}
            <div className={`mx-auto ${PROSE_WIDTH} [&>section]:pb-0`}>
                <FAQsPanel inline heading="FAQ." questions={items} />
                {footnote && <p className="mt-8 text-body-s text-foreground-secondary">{footnote}</p>}
            </div>
        </section>
    )
}
