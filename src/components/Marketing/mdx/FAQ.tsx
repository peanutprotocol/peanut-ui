import { Children, isValidElement, type ReactNode } from 'react'
import { FAQsPanel } from '@/components/Global/FAQs'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { PROSE_WIDTH } from '../constants'
import { extractText } from './mdx.utils'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

interface FAQItemProps {
    question: string
    children: ReactNode
}

/** Individual FAQ item. Used as a child of <FAQ>. */
export function FAQItem({ question, children }: FAQItemProps) {
    // FAQItem doesn't render on its own — FAQ collects these via children.
    // This exists for type safety and readability in MDX content.
    return <div data-question={question}>{children}</div>
}

interface FAQProps {
    title?: string
    /** Injected by createMdxComponents — never authored in MDX. */
    locale?: Locale
    children: ReactNode
}

/**
 * MDX FAQ component: the FAQ panel plus FAQPage JSON-LD. Matches LP styling.
 *
 * Same flat look as home and merchant pages, but `inline`: it sits in the
 * prose column and follows the prose rhythm instead of the band's padding.
 */
export function FAQ({ title, children, locale = DEFAULT_LOCALE }: FAQProps) {
    const heading = title ?? getTranslations(locale).faqTitle
    // Collect FAQItem children into question/answer pairs
    const questions: Array<{ id: string; question: string; answer: string }> = []

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return
        if (child.type === FAQItem || child.props?.question) {
            const id = `faq-${questions.length}`
            questions.push({
                id,
                question: child.props.question,
                answer: extractText(child.props.children),
            })
        }
    })

    if (questions.length === 0) return null

    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map((q) => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: { '@type': 'Answer', text: q.answer },
        })),
    }

    return (
        // same column as the prose, CTA and RelatedPages around it
        <section className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
            <FAQsPanel heading={heading} questions={questions} inline />
            <JsonLd data={faqSchema} />
        </section>
    )
}
