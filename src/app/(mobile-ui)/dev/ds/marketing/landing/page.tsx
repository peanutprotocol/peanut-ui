import { ViewportFrame } from '@/app/dev/ds-marketing-preview/_components/ViewportFrame'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { CONTAINER_SET, CTA_SNIPPET, HERO_RECIPES, SECTION_PADDING } from './landing-data'

export default function MarketingLandingPage() {
    return (
        <DocPage>
            <DocHeader
                title="Landing"
                description="How to build a landing page: pick one hero, use the DS Button, keep the three containers. Every frame renders the real component."
            />

            <DesignNote type="info">
                Toggle Phone 390 / Desktop 1440 on each frame. Those two widths are the spec; tablet interpolates.
            </DesignNote>

            <DocSection
                title="Pick one hero"
                description="A page gets exactly one. /shhhhh keeps its own look as a one-off."
            >
                <div className="grid gap-6 xl:grid-cols-3">
                    {HERO_RECIPES.map((hero) => (
                        <div key={hero.demo} className="space-y-2 min-w-0">
                            <p className="text-body-m-semibold">{hero.name}</p>
                            <p className="text-body-s text-foreground-secondary">{hero.useWhen}</p>
                            <CodeBlock code={hero.component} />
                            <ViewportFrame demo={hero.demo} label={`${hero.name} hero`} heights={hero.heights} />
                        </div>
                    ))}
                </div>
                <WhenToUse
                    use={[
                        'h1: one short clause, four words or fewer',
                        'Subtitle: the descriptor, qualifiers and corridor',
                        'The long keyworded title stays in the meta title',
                    ]}
                    dontUse={['A colon descriptor in the h1 ("Peanut vs Wise: compare…")', 'hyphens-auto on a hero h1']}
                />
            </DocSection>

            <DocSection
                title="CTA"
                description="The app's Button, large, hugging its label. Nothing marketing-specific except the motion class."
            >
                <DocSection.Content>
                    <WhenToUse
                        use={[
                            'Pink or yellow band: variant="secondary"',
                            'Cream or the black band: variant="primary"',
                            'Always size="large", w-fit and CTA_MOTION',
                            'Sentence case labels',
                            'Sticky mobile CTA: w-full, no CTA_MOTION (pinned-footer recipe)',
                        ]}
                        dontUse={[
                            'w-full, min-w-*, px-* or another size on a CTA',
                            'A hover colour, lift, scale or shadow change',
                            'A Button inside <a> or <Link> — pass href instead',
                            'A primary next to a secondary on a band',
                        ]}
                    />
                    <ViewportFrame demo="cta-bands" label="On-band CTA" heights={{ phone: 1000, desktop: 1000 }} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="cta" code={CTA_SNIPPET} />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="CTA motion"
                description="CTA_MOTION is the only motion a marketing CTA has: fade in on mount, drop 6px and tilt 0.75° on hover. Off under reduced motion. Hover the frame; Replay remounts."
            >
                <ViewportFrame demo="cta-motion" label="Marketing CTA motion" heights={{ phone: 560, desktop: 560 }} />
            </DocSection>

            <DocSection title="FAQ fold" description="Global/FAQs on cream. The heading is “FAQ.” on every page.">
                <DocSection.Content>
                    <ViewportFrame demo="faq-fold" label="FAQ fold" heights={{ phone: 640, desktop: 720 }} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="faq"
                        code={`import { FAQsPanel } from '@/components/Global/FAQs'\n\n<FAQsPanel heading="FAQ." questions={items} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Closing fold"
                description="Title for the 1–3 accent words, the rest of the headline in the display ramp under it, one secondary CTA on the band."
            >
                <ViewportFrame demo="closing-fold" label="Closing fold" heights={{ phone: 480, desktop: 560 }} />
            </DocSection>

            <DocSection title="Containers and rhythm" description="Three widths, one gutter, one section step.">
                <DocSection.Content>
                    <div className="space-y-2 rounded-sm border border-border-default bg-background-page p-4">
                        {CONTAINER_SET.map((container) => (
                            <div key={container.label} className="space-y-1">
                                <p className="font-mono text-label-m text-foreground-secondary">
                                    {container.label} · {container.px}px · {container.className}
                                </p>
                                <div className="flex justify-center">
                                    <div className={`h-4 rounded-sm bg-background-brand ${container.barClass}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-end gap-6 rounded-sm border border-border-default bg-background-page p-4">
                        {SECTION_PADDING.map((step) => (
                            <div key={step.label} className="space-y-1">
                                <div className={`w-16 rounded-sm bg-action-secondary ${step.barClass}`} />
                                <p className="font-mono text-label-m text-foreground-secondary">{step.label}</p>
                            </div>
                        ))}
                    </div>
                    <WhenToUse
                        use={[
                            'Side gutter px-6 (24px) at 390 on bands, prose and footer',
                            'Spacing steps 16 / 24 / 32 only',
                        ]}
                        dontUse={['The yellow marquee anywhere but home', 'A padded column inside a padded column']}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="section"
                        code={`import { HUB_WIDTH, PROSE_WIDTH } from '@/components/Marketing/constants'\n\n<section className="px-6 py-16 md:py-24">\n    <div className={\`mx-auto \${PROSE_WIDTH}\`}>…</div>\n</section>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
