'use client'

import { BulletList } from '@/components/0_Bruddle/BulletList'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function BulletListPage() {
    return (
        <DocPage>
            <DocHeader
                title="BulletList"
                description="Semantic unordered text list with a 4px action-primary pink marker. Use it for short, non-interactive facts that can wrap across lines."
                status="production"
            />

            <DocSection title="Default" description="Body/S copy uses the shared pink marker and secondary text tone.">
                <DocSection.Content>
                    <BulletList
                        items={['No monthly fees', 'Send to any supported network', 'Your funds stay in your control']}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { BulletList } from '@/components/0_Bruddle/BulletList'`} />
                    <CodeBlock
                        label="BulletList"
                        code={`<BulletList
  items={[
    'No monthly fees',
    'Send to any supported network',
    'Your funds stay in your control',
  ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Compact and rich content"
                description="Use Body/XS in dense cards; items may contain links or inline emphasis."
            >
                <DocSection.Content>
                    <BulletList
                        size="xs"
                        items={[
                            'Available for bank transfers',
                            <span key="link-item">
                                Review the <strong>current limits</strong> before continuing
                            </span>,
                            <span key="muted-item" className="line-through">
                                Card access in this region
                            </span>,
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Compact"
                        code={`<BulletList
  size="xs"
  items={[
    'Available for bank transfers',
    <span>Review the current limits</span>,
  ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Use for facts, not rows or warnings">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Use <code>ListItem</code> for navigable settings or payment rows. Use <code>Notification</code>{' '}
                        for a warning or a message that needs a priority treatment. Keep the list semantic and let its
                        items wrap.
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
                        description: 'Unordered text items',
                    },
                    { name: 'size', type: "'s' | 'xs'", default: "'s'", description: 'Body/S or compact Body/XS copy' },
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
