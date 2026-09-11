'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useToast } from '@/components/0_Bruddle/Toast'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { WhenToUse } from '../../_components/WhenToUse'

const PERSISTENT_ID = 'ds-persistent-toast'
const CUSTOM_CONTENT_ID = 'ds-custom-content-toast'

export default function ToastPage() {
    const { toast, success, error, info, warning, dismiss } = useToast()

    return (
        <DocPage>
            <DocHeader
                title="Toast"
                description="Provider-based, non-blocking feedback for transient events. Toast renders the Notification primitive in the shared floating stack, with four caller-facing tones, reading-time auto-dismiss, stable IDs, persistent messages, and custom content."
                status="production"
            />

            <DocSection
                title="Interactive demo"
                description="The helper methods set the tone. Toasts appear in the bottom-right stack, over the bottom navigation and above the safe-area inset."
            >
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="stroke" size="small" onClick={() => success('Operation successful!')}>
                            success
                        </Button>
                        <Button variant="stroke" size="small" onClick={() => error('Something went wrong')}>
                            error
                        </Button>
                        <Button variant="stroke" size="small" onClick={() => info('Did you know?')}>
                            info
                        </Button>
                        <Button variant="stroke" size="small" onClick={() => warning('Check this out')}>
                            warning
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="stroke"
                            size="small"
                            onClick={() =>
                                toast({
                                    id: PERSISTENT_ID,
                                    type: 'info',
                                    message: 'This stays until dismissed',
                                    duration: 'persistent',
                                })
                            }
                        >
                            persistent
                        </Button>
                        <Button variant="stroke" size="small" onClick={() => dismiss(PERSISTENT_ID)}>
                            dismiss persistent
                        </Button>
                        <Button
                            variant="stroke"
                            size="small"
                            onClick={() =>
                                toast({
                                    id: CUSTOM_CONTENT_ID,
                                    type: 'success',
                                    duration: 'persistent',
                                    content: (
                                        <span className="flex items-center gap-2">
                                            <Icon name="gift" size={16} />
                                            Custom content owns the leading icon
                                        </span>
                                    ),
                                })
                            }
                        >
                            custom content
                        </Button>
                        <Button variant="stroke" size="small" onClick={() => dismiss(CUSTOM_CONTENT_ID)}>
                            dismiss custom
                        </Button>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import + hook"
                        code={`import { useToast } from '@/components/0_Bruddle/Toast'

const { success, error, info, warning } = useToast()`}
                    />
                    <CodeBlock
                        label="Trigger"
                        code={`success('Done!')
error('Failed!')
info('FYI...')
warning('Be careful!')`}
                    />
                    <CodeBlock
                        label="Persistent"
                        code={`const id = toast({
    id: 'sync-status',
    type: 'info',
    message: 'Syncing your wallet',
    duration: 'persistent',
})

dismiss(id)`}
                    />
                    <CodeBlock
                        label="Custom content"
                        code={`toast({
    type: 'success',
    content: <BadgeMessage />,
    duration: 'persistent',
})`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <WhenToUse
                use={[
                    'Transient confirmation or background feedback after an action.',
                    'A short message that should not interrupt the current flow.',
                    'Feedback that can safely disappear after the user has had time to read it.',
                ]}
                dontUse={[
                    'Field-level validation — use FieldError under the input.',
                    'Flow-blocking or full-page failures — use an error step or BackendErrorScreen.',
                    'Maintenance or connectivity announcements — use Global/Banner.',
                ]}
            />

            <SectionDivider />

            <DocSection
                title="Behavior"
                description={'The visual surface is Notification variant="floating"; Toast owns delivery and lifetime.'}
            >
                <DocSection.Content>
                    <ul className="space-y-2 text-body-s text-foreground-secondary">
                        <li>
                            success, error, info, and warning are the caller-facing tones; warning uses Notification's
                            attention tone.
                        </li>
                        <li>
                            Plain messages auto-dismiss from reading time: 2s for up to 3 words, then +200ms per word
                            through 6, then +100ms per word.
                        </li>
                        <li>
                            A numeric duration in milliseconds overrides reading time. A persistent toast stays until
                            dismiss(id) and has no countdown bar.
                        </li>
                        <li>
                            Toasts stack newest below older toasts. Duplicate explicit IDs are ignored while that toast
                            is visible.
                        </li>
                        <li>
                            After a clipboard copy on Android, the stack lifts temporarily clear of the system clipboard
                            preview.
                        </li>
                    </ul>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Override timing"
                        code={`success('Saved', { duration: 5000 })
toast({ message: 'Waiting for approval', duration: 'persistent' })`}
                    />
                </DocSection.Code>
            </DocSection>

            <DesignNote type="info">
                Keep toast copy short and user-facing. Use the flow's inline Notification or a full-page error surface
                when the user must keep seeing the message or take action before continuing.
            </DesignNote>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'toast',
                        type: '(string | ToastOptions) => ToastId',
                        default: '(hook method)',
                        description: 'Low-level API for custom type, ID, content, timing, and one-off classes',
                    },
                    {
                        name: 'success | error | info | warning',
                        type: '(message, options?) => ToastId',
                        default: '(hook methods)',
                        description: 'Convenience methods that set the corresponding tone',
                    },
                    {
                        name: 'dismiss',
                        type: '(id: string | number) => void',
                        default: '(hook method)',
                        description: 'Removes a visible or queued toast; use for persistent messages',
                    },
                    {
                        name: 'message',
                        type: 'string',
                        default: '(none)',
                        description: 'Plain text body; omitted when content supplies the body',
                    },
                    {
                        name: 'content',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'Custom body; its own leading artwork suppresses the stock priority icon',
                    },
                    {
                        name: 'type',
                        type: "'success' | 'error' | 'info' | 'warning'",
                        default: "'info'",
                        description: 'Caller-facing tone',
                    },
                    {
                        name: 'duration',
                        type: 'number | "persistent"',
                        default: 'reading time / 3000ms without a message',
                        description: 'Milliseconds until dismissal, or no timer when persistent',
                    },
                    {
                        name: 'id',
                        type: 'string | number',
                        default: 'timestamp',
                        description: 'Stable ID for dismissal and in-stack de-duplication',
                    },
                    {
                        name: 'className',
                        type: 'string',
                        default: '(none)',
                        description: 'One-off container accent; standard tone styling remains provider-owned',
                    },
                    {
                        name: 'hideIcon',
                        type: 'boolean',
                        default: 'false',
                        description: 'Suppresses the stock icon when content does not already provide one',
                    },
                ]}
            />
        </DocPage>
    )
}
