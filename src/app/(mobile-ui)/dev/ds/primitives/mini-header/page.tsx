'use client'

import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function MiniHeaderPage() {
    return (
        <DocPage>
            <DocHeader
                title="MiniHeader"
                description="Grey uppercase mini-header that labels a block of plain prose. Code-only — pending a design ruling."
                status="limited"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'The label text' },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection
                title="Examples"
                description="Renders an h3 with the label-m uppercase secondary treatment. MINI_HEADER_CLASS exposes the same classes for an element you cannot swap."
            >
                <DocSection.Content>
                    <div>
                        <MiniHeader>How it works</MiniHeader>
                        <p className="mt-2 text-body-s text-foreground-secondary">
                            Plain prose under a quiet grey label. The header carries no icon, no tint, and no border —
                            just the uppercase label token.
                        </p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { MiniHeader, MINI_HEADER_CLASS } from '@/components/0_Bruddle/MiniHeader'`}
                    />
                    <CodeBlock label="Usage" code={`<MiniHeader>How it works</MiniHeader>`} />
                    <CodeBlock label="Raw classes" code={`<legend className={MINI_HEADER_CLASS}>Details</legend>`} />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
