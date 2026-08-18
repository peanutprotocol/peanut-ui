'use client'

import { Notification } from '@/components/0_Bruddle/Notification'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

const noop = () => {}

export default function NotificationPage() {
    return (
        <DocPage>
            <DocHeader
                title="Notification"
                description="Inline notification banner from the figma notification board (17802:61535). Priority sets tone and icon; supports body or title + body, optional dismiss, and up to two CTAs. No prod consumer yet — this page is its consumer."
                status="limited"
            />

            <DocSection title="Priority">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Notification priority="info">Just letting you know about this</Notification>
                        <Notification priority="success">Success, details changed</Notification>
                        <Notification priority="attention">Pay attention, this is important</Notification>
                        <Notification priority="helper">Leave empty to let payers choose amount</Notification>
                        <Notification priority="error">Ups, something went wrong</Notification>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Notification"
                        code={`import { Notification } from '@/components/0_Bruddle/Notification'

<Notification priority="success">Success, details changed</Notification>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Build: body vs title + body">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Notification priority="helper">Body text only, no separate title</Notification>
                        <Notification priority="attention" title="Title">
                            Body text can be longer, but try not to go over two lines.
                        </Notification>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Title + body"
                        code={`<Notification priority="attention" title="Title">
    Body text can be longer, but try not to go over two lines.
</Notification>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Dismiss">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Notification priority="info">Not dismissible, no close button</Notification>
                        <Notification priority="info" onDismiss={noop}>
                            Dismissible, includes a close button
                        </Notification>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Dismissible"
                        code={`<Notification priority="info" onDismiss={() => setShown(false)}>
    Dismissible, includes a close button
</Notification>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="CTAs">
                <DocSection.Content>
                    <div className="flex flex-col gap-3">
                        <Notification priority="attention" ctas={[{ label: 'CTA1', onClick: noop }]}>
                            Single call-to-action button
                        </Notification>
                        <Notification
                            priority="attention"
                            title="Title"
                            onDismiss={noop}
                            ctas={[
                                { label: 'CTA1', onClick: noop },
                                { label: 'CTA2', onClick: noop },
                            ]}
                        >
                            Two buttons: a primary and a secondary action.
                        </Notification>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="CTAs"
                        code={`<Notification
    priority="attention"
    title="Title"
    onDismiss={dismiss}
    ctas={[
        { label: 'Verify', onClick: verify },
        { label: 'Later', onClick: dismiss },
    ]}
>
    Two buttons: a primary and a secondary action.
</Notification>`}
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
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'Body text' },
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
                        description: 'First renders purple, second stroke',
                    },
                ]}
            />
        </DocPage>
    )
}
