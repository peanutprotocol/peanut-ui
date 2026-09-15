'use client'

import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function ScreenMarkPage() {
    return (
        <DocPage>
            <DocHeader
                title="ScreenMark"
                description="One-liner over IconBubble size='l', centered above a screen's content — so every screen that carries a mark carries the same one. Code-only — pending a design ruling."
                status="limited"
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
        </DocPage>
    )
}
