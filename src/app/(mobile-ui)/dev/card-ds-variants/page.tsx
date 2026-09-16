'use client'

import { useEffect, useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Field } from '@/components/0_Bruddle/Field'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { Section } from '@/components/0_Bruddle/Section'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import CardFace from '@/components/Card/CardFace'
import PinInput from '@/components/Card/PinInput'
import { validatePin, type PinRejectionReason } from '@/components/Card/pin.utils'
import ActionModal from '@/components/Global/ActionModal'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import DevPageShell from '../_components/DevPageShell'
import PinDisplay from './PinDisplay'

/**
 * /dev/card-ds-variants — visual-QA variants for the card surfaces migrated
 * in the card DS-conformance PR. Every piece of data is mocked: no rainApi,
 * no network. Each section shows the shipped layout next to the proposal so
 * the decision is a side-by-side look, not a code read.
 */

// mock values — the page never talks to a backend
const MOCK_PIN = '1234'
const REVEAL_MS = 30_000
const MOCK_SAVE_MS = 800

const REJECTION_COPY: Record<PinRejectionReason, string> = {
    length: 'PIN must be 4 digits',
    repeating: 'No repeating digits (e.g., 1111)',
    sequential: 'No sequential digits (e.g., 1234)',
}

const PIN_RULES = ["Numbers can't be sequential (1234)", 'No repeating digits (1111)', 'You can change your PIN later']

const mockSave = () => new Promise<void>((resolve) => setTimeout(resolve, MOCK_SAVE_MS))

/** reveal state with the 30s auto-mask window; pct is the remaining window for the V3 countdown bar */
const useMockReveal = () => {
    const [revealed, setRevealed] = useState(false)
    const [pct, setPct] = useState(100)

    useEffect(() => {
        if (!revealed) return
        const start = Date.now()
        const id = setInterval(() => {
            const left = 1 - (Date.now() - start) / REVEAL_MS
            if (left <= 0) {
                setRevealed(false)
                setPct(100)
            } else {
                setPct(left * 100)
            }
        }, 250)
        return () => clearInterval(id)
    }, [revealed])

    const toggle = () => {
        setPct(100)
        setRevealed((v) => !v)
    }
    return { revealed, pct, toggle }
}

const EyeButton = ({ revealed, onClick }: { revealed: boolean; onClick: () => void }) => (
    <Button
        type="button"
        variant="transparent"
        size="small"
        shape="square"
        icon={revealed ? 'eye-slash' : 'eye'}
        iconSize={20}
        onClick={onClick}
        aria-label={revealed ? 'Hide pin' : 'Show pin'}
        className="w-10 shrink-0"
    />
)

const VariantBlock = ({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) => (
    <div className="flex w-full max-w-96 flex-col gap-3">
        <div className="flex flex-col gap-1">
            <p className="text-label-m text-foreground-primary uppercase">{label}</p>
            {note && <p className="text-body-xs text-foreground-secondary">{note}</p>}
        </div>
        <Card className="gap-6 p-4">{children}</Card>
    </div>
)

// ---- section 2: pin view variants ----

const PinViewV1 = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <>
            <ScreenMark icon="credit-card" color="brand" />
            <div className="flex flex-col gap-6">
                <p className="text-body-s text-foreground-secondary">Your pin is hidden for security reasons.</p>
                <div className="flex items-center gap-3">
                    <div className="ph-no-capture flex h-14 items-center">
                        <span className="text-heading-xl">{revealed ? MOCK_PIN : '****'}</span>
                    </div>
                    <EyeButton revealed={revealed} onClick={toggle} />
                </div>
                <ListItem
                    title="Change pin"
                    leading={<Icon name="more-horizontal" size={24} />}
                    chevron
                    onClick={() => {}}
                    position="single"
                />
            </div>
        </>
    )
}

const PinViewV2 = ({ withCountdown = false }: { withCountdown?: boolean }) => {
    const { revealed, pct, toggle } = useMockReveal()
    return (
        <>
            <ScreenMark icon="credit-card" color="brand" />
            <TitleBlock title="Your card pin" description="Your pin is hidden for security reasons." />
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <PinDisplay pin={MOCK_PIN} revealed={revealed} />
                    <EyeButton revealed={revealed} onClick={toggle} />
                </div>
                {withCountdown && revealed && <ProgressBar value={pct} fillClassName="bg-action-primary" />}
            </div>
            <Section title="Manage">
                <ListItem
                    title="Change pin"
                    leading={<Icon name="more-horizontal" size={24} />}
                    chevron
                    onClick={() => {}}
                    position="single"
                />
            </Section>
        </>
    )
}

// ---- section 3: pin setup variants ----

type SetupStep = 'choose' | 'confirm' | 'saving' | 'success'

const PinSetupFlow = ({ autoAdvance }: { autoAdvance: boolean }) => {
    const [step, setStep] = useState<SetupStep>('choose')
    const [first, setFirst] = useState('')
    const [second, setSecond] = useState('')
    const [fieldError, setFieldError] = useState<string | null>(null)

    const chooseValidation = first.length === 4 ? validatePin(first) : null

    // v2 proposal: the 4th valid digit advances to confirm — no continue button.
    // the 200ms pause lets the 4th dot paint before the step swaps.
    useEffect(() => {
        if (!autoAdvance || step !== 'choose') return
        if (!chooseValidation?.valid) return
        const id = setTimeout(() => setStep('confirm'), 200)
        return () => clearTimeout(id)
    }, [autoAdvance, step, chooseValidation])

    const reset = () => {
        setStep('choose')
        setFirst('')
        setSecond('')
        setFieldError(null)
    }

    const onConfirm = async () => {
        if (second !== first) {
            setFieldError('PINs do not match')
            return
        }
        setFieldError(null)
        setStep('saving')
        await mockSave()
        setStep('success')
    }

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                {autoAdvance ? (
                    // v2 proposal: the ds success shape — green check bubble above the title
                    <>
                        <IconBubble icon="check" size="l" color="green" />
                        <TitleBlock
                            title={<h2>PIN successfully set</h2>}
                            description="You can now use your card for in-store purchases."
                            align="center"
                            size="s"
                        />
                        <Button variant="purple" className="w-full" onClick={reset}>
                            Done
                        </Button>
                    </>
                ) : (
                    <>
                        <TitleBlock
                            title={<h2>PIN successfully set</h2>}
                            description="You can now use your card for in-store purchases."
                            align="center"
                            size="s"
                        />
                        <Button variant="purple" className="w-full" onClick={reset}>
                            Close
                        </Button>
                    </>
                )}
            </div>
        )
    }

    if (step === 'confirm' || step === 'saving') {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <TitleBlock
                    title={<h2>Confirm PIN</h2>}
                    description="Re-enter your PIN to verify."
                    align="center"
                    size="s"
                />
                <div className="flex flex-col items-center gap-1">
                    <PinInput value={second} onChange={setSecond} autoFocus={false} disabled={step === 'saving'} />
                    {fieldError && <FieldError>{fieldError}</FieldError>}
                </div>
                <Button
                    variant="purple"
                    className="w-full"
                    onClick={onConfirm}
                    loading={step === 'saving'}
                    disabled={second.length < 4 || step === 'saving'}
                >
                    Save
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <TitleBlock
                title={<h2>Choose a 4 digit PIN</h2>}
                description="Needed for in store purchases."
                align="center"
                size="s"
            />
            <div className="flex flex-col items-center gap-1">
                <PinInput value={first} onChange={setFirst} autoFocus={false} />
                {chooseValidation && !chooseValidation.valid && chooseValidation.reason && (
                    <FieldError>{REJECTION_COPY[chooseValidation.reason]}</FieldError>
                )}
            </div>
            <BulletList items={PIN_RULES} />
            {!autoAdvance && (
                <Button
                    variant="purple"
                    className="w-full"
                    onClick={() => setStep('confirm')}
                    disabled={!chooseValidation?.valid}
                >
                    Continue
                </Button>
            )}
        </div>
    )
}

// ---- section 5: limit edit drawer replica ----

const LimitDrawerDemo = ({ withIcon, open, onClose }: { withIcon: boolean; open: boolean; onClose: () => void }) => {
    const [value, setValue] = useState('500.00')
    const [saving, setSaving] = useState(false)

    const save = async () => {
        setSaving(true)
        await mockSave()
        setSaving(false)
        onClose()
    }

    return (
        <Drawer open={open} dismissible={!saving} onOpenChange={(o) => !o && !saving && onClose()}>
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        {withIcon && <IconBubble icon="credit-card" color="brand" />}
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>Change limit</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4">
                        <Field label="Per transaction" htmlFor={`limit-input-${withIcon}`} className="text-left">
                            <BaseInput
                                id={`limit-input-${withIcon}`}
                                type="number"
                                inputMode="decimal"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                leftContent={<span className="text-foreground-secondary">$</span>}
                                disabled={saving}
                            />
                        </Field>
                        <Button
                            variant="purple"
                            className="w-full justify-center"
                            onClick={save}
                            loading={saving}
                            disabled={saving}
                        >
                            Save changes
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

// ---- section 6: cancel confirm replica ----

const CancelModalDemo = ({ slide, open, onClose }: { slide: boolean; open: boolean; onClose: () => void }) => (
    <ActionModal
        visible={open}
        onClose={onClose}
        tone="error"
        icon="alert"
        title="Cancel your card?"
        description="You won't be able to use it again."
        content={slide ? <SlideToConfirm label="Slide to Cancel" onConfirm={onClose} /> : undefined}
        ctas={
            slide
                ? [{ text: 'Keep my card', variant: 'stroke', onClick: onClose }]
                : [
                      { text: 'Cancel card', variant: 'purple', onClick: onClose },
                      { text: 'Keep my card', variant: 'stroke', className: 'w-full', onClick: onClose },
                  ]
        }
    />
)

// ---- static limit page pieces (section 4) ----

const LimitListItem = () => (
    <Section title="Spending limit">
        <ListItem
            position="single"
            title="Per transaction"
            trailing={<span className="text-body-m-semibold">$500</span>}
            chevron
            onClick={() => {}}
        />
    </Section>
)

export default function CardDsVariantsPage() {
    const [openDrawer, setOpenDrawer] = useState<'v1' | 'v2' | null>(null)
    const [openModal, setOpenModal] = useState<'v1' | 'v2' | null>(null)

    return (
        <DevPageShell
            title="Card — DS proposal variants"
            description="Visual QA for the card DS-conformance PR. All data mocked, no backend. View at 375px."
        >
            <section className="flex flex-col gap-4">
                <TitleBlock title="1. card face radius" description="Confirm the corner radius before merge." />
                <VariantBlock label="V1 — current PR" note="rounded-sm, the DS card radius token">
                    <CardFace last4="1234" />
                </VariantBlock>
                <VariantBlock label="V2 — proposal" note="rounded-xl, restores the original card rounding">
                    <CardFace last4="1234" className="rounded-xl" />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="2. pin view page"
                    description="All variants keep the small inline eye (locked decision). Eye reveals the pin; revealed auto-masks after 30s."
                />
                <VariantBlock
                    label="V1 — current PR"
                    note="bare paragraph + text pin + change-pin row without a section"
                >
                    <PinViewV1 />
                </VariantBlock>
                <VariantBlock label="V2 — proposal" note="TitleBlock + pin cell boxes + Section around change pin">
                    <PinViewV2 />
                </VariantBlock>
                <VariantBlock label="V3 — proposal" note="V2 + countdown bar draining over the 30s reveal window">
                    <PinViewV2 withCountdown />
                </VariantBlock>
                <VariantBlock label="state: no pin set" note="the EmptyState branch, rarely seen in QA">
                    <EmptyState
                        icon="credit-card"
                        iconColor="brand"
                        title="No pin set yet"
                        description="You need to set a pin before using your card for in-store purchases."
                        cta={
                            <Button variant="purple" className="mt-4 w-full" onClick={() => {}}>
                                Set pin
                            </Button>
                        }
                    />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="3. pin setup flow"
                    description="Interactive. Save is mocked (~800ms). Try 1111 / 1234 to see validation."
                />
                <VariantBlock label="V1 — current PR" note="explicit Continue button on choose; plain text success">
                    <PinSetupFlow autoAdvance={false} />
                </VariantBlock>
                <VariantBlock
                    label="V2 — proposal"
                    note="auto-advance on the 4th valid digit; DS success shape (green check bubble)"
                >
                    <PinSetupFlow autoAdvance />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="4. card limit page"
                    description="Mock: $500 per transaction, $350 spent this period."
                />
                <VariantBlock label="V1 — current PR" note="single row, no context">
                    <ScreenMark icon="credit-card" color="brand" />
                    <LimitListItem />
                </VariantBlock>
                <VariantBlock label="V2 — proposal" note="V1 + a short explainer under the section">
                    <ScreenMark icon="credit-card" color="brand" />
                    <div className="flex flex-col gap-3">
                        <LimitListItem />
                        <BulletList items={['Applies to each transaction', 'Change it anytime']} size="xs" />
                    </div>
                </VariantBlock>
                <VariantBlock label="V3 — proposal" note="V2 + a utilization row for this period">
                    <ScreenMark icon="credit-card" color="brand" />
                    <div className="flex flex-col gap-3">
                        <LimitListItem />
                        <BulletList items={['Applies to each transaction', 'Change it anytime']} size="xs" />
                        <Card className="gap-0 px-4 py-1">
                            <DataRow label="Spent this period" value="$350 of $500" />
                            <ProgressBar value={70} fillClassName="bg-action-primary" className="mb-3" />
                        </Card>
                    </div>
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="5. limit edit drawer"
                    description="Replicas of CardLimitEditDrawer. Save is mocked."
                />
                <div className="flex w-full max-w-96 flex-col gap-3">
                    <Button variant="stroke" onClick={() => setOpenDrawer('v1')}>
                        V1 — current PR (with IconBubble)
                    </Button>
                    <Button variant="stroke" onClick={() => setOpenDrawer('v2')}>
                        V2 — proposal (IconBubble removed)
                    </Button>
                </div>
                <LimitDrawerDemo withIcon open={openDrawer === 'v1'} onClose={() => setOpenDrawer(null)} />
                <LimitDrawerDemo withIcon={false} open={openDrawer === 'v2'} onClose={() => setOpenDrawer(null)} />
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="6. cancel confirm CTA"
                    description="Replicas of the cancel confirm phase. Confirm is mocked — it just closes."
                />
                <div className="flex w-full max-w-96 flex-col gap-3">
                    <Button variant="stroke" onClick={() => setOpenModal('v1')}>
                        V1 — current PR (purple Cancel button)
                    </Button>
                    <Button variant="stroke" onClick={() => setOpenModal('v2')}>
                        V2 — proposal (slide to cancel)
                    </Button>
                </div>
                <CancelModalDemo slide={false} open={openModal === 'v1'} onClose={() => setOpenModal(null)} />
                <CancelModalDemo slide open={openModal === 'v2'} onClose={() => setOpenModal(null)} />
            </section>
        </DevPageShell>
    )
}
