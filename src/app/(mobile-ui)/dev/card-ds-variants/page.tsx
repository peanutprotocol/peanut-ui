'use client'

import { useEffect, useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Field } from '@/components/0_Bruddle/Field'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
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

/**
 * /dev/card-ds-variants — visual-QA variants for the card surfaces migrated
 * in the card DS-conformance PR. Every piece of data is mocked: no rainApi,
 * no network. Round 3: every section is decided; pin view and card limit
 * carry the final requested tweaks, labeled "final tweak — confirm".
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

/** reveal state with the 30s auto-mask window */
const useMockReveal = () => {
    const [revealed, setRevealed] = useState(false)

    useEffect(() => {
        if (!revealed) return
        const id = setTimeout(() => setRevealed(false), REVEAL_MS)
        return () => clearTimeout(id)
    }, [revealed])

    return { revealed, toggle: () => setRevealed((v) => !v) }
}

const VariantBlock = ({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) => (
    <div className="flex w-full max-w-96 flex-col gap-3">
        <div className="flex flex-col gap-1">
            <p className="text-label-m text-foreground-primary uppercase">{label}</p>
            {note && <p className="text-body-xs text-foreground-secondary">{note}</p>}
        </div>
        <Card className="gap-6 p-4">{children}</Card>
    </div>
)

// ---- section 2: pin view (winner: /limits anatomy + round-3 tweaks) ----

// both rows are stock ListItems with a 24px leading icon and a 20px trailing
// glyph — identical anatomy, no per-row height or padding overrides. the pin
// row itself is the reveal toggle, so the eye stays a small inline glyph while
// the touch target is the full row.
const PinViewWinner = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <div className="flex flex-col gap-4">
            <Section title="Card pin">
                <ListGroup>
                    <ListItem
                        title="PIN"
                        leading={<Icon name="credit-card" size={24} />}
                        trailing={
                            <div className="flex items-center gap-2">
                                <span className="ph-no-capture text-body-m-semibold">
                                    {revealed ? MOCK_PIN : '****'}
                                </span>
                                <Icon name={revealed ? 'eye-slash' : 'eye'} size={20} />
                            </div>
                        }
                        onClick={toggle}
                        aria-label={revealed ? 'Hide pin' : 'Show pin'}
                    />
                    <ListItem title="Change pin" leading={<Icon name="edit" size={24} />} chevron onClick={() => {}} />
                </ListGroup>
            </Section>
            <Notification priority="info">Your pin is hidden for security reasons.</Notification>
        </div>
    )
}

// ---- section 3: pin setup (approved: the current PR flow) ----

type SetupStep = 'choose' | 'confirm' | 'saving' | 'success'

// replica of the shipped CardPinSetupFlow with the save mocked
const PinSetupFlowDemo = () => {
    const [step, setStep] = useState<SetupStep>('choose')
    const [first, setFirst] = useState('')
    const [second, setSecond] = useState('')
    const [fieldError, setFieldError] = useState<string | null>(null)

    const chooseValidation = first.length === 4 ? validatePin(first) : null

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
                <TitleBlock
                    title={<h2>PIN successfully set</h2>}
                    description="You can now use your card for in-store purchases."
                    align="center"
                    size="s"
                />
                <Button variant="purple" className="w-full" onClick={reset}>
                    Close
                </Button>
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
            <Button
                variant="purple"
                className="w-full"
                onClick={() => setStep('confirm')}
                disabled={!chooseValidation?.valid}
            >
                Continue
            </Button>
        </div>
    )
}

// ---- approved limit edit drawer (no icon bubble) ----

const LimitDrawerDemo = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
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
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>Change limit</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4">
                        <Field label="Per transaction" htmlFor="limit-input" className="text-left">
                            <BaseInput
                                id="limit-input"
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

// ---- section 4: card limit (winner: V3 + round-3 tweaks) ----

const CardLimitWinner = () => {
    const [editing, setEditing] = useState(false)
    return (
        <div className="flex flex-col gap-3">
            <Section title="Spending limit">
                <ListItem
                    position="single"
                    title="Per transaction"
                    trailing={<span className="text-body-m-semibold">$500</span>}
                    chevron
                    onClick={() => setEditing(true)}
                />
            </Section>
            <Card className="gap-0 px-4 py-1">
                <DataRow label="Spent this period" value="$350 of $500" />
                <ProgressBar value={70} fillClassName="bg-action-primary" className="mb-3" />
            </Card>
            <Notification priority="info">
                The limit applies to each transaction. You can change it anytime.
            </Notification>
            <LimitDrawerDemo open={editing} onClose={() => setEditing(false)} />
        </div>
    )
}

// ---- section 6: cancel confirm (approved: slide to confirm) ----

const CancelModalDemo = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <ActionModal
        visible={open}
        onClose={onClose}
        tone="error"
        icon="alert"
        title="Cancel your card?"
        description="You won't be able to use it again."
        content={<SlideToConfirm label="Slide to Cancel" onConfirm={onClose} />}
        ctas={[{ text: 'Keep my card', variant: 'stroke', onClick: onClose }]}
    />
)

export default function CardDsVariantsPage() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    return (
        <DevPageShell
            title="Card — DS proposal variants"
            description="Visual QA for the card DS-conformance PR. All data mocked, no backend. View at 375px. Round 3: all sections decided; pin view and card limit carry the final requested tweaks — confirm those two."
        >
            <section className="flex flex-col gap-4">
                <TitleBlock title="1. card face radius — APPROVED" description="Verdict: rounded-xl wins." />
                <VariantBlock label="Winner — rounded-xl" note="restores the original card rounding">
                    <CardFace last4="1234" className="rounded-xl" />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="2. pin view — final tweak — confirm"
                    description="Winner: the /limits anatomy (was V5), with the round-3 changes: info notification moved below the rows, change-pin row gets the pencil icon, both rows are stock ListItems of identical size (the pin row itself toggles the reveal; auto-masks after 30s)."
                />
                <VariantBlock label="Winner — /limits anatomy + tweaks" note="tap the PIN row to reveal">
                    <PinViewWinner />
                </VariantBlock>
                <VariantBlock label="state: no pin set — APPROVED" note="ships as-is">
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
                    title="3. pin setup flow — APPROVED"
                    description="Verdict: the current PR flow ships as-is. Interactive replica; save mocked (~800ms). Try 1111 / 1234 to see validation."
                />
                <VariantBlock label="Winner — current PR flow">
                    <PinSetupFlowDemo />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="4. card limit — final tweak — confirm"
                    description="Winner: V3 (utilization bar), with the round-3 changes: icon bubble removed, explainer moved to a bottom info notification, and the limit row tap opens the approved edit drawer. Mock: $500 per transaction, $350 spent."
                />
                <VariantBlock label="Winner — V3 + tweaks" note="tap the limit row to open the edit drawer">
                    <CardLimitWinner />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="5. limit edit drawer — APPROVED"
                    description="Verdict: without the IconBubble wins. Save is mocked."
                />
                <div className="flex w-full max-w-96 flex-col gap-3">
                    <Button variant="stroke" onClick={() => setDrawerOpen(true)}>
                        Open winner — no IconBubble
                    </Button>
                </div>
                <LimitDrawerDemo open={drawerOpen} onClose={() => setDrawerOpen(false)} />
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="6. cancel confirm CTA — APPROVED"
                    description="Verdict: SlideToConfirm wins. Confirm is mocked — it just closes."
                />
                <div className="flex w-full max-w-96 flex-col gap-3">
                    <Button variant="stroke" onClick={() => setModalOpen(true)}>
                        Open winner — slide to cancel
                    </Button>
                </div>
                <CancelModalDemo open={modalOpen} onClose={() => setModalOpen(false)} />
            </section>
        </DevPageShell>
    )
}
