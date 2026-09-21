'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

const noop = () => {}

export default function CalloutPage() {
    return (
        <DocPage>
            <DocHeader
                title="Callout"
                description="Inline callout banner from the figma notification board (17802:61535). Priority sets tone and icon; supports body or title + body, a checklist body, optional dismiss, and up to two CTAs. It backs every inline banner and error in the app, plus Toast and the Banner announcement surface."
                status="limited"
            />

            <DocSection title="Priority">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="info">Just letting you know about this</Callout>
                        <Callout priority="success">Success, details changed</Callout>
                        <Callout priority="attention">Pay attention, this is important</Callout>
                        <Callout priority="helper">Leave empty to let payers choose amount</Callout>
                        <Callout priority="error">Ups, something went wrong</Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Callout"
                        code={`import { Callout } from '@/components/0_Bruddle/Callout'

<Callout priority="success">Success, details changed</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Build: body vs title + body">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="helper">Body text only, no separate title</Callout>
                        <Callout priority="attention" title="Title">
                            Body text can be longer, but try not to go over two lines.
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Title + body"
                        code={`<Callout priority="attention" title="Title">
    Body text can be longer, but try not to go over two lines.
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Checklist (items)">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout
                            priority="info"
                            items={[
                                'Europe SEPA transfers (+30 countries)',
                                'UK Faster payments (GBP)',
                                'US ACH and wire transfers',
                                'Mexico SPEI transfers',
                            ]}
                        />
                        <Callout
                            priority="info"
                            title="What you'll unlock"
                            items={['Bank transfers in your country']}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Checklist"
                        code={`// a checklist carries its own check marks, so it renders
// no leading priority icon, and rows use the dense text step
<Callout
    priority="info"
    items={['Europe SEPA transfers (+30 countries)', 'UK Faster payments (GBP)']}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Dismiss">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="info">Not dismissible, no close button</Callout>
                        <Callout priority="info" onDismiss={noop}>
                            Dismissible, includes a close button
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Dismissible"
                        code={`<Callout priority="info" onDismiss={() => setShown(false)}>
    Dismissible, includes a close button
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="CTAs">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Callout priority="attention" ctas={[{ label: 'CTA1', onClick: noop }]}>
                            Single underlined text action
                        </Callout>
                        <Callout
                            priority="attention"
                            title="Title"
                            onDismiss={noop}
                            ctas={[
                                { label: 'CTA1', onClick: noop },
                                { label: 'CTA2', onClick: noop },
                            ]}
                        >
                            Two underlined text actions.
                        </Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="CTAs"
                        code={`<Callout
    priority="attention"
    title="Title"
    onDismiss={dismiss}
    ctas={[
        { label: 'Verify', onClick: verify },
        { label: 'Later', onClick: dismiss },
    ]}
>
    Two underlined text actions.
</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'priority',
                        type: "'info' | 'success' | 'attention' | 'helper' | 'error'",
                        default: "'info'",
                        description: 'Tone, background, and leading icon',
                    },
                    { name: 'title', type: 'string', default: '(none)', description: 'Bold first line' },
                    { name: 'children', type: 'ReactNode', default: '(none)', description: 'Body text' },
                    {
                        name: 'items',
                        type: 'ReactNode[]',
                        default: '(none)',
                        description: 'Checklist body — one check row each, no leading icon. Wins over children',
                    },
                    {
                        name: 'onDismiss',
                        type: '() => void',
                        default: '(none)',
                        description: 'Shows the close button',
                    },
                    {
                        name: 'ctas',
                        type: '1-2 × { label, onClick }',
                        default: '(none)',
                        description: 'Underlined text actions, never full-size buttons',
                    },
                ]}
            />
        </DocPage>
    )
}
