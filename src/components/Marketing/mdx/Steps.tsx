import { Children, isValidElement, type ReactNode } from 'react'
import { Steps as StepsCards } from '@/components/Marketing/Steps'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Stars } from './Stars'

interface StepProps {
    title: string
    children: ReactNode
}

/** Individual step. Used as a child of <Steps>. */
export function Step({ title, children }: StepProps) {
    return <div data-title={title}>{children}</div>
}

interface StepsProps {
    title?: string
    children: ReactNode
}

/** Extract text content from React nodes for descriptions and JSON-LD */
function extractText(node: ReactNode): string {
    if (typeof node === 'string') return node
    if (typeof node === 'number') return String(node)
    if (!node) return ''
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (isValidElement(node)) return extractText(node.props.children)
    return ''
}

const stepsClouds = [
    { top: '15%', width: 160, speed: '40s', direction: 'ltr' as const },
    { top: '60%', width: 140, speed: '34s', direction: 'rtl' as const },
    { top: '85%', width: 120, speed: '46s', direction: 'ltr' as const, delay: '6s' },
]

/**
 * MDX Steps component. Full-bleed yellow section with numbered step cards,
 * clouds, and HowTo JSON-LD. Matches LP styling.
 *
 * Usage in MDX:
 *   <Steps title="How It Works">
 *   <Step title="Sign up">Create a Peanut account...</Step>
 *   <Step title="Deposit">Send stablecoins or bank transfer.</Step>
 *   </Steps>
 */
export function Steps({ title = 'How It Works', children }: StepsProps) {
    const steps: Array<{ title: string; description: string }> = []

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return
        if (child.type === Step || child.props?.title) {
            steps.push({
                title: child.props.title,
                description: extractText(child.props.children),
            })
        }
    })

    if (steps.length === 0) return null

    const howToSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: title,
        step: steps.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: step.title,
            text: step.description || step.title,
        })),
    }

    return (
        <section className="relative overflow-hidden bg-secondary-1 px-4 py-16 md:py-24">
            <CloudsCss clouds={stepsClouds} />
            <Stars />
            <div className="relative z-10 mx-auto max-w-3xl">
                <h2 className="mb-8 text-h2 font-bold md:text-h1">{title}</h2>
                <StepsCards steps={steps} />
            </div>
            <JsonLd data={howToSchema} />
        </section>
    )
}
