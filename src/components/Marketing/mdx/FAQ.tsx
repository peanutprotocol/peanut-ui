import { Children, isValidElement, type ReactNode } from 'react'
import { FAQsPanel } from '@/components/Global/FAQs'
import { PeanutsBG } from '@/assets'
import { JsonLd } from '@/components/Marketing/JsonLd'

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
    children: ReactNode
}

/** Extract text content from React nodes for JSON-LD plain text */
function extractText(node: ReactNode): string {
    if (typeof node === 'string') return node
    if (typeof node === 'number') return String(node)
    if (!node) return ''
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (isValidElement(node)) return extractText(node.props.children)
    return ''
}

/**
 * MDX FAQ component. Purple section with peanut pattern overlay,
 * animated accordion, and FAQPage JSON-LD. Matches LP styling exactly.
 */
export function FAQ({ title = 'FAQ', children }: FAQProps) {
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
        <section
            className="overflow-x-hidden"
            style={{
                backgroundColor: '#6340df',
                backgroundImage: `url(${PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <FAQsPanel heading={title} questions={questions} />
            <JsonLd data={faqSchema} />
        </section>
    )
}
