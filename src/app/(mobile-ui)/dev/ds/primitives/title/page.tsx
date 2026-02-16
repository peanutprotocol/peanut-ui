'use client'

import Title from '@/components/0_Bruddle/Title'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function TitlePage() {
    return (
        <DocPage>
            <DocHeader title="Title" description="Knerd display font with filled + outline double-render for drop shadow effect." status="production" />

            <SectionDivider />

            <PropsTable rows={[
                { name: 'text', type: 'string', default: '(required)', required: true },
                { name: 'offset', type: 'boolean', default: 'true', description: 'Horizontal offset for shadow effect' },
            ]} />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="rounded-sm bg-purple-1 p-4">
                        <Title text="PEANUT" />
                    </div>

                    <div className="rounded-sm bg-purple-1 p-4">
                        <Title text="NO OFFSET" offset={false} />
                    </div>

                    <div className="rounded-sm bg-yellow-1 p-4">
                        <Title text="ON YELLOW" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import Title from '@/components/0_Bruddle/Title'`}
                    />
                    <CodeBlock
                        label="Default"
                        code={`<Title text="PEANUT" />`}
                    />
                    <CodeBlock
                        label="Without Offset"
                        code={`<Title text="NO OFFSET" offset={false} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
