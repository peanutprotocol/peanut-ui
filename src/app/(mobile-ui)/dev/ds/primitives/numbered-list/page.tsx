'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
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

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="Add money — how to deposit drawer"
                    path="src/components/AddMoney/components/HowToDepositDrawer.tsx"
                    description="Four translated strings, in order. The marker carries the number, so the copy dropped its own 'Step N' label."
                    code={`// the marker carries the number now, so the "Step N" label goes
const steps = STEP_KEYS.map((key) => t(\`default.\${key}\`))

<NumberedList items={steps} />`}
                >
                    <NumberedList
                        items={[
                            'Copy the bank details we show you',
                            'Open your banking app and start a transfer',
                            'Paste the reference code in the message field',
                            'Send, and the money lands in a few minutes',
                        ]}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Profile — turn on passkey backup"
                    path="src/app/(mobile-ui)/profile/backup/page.tsx"
                    description="Rich items: each step is a bold name over its detail, and the list is padded inside a Card. The steps switch on iOS vs Android."
                    code={`const backupSteps = stepKeys.map((step) => (
    <BackupStep key={step} title={t(\`steps.\${platform}.\${step}.title\`)}
        description={t(\`steps.\${platform}.\${step}.description\`)} />
))

<Card>
    <NumberedList className="py-2" items={backupSteps} />
</Card>`}
                >
                    <Card>
                        <NumberedList
                            className="py-2"
                            items={[
                                <div key="step1">
                                    <p className="font-bold text-foreground-primary">Open Settings</p>
                                    <p className="text-body-s text-foreground-primary">
                                        Tap your name at the top of the screen
                                    </p>
                                </div>,
                                <div key="step2">
                                    <p className="font-bold text-foreground-primary">Open iCloud</p>
                                    <p className="text-body-s text-foreground-primary">Then Passwords and Keychain</p>
                                </div>,
                                <div key="step3">
                                    <p className="font-bold text-foreground-primary">Turn on Sync this iPhone</p>
                                    <p className="text-body-s text-foreground-primary">
                                        Your passkey now backs up to iCloud
                                    </p>
                                </div>,
                            ]}
                        />
                    </Card>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
