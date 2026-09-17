'use client'

import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function NumberedListPage() {
    return (
        <DocPage>
            <DocHeader
                title="NumberedList"
                description="Semantic ordered list for a real sequence. Each step gets a 20px action-primary pink circle, so item copy should not include its own number."
                status="production"
            />

            <DocSection title="Ordered steps" description="Use when the order changes how the user completes the task.">
                <DocSection.Content>
                    <NumberedList items={['Choose the network', 'Enter the amount', 'Review and confirm']} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { NumberedList } from '@/components/0_Bruddle/NumberedList'`}
                    />
                    <CodeBlock
                        label="NumberedList"
                        code={`<NumberedList
  items={[
    'Choose the network',
    'Enter the amount',
    'Review and confirm',
  ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Rich step content" description="Items accept React nodes and wrap beside the marker.">
                <DocSection.Content>
                    <NumberedList
                        items={[
                            <span key="first">
                                Open <strong>Settings</strong>
                            </span>,
                            'Select passkey help',
                            <span key="third" className="text-foreground-secondary">
                                Follow the recovery instructions
                            </span>,
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Rich items"
                        code={`<NumberedList
  items={[
    <span>Open <strong>Settings</strong></span>,
    'Select passkey help',
  ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Use for sequence, not decoration">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Use <code>BulletList</code> when the order does not matter. Do not hand-write <code>1.</code>{' '}
                        prefixes; the ordered-list semantics and marker are owned by this component.
                    </p>
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'items',
                        type: 'React.ReactNode[]',
                        default: '(required)',
                        description: 'Ordered step content',
                    },
                    {
                        name: 'className',
                        type: 'string',
                        default: '(none)',
                        description: 'One-off list container classes',
                    },
                ]}
            />
        </DocPage>
    )
}
