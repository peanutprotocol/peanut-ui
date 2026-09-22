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
import { ProductUsage } from '../../_components/ProductUsage'

const PERSISTENT_ID = 'ds-persistent-toast'
const CUSTOM_CONTENT_ID = 'ds-custom-content-toast'
const COOLDOWN_ID = 'ds-cooldown-toast'

export default function ToastPage() {
    const { toast, success, error, info, attention, dismiss } = useToast()

    return (
        <DocPage>
            <DocHeader
                title="Toast"
                description="Provider-based, non-blocking feedback for transient events. Toast renders the Callout primitive in the shared floating stack, with four caller-facing tones, reading-time auto-dismiss, stable IDs, persistent messages, and custom content."
                status="production"
            />

            <DocSection
                title="Interactive demo"
                description="The helper methods set the tone. Toasts appear in the bottom-right stack, over the bottom navigation and above the safe-area inset."
            >
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="small" onClick={() => success('Operation successful!')}>
                            success
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => error('Something went wrong')}>
                            error
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => info('Did you know?')}>
                            info
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => attention('Check this out')}>
                            attention
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
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
                        <Button variant="secondary" size="small" onClick={() => dismiss(PERSISTENT_ID)}>
                            dismiss persistent
                        </Button>
                        <Button
                            variant="secondary"
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
                        <Button variant="secondary" size="small" onClick={() => dismiss(CUSTOM_CONTENT_ID)}>
                            dismiss custom
                        </Button>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import + hook"
                        code={`import { useToast } from '@/components/0_Bruddle/Toast'

const { success, error, info, attention } = useToast()`}
                    />
                    <CodeBlock
                        label="Trigger"
                        code={`success('Done!')
error('Failed!')
info('FYI...')
attention('Be careful!')`}
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
                description={'The visual surface is Callout variant="floating"; Toast owns delivery and lifetime.'}
            >
                <DocSection.Content>
                    <ul className="space-y-2 text-body-s text-foreground-secondary">
                        <li>
                            success, error, info, and attention are the caller-facing tones; attention uses Callout's
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
                Keep toast copy short and user-facing. Use the flow's inline Callout or a full-page error surface when
                the user must keep seeing the message or take action before continuing.
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
                        name: 'success | error | info | attention',
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
                        type: "'success' | 'error' | 'info' | 'attention'",
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

            <ProductUsage>
                <ProductUsage.Example
                    title="Receipt — copy link"
                    path="src/components/TransactionDetails/ReceiptActions.tsx"
                    description="The most common shape in the app: one line, success or error from the same call, no ID."
                    code={`if (await copyTextToClipboard(receiptPageUrl)) toast.success(t('actions.linkCopied'))
else toast.error(t('actions.linkCopyFailed'))`}
                >
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="small" onClick={() => success('Link copied')}>
                            copy succeeded
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => error('Could not copy the link')}>
                            copy failed
                        </Button>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Rain cooldown pill"
                    path="src/context/RainCooldownContext.tsx"
                    description="A persistent toast with custom content and a stable ID. Re-firing mid-cooldown is a no-op, so the pill never re-animates; the context dismisses it when the cooldown ends."
                    code={`toast({
    id: COOLDOWN_TOAST_ID,
    duration: 'persistent',
    content: <CooldownPillContent endsAt={cooldownEndsAt} />,
})

// later, when the cooldown elapses
dismiss(COOLDOWN_TOAST_ID)`}
                >
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() =>
                                toast({
                                    id: COOLDOWN_ID,
                                    duration: 'persistent',
                                    content: (
                                        <span className="flex items-center gap-2">
                                            <Icon name="clock" size={16} />
                                            Card is cooling down — 4m 12s left
                                        </span>
                                    ),
                                })
                            }
                        >
                            start cooldown
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => dismiss(COOLDOWN_ID)}>
                            end cooldown
                        </Button>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
