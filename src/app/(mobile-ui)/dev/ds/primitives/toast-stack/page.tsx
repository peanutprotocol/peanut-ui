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

const noop = () => {}

export default function ToastStackPage() {
    return (
        <DocPage>
            <DocHeader
                title="ToastStack"
                description="The toast provider's render surface, split out so framer-motion stays out of the initial bundle. Product code never renders it — ToastProvider owns it; fire toasts via useToast()."
                status="production"
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

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="The one render site — ToastProvider"
                    path="src/components/0_Bruddle/Toast.tsx"
                    description="ToastProvider mounts the stack inside its fixed bottom-right container, and only once a toast has been asked for. AppFlowProviders (src/context/appFlowProviders.tsx) wraps every app route in that provider, so the marketing site never loads the chunk. Recreated here with a static list, un-fixed, inside the box."
                    code={`<div className={twMerge(
    'fixed right-4 z-[99999] flex flex-col items-end gap-2 motion-safe:transition-[bottom] motion-safe:duration-fast',
    toasts.some((t) => t.raised) ? RAISED_BOTTOM : NORMAL_BOTTOM
)}>
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
                    path="src/features/deposit-accounts/components/DepositShareActions.tsx"
                    description="A representative caller: no ToastStack, no props — the copy action reports through useToast() and the provider decides whether the stack has to exist. About 35 files call useToast() this way."
                    code={`const toast = useToast()

if (copied) toast.success(t('share.copied'))
else toast.error(t('share.copyFailed'))`}
                >
                    <div className="flex flex-col items-end gap-2">
                        <ToastStack
                            toasts={[{ id: 'usage-copied', type: 'success', message: 'Account details copied' }]}
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
