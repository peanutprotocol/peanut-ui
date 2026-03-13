import { JsonLd } from './JsonLd'
import { Card } from '@/components/0_Bruddle/Card'

interface FAQSectionProps {
    faqs: Array<{ q: string; a: string }>
    title?: string
}

export function FAQSection({ faqs, title = 'Frequently Asked Questions' }: FAQSectionProps) {
    if (faqs.length === 0) return null

    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.a,
            },
        })),
    }

    return (
        <section className="py-10 md:py-14">
            <h2 className="mb-6 text-h2 font-bold md:text-h1">{title}</h2>
            <Card shadowSize="4" className="overflow-hidden">
                {faqs.map((faq, i) => (
                    <details key={i} className="group border-b border-n-1 last:border-b-0">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-bold transition-colors hover:bg-primary-3/20 [&::-webkit-details-marker]:hidden">
                            {faq.q}
                            <span className="ml-4 shrink-0 text-lg transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <div className="border-t border-n-1/20 px-5 py-4 text-sm text-black/70">{faq.a}</div>
                    </details>
                ))}
            </Card>
            <JsonLd data={faqSchema} />
        </section>
    )
}
