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
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
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

/**
 * /dev/card-ds-variants — visual-QA variants for the card surfaces migrated
 * in the card DS-conformance PR. Every piece of data is mocked: no rainApi,
 * no network. Each section shows the shipped layout next to the proposal so
 * the decision is a side-by-side look, not a code read.
 *
 * Round 2: sections 1, 5, 6 and the empty state are APPROVED (winner kept,
 * losers deleted). Sections 2 and 3 were rejected wholesale — the new
 * variants below each follow the anatomy of a real shipped page, named in
 * the variant label.
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

/** the locked pin representation: plain text digits/mask + the small inline eye */
const PinText = ({ revealed, toggle }: { revealed: boolean; toggle: () => void }) => (
    <div className="flex items-center gap-3">
        <div className="ph-no-capture flex h-14 items-center">
            <span className="text-heading-xl">{revealed ? MOCK_PIN : '****'}</span>
        </div>
        <EyeButton revealed={revealed} onClick={toggle} />
    </div>
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

// baseline replica of the current PR's CardPinScreen render
const PinViewV1 = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <>
            <ScreenMark icon="credit-card" color="brand" />
            <div className="flex flex-col gap-6">
                <p className="text-body-s text-foreground-secondary">Your pin is hidden for security reasons.</p>
                <PinText revealed={revealed} toggle={toggle} />
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

// anatomy from /profile/backup: hero card up top, then titled sections of
// grouped rows — the page's copy lives inside the hero card, not floating
const PinViewBackupAnatomy = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <div className="flex flex-col gap-4">
            <Card className="items-center gap-2 px-4 py-6 text-center">
                <TitleBlock
                    align="center"
                    title="Your card pin"
                    description="Your pin is hidden for security reasons."
                />
                <PinText revealed={revealed} toggle={toggle} />
            </Card>
            <Section title="Manage">
                <ListGroup>
                    <ListItem title="Change pin" chevron onClick={() => {}} />
                </ListGroup>
            </Section>
        </div>
    )
}

// anatomy from /limits (LimitsPageView): info notification as the page
// description, then settings-style rows — the pin itself is a row value
const PinViewLimitsAnatomy = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <div className="flex flex-col gap-4">
            <Notification priority="info">Your pin is hidden for security reasons.</Notification>
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
                                <EyeButton revealed={revealed} onClick={toggle} />
                            </div>
                        }
                    />
                    <ListItem title="Change pin" chevron onClick={() => {}} />
                </ListGroup>
            </Section>
        </div>
    )
}

// anatomy from withdraw PixKeySendView: heading-card + description column,
// the value where the input sits, helper line, full-width cta at the end
const PinViewFlowAnatomy = () => {
    const { revealed, toggle } = useMockReveal()
    return (
        <div className="space-y-4">
            <h2 className="text-heading-card text-foreground-primary">Your card pin</h2>
            <div className="space-y-2">
                <PinText revealed={revealed} toggle={toggle} />
                <div className="flex items-center gap-2 text-body-s text-foreground-secondary">
                    <span>Your pin is hidden for security reasons.</span>
                </div>
            </div>
            <Button variant="stroke" className="w-full" shadowSize="4" onClick={() => {}}>
                Change pin
            </Button>
        </div>
    )
}

// ---- section 3: pin setup variants ----

type SetupStep = 'choose' | 'confirm' | 'saving' | 'success'

const usePinSetup = () => {
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

    return { step, setStep, first, setFirst, second, setSecond, fieldError, chooseValidation, reset, onConfirm }
}

const SetupSuccess = ({ onDone }: { onDone: () => void }) => (
    <div className="flex flex-col items-center gap-4 text-center">
        <IconBubble icon="check" size="l" color="green" />
        <TitleBlock
            title={<h2>PIN successfully set</h2>}
            description="You can now use your card for in-store purchases."
            align="center"
            size="s"
        />
        <Button variant="purple" className="w-full" onClick={onDone}>
            Done
        </Button>
    </div>
)

// baseline replica of the current PR's CardPinSetupFlow (centered TitleBlock,
// centered pin, bullets, continue button, plain-text success)
const PinSetupBaseline = () => {
    const s = usePinSetup()

    if (s.step === 'success') {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <TitleBlock
                    title={<h2>PIN successfully set</h2>}
                    description="You can now use your card for in-store purchases."
                    align="center"
                    size="s"
                />
                <Button variant="purple" className="w-full" onClick={s.reset}>
                    Close
                </Button>
            </div>
        )
    }

    if (s.step === 'confirm' || s.step === 'saving') {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <TitleBlock
                    title={<h2>Confirm PIN</h2>}
                    description="Re-enter your PIN to verify."
                    align="center"
                    size="s"
                />
                <div className="flex flex-col items-center gap-1">
                    <PinInput
                        value={s.second}
                        onChange={s.setSecond}
                        autoFocus={false}
                        disabled={s.step === 'saving'}
                    />
                    {s.fieldError && <FieldError>{s.fieldError}</FieldError>}
                </div>
                <Button
                    variant="purple"
                    className="w-full"
                    onClick={s.onConfirm}
                    loading={s.step === 'saving'}
                    disabled={s.second.length < 4 || s.step === 'saving'}
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
                <PinInput value={s.first} onChange={s.setFirst} autoFocus={false} />
                {s.chooseValidation && !s.chooseValidation.valid && s.chooseValidation.reason && (
                    <FieldError>{REJECTION_COPY[s.chooseValidation.reason]}</FieldError>
                )}
            </div>
            <BulletList items={PIN_RULES} />
            <Button
                variant="purple"
                className="w-full"
                onClick={() => s.setStep('confirm')}
                disabled={!s.chooseValidation?.valid}
            >
                Continue
            </Button>
        </div>
    )
}

// anatomy from add-money InputAmountStep: left text-label-l prompt, input
// column, one helper line in body-xs, purple cta with shadow, flow error
// notification below the cta
const PinSetupAmountAnatomy = () => {
    const s = usePinSetup()

    if (s.step === 'success') return <SetupSuccess onDone={s.reset} />

    const isConfirm = s.step === 'confirm' || s.step === 'saving'
    return (
        <div className="flex flex-col gap-4">
            <div className="text-label-l">{isConfirm ? 'Re-enter your PIN to verify' : 'Choose a 4 digit PIN'}</div>
            <div className="flex flex-col gap-1">
                {isConfirm ? (
                    <PinInput
                        value={s.second}
                        onChange={s.setSecond}
                        autoFocus={false}
                        disabled={s.step === 'saving'}
                        className="justify-start"
                    />
                ) : (
                    <PinInput value={s.first} onChange={s.setFirst} autoFocus={false} className="justify-start" />
                )}
                {!isConfirm && s.chooseValidation && !s.chooseValidation.valid && s.chooseValidation.reason && (
                    <FieldError>{REJECTION_COPY[s.chooseValidation.reason]}</FieldError>
                )}
            </div>
            <div className="flex items-center gap-2 text-body-xs text-foreground-secondary">
                <span>No sequential (1234) or repeating (1111) digits. You can change it later.</span>
            </div>
            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                onClick={isConfirm ? s.onConfirm : () => s.setStep('confirm')}
                loading={s.step === 'saving'}
                disabled={isConfirm ? s.second.length < 4 || s.step === 'saving' : !s.chooseValidation?.valid}
            >
                {isConfirm ? 'Save' : 'Continue'}
            </Button>
            {isConfirm && s.fieldError && <Notification priority="error">{s.fieldError}</Notification>}
        </div>
    )
}

// anatomy from withdraw PixKeySendView: heading-card + input column with the
// field error, restyled bullets under the input, continue cta with shadow
const PinSetupPixAnatomy = () => {
    const s = usePinSetup()

    if (s.step === 'success') return <SetupSuccess onDone={s.reset} />

    const isConfirm = s.step === 'confirm' || s.step === 'saving'
    return (
        <div className="space-y-4">
            <h2 className="text-heading-card text-foreground-primary">
                {isConfirm ? 'Confirm PIN' : 'Choose a 4 digit PIN'}
            </h2>
            <div className="space-y-2">
                <div className="flex flex-col gap-1">
                    {isConfirm ? (
                        <PinInput
                            value={s.second}
                            onChange={s.setSecond}
                            autoFocus={false}
                            disabled={s.step === 'saving'}
                            className="justify-start"
                        />
                    ) : (
                        <PinInput value={s.first} onChange={s.setFirst} autoFocus={false} className="justify-start" />
                    )}
                    {isConfirm
                        ? s.fieldError && <FieldError>{s.fieldError}</FieldError>
                        : s.chooseValidation &&
                          !s.chooseValidation.valid &&
                          s.chooseValidation.reason && (
                              <FieldError>{REJECTION_COPY[s.chooseValidation.reason]}</FieldError>
                          )}
                </div>
                {!isConfirm && <BulletList items={PIN_RULES} size="xs" />}
            </div>
            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                onClick={isConfirm ? s.onConfirm : () => s.setStep('confirm')}
                loading={s.step === 'saving'}
                disabled={isConfirm ? s.second.length < 4 || s.step === 'saving' : !s.chooseValidation?.valid}
            >
                {isConfirm ? 'Save' : 'Continue'}
            </Button>
        </div>
    )
}

// ---- section 5: limit edit drawer (approved: no icon bubble) ----

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
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    return (
        <DevPageShell
            title="Card — DS proposal variants"
            description="Visual QA for the card DS-conformance PR. All data mocked, no backend. View at 375px. Sections 1, 5, 6 + the empty state are decided; section 4 awaits a verdict; sections 2 and 3 carry round-2 variants derived from real shipped-page anatomies."
        >
            <section className="flex flex-col gap-4">
                <TitleBlock title="1. card face radius — APPROVED" description="Verdict: rounded-xl wins." />
                <VariantBlock label="Winner — rounded-xl" note="was V2; restores the original card rounding">
                    <CardFace last4="1234" className="rounded-xl" />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="2. pin view page — round 2"
                    description="All prior variants rejected (ScreenMark pattern and pin cell boxes both out). Locked: plain **** heading + small inline eye. New variants follow real shipped-page anatomies, named per variant. Eye reveals; auto-masks after 30s."
                />
                <VariantBlock label="V1 — current PR baseline" note="kept for comparison only — rejected">
                    <PinViewV1 />
                </VariantBlock>
                <VariantBlock
                    label="V4 — anatomy from /profile/backup"
                    note="hero card holds the copy and the pin; manage actions grouped under a titled section"
                >
                    <PinViewBackupAnatomy />
                </VariantBlock>
                <VariantBlock
                    label="V5 — anatomy from /limits"
                    note="info notification as page description; pin is a settings row value (body-m-semibold, not heading-xl), change pin in the same group"
                >
                    <PinViewLimitsAnatomy />
                </VariantBlock>
                <VariantBlock
                    label="V6 — anatomy from withdraw pix-key step"
                    note="flow-step shape: heading-card, value where the input sits, helper line, full-width cta"
                >
                    <PinViewFlowAnatomy />
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
                    title="3. pin setup flow — round 2"
                    description="All prior variants rejected. Interactive; real PinInput; save mocked (~800ms). Try 1111 / 1234 to see validation. New variants follow the app's flow-step anatomies."
                />
                <VariantBlock label="V1 — current PR baseline" note="kept for comparison only — rejected">
                    <PinSetupBaseline />
                </VariantBlock>
                <VariantBlock
                    label="V2 — anatomy from add-money amount step"
                    note="left label-l prompt, left-aligned input, single body-xs helper line, cta with shadow, flow error below the cta"
                >
                    <PinSetupAmountAnatomy />
                </VariantBlock>
                <VariantBlock
                    label="V3 — anatomy from withdraw pix-key step"
                    note="heading-card, input column with field error, bullets restyled xs under the input, cta with shadow"
                >
                    <PinSetupPixAnatomy />
                </VariantBlock>
            </section>

            <section className="flex flex-col gap-4">
                <TitleBlock
                    title="4. card limit page — awaiting verdict"
                    description="Mock: $500 per transaction, $350 spent this period. No decision yet — all three variants stand."
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
