'use client'

import { useState } from 'react'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function SlideToConfirmPage() {
    const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // mirrors LockCardModal's phase machine for the product recreation below
    const [lockPhase, setLockPhase] = useState<'idle' | 'loading' | 'done'>('idle')

    return (
        <DocPage>
            <DocHeader
                title="SlideToConfirm"
                description="The one money-confirm control (button board 17785:11764, button.slide.*). Commits only at 100% travel — drag or arrow keys; Enter/Space never confirm. The latch resets when disabled goes true->false, so hosts that disable while the action runs get in-place retry after a failure."
                status="production"
            />

            <DocSection title="Live">
                <DocSection.Content>
                    <div className="flex flex-col gap-4">
                        <SlideToConfirm
                            label={busy ? 'Working…' : 'Slide to confirm'}
                            disabled={busy}
                            onConfirm={() => {
                                setBusy(true)
                                setTimeout(() => {
                                    setConfirmedAt(new Date().toLocaleTimeString())
                                    setBusy(false)
                                }, 1200)
                            }}
                        />
                        <SlideToConfirm label="Disabled" disabled onConfirm={() => {}} />
                        {confirmedAt && (
                            <p className="text-body-s text-foreground-secondary">
                                confirmed at {confirmedAt} — then reset via the disabled cycle
                            </p>
                        )}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="SlideToConfirm"
                        code={`import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'

<SlideToConfirm
    label={phase === 'loading' ? 'Locking…' : 'Slide to lock'}
    onConfirm={run}
    disabled={phase === 'loading'} // true->false after a failure resets the latch
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Card — lock card modal"
                    path="src/components/Card/LockCardModal.tsx"
                    description="The label flips while the request runs and disabled goes true then false again, so a failed lock can be retried in place."
                    code={`<SlideToConfirm
    label={phase === 'loading' ? t('lockModal.locking') : t('lockModal.slideToLock')}
    onConfirm={run}
    disabled={phase === 'loading'}
/>`}
                >
                    <div className="flex flex-col gap-2">
                        <SlideToConfirm
                            label={lockPhase === 'loading' ? 'Locking…' : 'Slide to lock card'}
                            disabled={lockPhase === 'loading'}
                            onConfirm={() => {
                                setLockPhase('loading')
                                setTimeout(() => setLockPhase('done'), 1200)
                            }}
                        />
                        {lockPhase === 'done' && <p className="text-body-s text-foreground-secondary">Card locked</p>}
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — onramp confirmation"
                    path="src/components/AddMoney/components/OnrampConfirmationModal.tsx"
                    description="Plain money confirm: no phase, no disabled — the modal closes on confirm."
                    code={`<SlideToConfirm label={tCommon('slideToProceed')} onConfirm={onConfirm} />`}
                >
                    <SlideToConfirm label="Slide to proceed" onConfirm={() => {}} />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
