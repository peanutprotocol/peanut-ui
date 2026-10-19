'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Title from '@/components/0_Bruddle/Title'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import { BRAND_BOOK_ERRATA, DISPLAY_RAMP, MARKETING_PALETTE } from './brand-data'

// every displayed value resolves against the generated token table, so this
// page cannot drift from globals.css
const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

export default function MarketingBrandPage() {
    return (
        <DocPage>
            <DocHeader
                title="Brand"
                description="The tokens and type for landing and content pages. Copy the classes; none of this is a per-page choice."
            />

            <DesignNote type="info">
                Scope: LandingPage, Marketing, /lp, /shhhhh, /m. App screens follow Foundations, not this page.
            </DesignNote>

            <DocSection title="Grounds" description="Five colours. Every one is a token; raw hex fails ds-lint.">
                <div className="space-y-2">
                    {MARKETING_PALETTE.map((entry) => (
                        <ListItem
                            key={entry.label}
                            position="solo"
                            leading={
                                <div
                                    className={`size-8 shrink-0 rounded-sm border border-border-default ${entry.swatchClass}`}
                                />
                            }
                            title={
                                <span className="flex items-baseline gap-2">
                                    {entry.label}
                                    <span className="font-mono text-label-m text-foreground-secondary">
                                        {entry.token} · {tokenValue(entry.token)}
                                    </span>
                                </span>
                            }
                            body={<p>{entry.role}</p>}
                        />
                    ))}
                </div>
                <WhenToUse
                    use={[
                        'Secondary text on cream: text-foreground-secondary',
                        'Secondary text on pink or yellow: text-foreground-over-color-secondary',
                        'Secondary text on black: text-foreground-inverse-secondary',
                    ]}
                    dontUse={[
                        'Opacity composites on text (white at 60%)',
                        'Raw hex colours anywhere on a marketing surface',
                    ]}
                />
            </DocSection>

            <DocSection title="Buttons and cards">
                <DocSection.Content>
                    <div className="rounded-sm bg-background-page p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <Button size="large" variant="primary" className="w-fit">
                                Get the app
                            </Button>
                            <div className="rounded-sm border-2 border-border-default bg-background-default p-4 shadow-4">
                                <p className="text-body-m">A marketing card</p>
                                <p className="text-body-s text-foreground-secondary">rounded-sm · border-2</p>
                            </div>
                        </div>
                    </div>
                    <WhenToUse
                        use={[
                            'Buttons: the DS Button, size="large", w-fit (see Landing → CTA)',
                            'Cards: rounded-sm border-2 border-border-default, shadow-4 when it floats',
                        ]}
                        dontUse={['A 2px border on a button or a 1px border on a card', 'Any other radius']}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="card"
                        code={`<div className="rounded-sm border-2 border-border-default bg-background-default p-4 shadow-4">`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Body text"
                description="Prose is text-body-m with 28px leading. The token brings weight 500."
            >
                <DocSection.Content>
                    <Card className="space-y-2 p-4">
                        <p className="text-body-m leading-7">Send dollars that feel like cash.</p>
                        <p className="text-body-m leading-7 text-foreground-secondary">
                            A second paragraph at the same measure, so long-form content keeps its rhythm.
                        </p>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="prose" code={`<p className="text-body-m leading-7">`} />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Display type" description="Four sizes, weight 1000. The leading comes with the token.">
                <DocSection.Content>
                    <div className="space-y-8 overflow-x-hidden rounded-sm border border-border-default bg-background-page p-4">
                        {DISPLAY_RAMP.map((step) => (
                            <div key={step.label} className="min-w-0">
                                <p className="font-mono text-label-m text-foreground-secondary">
                                    text-{step.label} — {step.sizePx}/{step.leadingPx}
                                </p>
                                <p className={`font-roboto-flex-extrabold mt-2 break-words ${step.className}`}>
                                    {step.sample}
                                </p>
                            </div>
                        ))}
                    </div>
                    <WhenToUse
                        use={[
                            'Pair a ramp size with font-roboto-flex-extrabold font-extraBlack',
                            'Long es/pt title: drop one step, text-headingSmall xs:text-heading',
                            'Below 390 a headingSmall line steps to text-heading-m xs:text-headingSmall',
                        ]}
                        dontUse={[
                            '!leading-* or a line-height of your own',
                            'Arbitrary text sizes in square brackets (ds-lint counts them)',
                            'This ramp inside the app — app titles stop at text-heading-xl',
                        ]}
                    />
                    <p className="text-body-s text-foreground-secondary">
                        In es/pt, accented caps (Á É Í) touch the line above at this leading. That is the look.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="section title"
                        code={`<h2 className="font-roboto-flex-extrabold font-extraBlack uppercase text-headingSmall xs:text-heading md:text-headingMedium">`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Knerd"
                description="Only through Title, for 1–3 accent words. Pass a size class, nothing else."
            >
                <DocSection.Content>
                    <div className="rounded-sm bg-action-primary p-4 text-center">
                        <Title text="NO FEES." className="text-heading" />
                    </div>
                    <WhenToUse
                        use={['Hero accent words', 'The closing fold lockup', 'OG card amounts']}
                        dontUse={[
                            'font-knerd-* outside Title.tsx (ds-lint counts it)',
                            'A sentence, a paragraph, an app screen',
                            'Your own offset, tracking or tilt',
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="title"
                        code={`import Title from '@/components/0_Bruddle/Title'\n\n<Title text={'SEND IN\\nSECONDS.'} className="text-heading md:text-headingMedium" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Brand book errata"
                description="The site is the brand. Where the 2024 brand book (v1.2) disagrees, the site wins."
            >
                <div className="overflow-x-auto rounded-sm border border-border-default">
                    <table className="w-full border-collapse text-left text-body-s">
                        <thead>
                            <tr className="bg-background-page">
                                <th className="border-b border-border-default px-3 py-2 font-medium">Book</th>
                                <th className="border-b border-border-default px-3 py-2 font-medium">Says</th>
                                <th className="border-b border-border-default px-3 py-2 font-medium">Site does</th>
                            </tr>
                        </thead>
                        <tbody>
                            {BRAND_BOOK_ERRATA.map((entry) => (
                                <tr key={`${entry.pdfRef}-${entry.bookSays}`} className="bg-background-default">
                                    <td className="border-b border-border-default px-3 py-2 font-mono text-label-m text-foreground-secondary">
                                        {entry.pdfRef}
                                    </td>
                                    <td className="border-b border-border-default px-3 py-2 text-foreground-secondary">
                                        {entry.bookSays}
                                    </td>
                                    <td className="border-b border-border-default px-3 py-2">{entry.siteDoes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>
        </DocPage>
    )
}
