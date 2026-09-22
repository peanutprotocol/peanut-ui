'use client'

import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

export default function ScreenMarkPage() {
    return (
        <DocPage>
            <DocHeader
                title="ScreenMark"
                description="One-liner over IconBubble size='l', centered above a screen's content — so every screen that carries a mark carries the same one. Code-only — pending a design ruling."
                status="limited"
            />

            <WhenToUse
                use={[
                    'The single icon mark centered above a screen title — the size="l" IconBubble',
                    'Migrating a screen that already spells that centered bubble itself, so every mark looks the same',
                    'The mark tone — pass color; the default is green',
                ]}
                dontUse={[
                    'An icon inside a card, a row, a modal, or a drawer — use IconBubble directly at its own size',
                    'A payment success screen — PaymentSuccessView already owns its mark',
                    'A new screen decoration with no precedent — there is no product call site yet, and the component is code-only pending a design ruling; flag the gap',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'icon', type: 'IconName', default: '(required)' },
                    { name: 'color', type: 'IconBubbleColor', default: 'green' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Default (green)</p>
                            <ScreenMark icon="check" />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Colored</p>
                            <ScreenMark icon="alert" color="red" />
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'`} />
                    <CodeBlock label="Usage" code={`<ScreenMark icon="check" />`} />
                    <CodeBlock label="Colored" code={`<ScreenMark icon="alert" color="red" />`} />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <p className="text-body-s text-foreground-secondary">
                    No product call sites. ScreenMark exists as the named recipe for the centered <code>l</code> bubble,
                    but every screen still spells that composition itself — nothing outside this page imports it today.
                    The screens it is meant to serve are the ones that open with a single mark above their title, so the
                    first real call site is a migration, not a new screen.
                </p>
            </ProductUsage>
        </DocPage>
    )
}
