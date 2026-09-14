'use client'

import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function TitleBlockPage() {
    return (
        <DocPage>
            <DocHeader
                title="TitleBlock"
                description="Title + supporting text pair, extracted from EmptyState. Code-only recipe (no figma board)."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'title', type: 'ReactNode', default: '(required)' },
                    { name: 'description', type: 'ReactNode', default: '(none)', description: 'body-s secondary line' },
                    { name: 'align', type: "'start' | 'center'", default: "'start'" },
                    {
                        name: 'size',
                        type: "'card' | 's' | 'm'",
                        default: "'card'",
                        description: 'heading token for the title',
                    },
                    {
                        name: 'children',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'extra content inside the block (e.g. a cta)',
                    },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="flex flex-col gap-6">
                        <TitleBlock title="Card default" description="text-heading-card + text-body-s secondary" />
                        <TitleBlock title="Centered hero" description="align center, size s" align="center" size="s" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'`} />
                    <CodeBlock
                        label="Hero"
                        code={`<TitleBlock title={t('title')} description={t('subtitle')} align="center" size="s" />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
