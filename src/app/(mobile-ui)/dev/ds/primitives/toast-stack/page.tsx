'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import ToastStack from '@/components/0_Bruddle/ToastStack'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

const noop = () => {}

export default function ToastStackPage() {
    return (
        <DocPage>
            <DocHeader
                title="ToastStack"
                description="The toast provider's render surface, split out so framer-motion stays out of the initial bundle. Product code never renders it — ToastProvider owns it; fire toasts via useToast()."
                status="production"
            />

            <WhenToUse
                use={[
                    'Fire a toast with useToast() — the provider mounts this stack on demand',
                    'Read this page to learn where toasts land, how they stack, and how they leave',
                    'Change toast placement, order, or motion here — it is the one render surface',
                    'Keep it lazy: framer-motion stays out of the bundle until the first toast is asked for',
                ]}
                dontUse={[
                    'Do not mount ToastStack yourself — AppFlowProviders wraps every app route in ToastProvider',
                    'Do not pass toasts or dismiss by hand — call useToast()',
                    'A message that must stay on screen — use an inline Callout',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'toasts', type: 'ToastMessage[]', default: '(required)' },
                    { name: 'dismiss', type: '(id) => void', default: '(required)' },
                    {
                        name: 'onShow',
                        type: '(id) => void',
                        default: '(none)',
                        description: 'Fired per toast once it is on screen',
                    },
                ]}
            />

            <DocSection
                title="Usage"
                description="Never render ToastStack yourself. Call useToast() and the provider mounts the stack on demand. Tones, auto-dismiss timing, and a live demo are on the Toast page."
            >
                <DocSection.Content>
                    <LinkButton href="/dev/ds/primitives/toast">Toast — tones, timing, live demo</LinkButton>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import ToastStack from '@/components/0_Bruddle/ToastStack'`} />
                    <CodeBlock label="Product code" code={`const toast = useToast()\ntoast.success('Saved')`} />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="The one render site — ToastProvider"
                    path="src/components/0_Bruddle/Toast.tsx"
                    description="ToastProvider mounts the stack inside its own fixed container — bottom right, above every overlay, sliding between a raised and a normal bottom offset — and only once a toast has been asked for. AppFlowProviders (src/context/appFlowProviders.tsx) wraps every app route in that provider, so the marketing site never loads the chunk. Recreated here with a static list, un-fixed, inside the box."
                    code={`<div className={twMerge(CONTAINER, toasts.some((t) => t.raised) ? RAISED_BOTTOM : NORMAL_BOTTOM)}>
    {rendererWanted && <ToastStack toasts={toasts} dismiss={dismiss} onShow={handleToastShown} />}
</div>`}
                >
                    <div className="flex flex-col items-end gap-2">
                        <ToastStack
                            toasts={[
                                { id: 'usage-success', type: 'success', message: 'Details copied' },
                                { id: 'usage-error', type: 'error', message: 'Could not copy — try again' },
                            ]}
                            dismiss={noop}
                        />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="What a flow actually writes"
                    path="src/components/Global/CopyToClipboard/index.tsx"
                    description="A representative caller: no ToastStack, no props — a failed copy reports through useToast() and the provider decides whether the stack has to exist. A copy that works shows its own copied state on the control, never a toast. About 35 files call useToast() this way."
                    code={`const toast = useToast()

if (!didCopy) {
    toast.error(t('copyToClipboard.copyFailed'))
    return
}`}
                >
                    <div className="flex flex-col items-end gap-2">
                        <ToastStack
                            toasts={[{ id: 'usage-copy-failed', type: 'error', message: 'Copy failed' }]}
                            dismiss={noop}
                        />
                    </div>
                </ProductUsage.Example>

                <p className="text-body-s text-foreground-secondary">
                    Honest note: ToastStack has no product call site, and should not get one. It is a provider-owned
                    render surface — the two examples above are its single render site and the shape of the code that
                    drives it.
                </p>
            </ProductUsage>
        </DocPage>
    )
}
