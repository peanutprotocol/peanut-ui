'use client'

import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function CloudsBackgroundPage() {
    return (
        <DocPage>
            <DocHeader
                title="CloudsBackground"
                description="Decorative drifting-clouds backdrop for success and marketing moments. Code-only (brand) — no figma board. Decoration only, never a functional screen."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'minimal',
                        type: 'boolean',
                        default: 'false',
                        description: 'Fewer, larger clouds — the quieter variant',
                    },
                ]}
            />

            <DocSection
                title="Examples"
                description="The component fills its nearest positioned ancestor, so it needs a relative overflow-hidden host with a size of its own."
            >
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Default</p>
                            <div className="relative h-64 overflow-hidden rounded-sm border border-border-disabled bg-background-page">
                                <CloudsBackground />
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Minimal</p>
                            <div className="relative h-64 overflow-hidden rounded-sm border border-border-disabled bg-background-page">
                                <CloudsBackground minimal />
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<div className="relative h-64 overflow-hidden">\n    <CloudsBackground />\n</div>`}
                    />
                    <CodeBlock label="Minimal" code={`<CloudsBackground minimal />`} />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
