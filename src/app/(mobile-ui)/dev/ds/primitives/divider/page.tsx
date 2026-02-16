'use client'

import Divider from '@/components/0_Bruddle/Divider'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function DividerPage() {
    return (
        <DocPage>
            <DocHeader title="Divider" description="Horizontal divider with optional text label." status="production" />

            <SectionDivider />

            <PropsTable rows={[
                { name: 'text', type: 'string', default: '(none)', description: 'Center text label' },
                { name: 'dividerClassname', type: 'string', default: '(none)' },
                { name: 'textClassname', type: 'string', default: '(none)' },
            ]} />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-sm text-grey-1">Default</p>
                            <Divider />
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-grey-1">With text</p>
                            <Divider text="or" />
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import Divider from '@/components/0_Bruddle/Divider'`}
                    />
                    <CodeBlock
                        label="Default"
                        code={`<Divider />`}
                    />
                    <CodeBlock
                        label="With Text"
                        code={`<Divider text="or" />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
