'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Playground } from '../../_components/Playground'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function CardPage() {
    return (
        <DocPage>
            <DocHeader
                title="Card"
                description="Standalone container with optional shadow. Compound component with Header, Title, Description, Content sub-components."
                status="production"
            />

            <Playground
                name="Card"
                importPath={`import { Card } from '@/components/0_Bruddle/Card'`}
                defaults={{ shadowSize: '4' }}
                controls={[
                    { type: 'select', prop: 'shadowSize', label: 'shadowSize', options: ['4', '6', '8'] },
                    { type: 'select', prop: 'color', label: 'color', options: ['primary', 'secondary'] },
                ]}
                render={(props) => (
                    <Card {...props} className="w-full max-w-xs p-4">
                        <Card.Header>
                            <Card.Title>Card Title</Card.Title>
                            <Card.Description>A description of the card content</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <p className="text-sm">Body content goes here</p>
                        </Card.Content>
                    </Card>
                )}
                codeTemplate={(props) => {
                    const parts = ['<Card']
                    if (props.shadowSize) parts.push(`shadowSize="${props.shadowSize}"`)
                    if (props.color && props.color !== 'primary') parts.push(`color="${props.color}"`)
                    parts.push('className="p-4">')
                    return (
                        parts.join(' ') +
                        '\n  <Card.Header>\n    <Card.Title>Title</Card.Title>\n    <Card.Description>Description</Card.Description>\n  </Card.Header>\n  <Card.Content>Content</Card.Content>\n</Card>'
                    )
                }}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'shadowSize', type: "'4' | '6' | '8'", default: '(none)' },
                    { name: 'color', type: "'primary' | 'secondary'", default: "'primary'" },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Shadow Variants">
                <DocSection.Content>
                    <div className="space-y-3">
                        <Card className="p-4">
                            <p className="text-sm">No shadow</p>
                        </Card>
                        <Card shadowSize="4" className="p-4">
                            <p className="text-sm">shadowSize=&quot;4&quot;</p>
                        </Card>
                        <Card shadowSize="6" className="p-4">
                            <p className="text-sm">shadowSize=&quot;6&quot;</p>
                        </Card>
                        <Card shadowSize="8" className="p-4">
                            <p className="text-sm">shadowSize=&quot;8&quot;</p>
                        </Card>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { Card } from '@/components/0_Bruddle/Card'`} />
                </DocSection.Code>
            </DocSection>

            <DocSection title="With Sub-components">
                <DocSection.Content>
                    <Card shadowSize="4" className="p-4">
                        <Card.Header>
                            <Card.Title>Card Title</Card.Title>
                            <Card.Description>description text</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <p className="text-sm">body content</p>
                        </Card.Content>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Sub-components Example"
                        code={`<Card shadowSize="4" className="p-4">
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Content>Content</Card.Content>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
