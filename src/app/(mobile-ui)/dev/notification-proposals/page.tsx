'use client'

import { useState } from 'react'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import DevPageShell from '../_components/DevPageShell'
import DevSectionLabel from '../_components/DevSectionLabel'
import DevNoteCard from '../_components/DevNoteCard'

/**
 * /dev/notification-proposals — PROPOSAL ONLY, nothing here ships.
 *
 * Team complaints about the current Notification: text too big (Body/M 16px),
 * footprint too big (breaks layouts), tinted box is ugly next to the line-based
 * DS components, especially bad inside modals, and the toast variant renders
 * two icons when a caller passes `content` with its own icon (RainCooldownContext
 * clock pill) without `hideIcon`.
 *
 * Four redesigned variants below, each built from existing tokens only
 * (badge backgrounds, icon-bubble accents, foreground-error, radius-sm,
 * body-s/xs type steps). All proposal components live in this file.
 */

type Priority = 'info' | 'success' | 'attention' | 'error' | 'helper'

const PRIORITY_META: Record<Priority, { icon: IconName; bg: string; accent: string; accentText: string }> = {
    // accents reuse the icon-bubble palette (saturated marks that already
    // exist) + the error semantic tokens. no new colors.
    info: {
        icon: 'info',
        bg: 'bg-background-badge-info',
        accent: 'border-background-icon-bubble-blue',
        accentText: 'text-avatar-blue-foreground',
    },
    success: {
        icon: 'check',
        bg: 'bg-background-badge-success',
        accent: 'border-background-icon-bubble-green',
        accentText: 'text-avatar-green-foreground',
    },
    attention: {
        icon: 'alert',
        bg: 'bg-background-badge-attention',
        accent: 'border-background-icon-bubble-yellow',
        accentText: 'text-avatar-yellow-foreground',
    },
    error: {
        icon: 'ban',
        bg: 'bg-background-badge-error',
        accent: 'border-border-error',
        accentText: 'text-foreground-error',
    },
    helper: {
        icon: 'info',
        bg: 'bg-background-badge-helper',
        accent: 'border-border-subtle',
        accentText: 'text-foreground-secondary',
    },
}

const PRIORITIES: Priority[] = ['info', 'success', 'attention', 'error', 'helper']

const LONG_COPY =
    'Your transfer could not be completed because the receiving bank rejected the payment. Check the account details and try again, or contact support if the problem does not go away.'

// ---------------------------------------------------------------------------
// variant A — compact inline (tinted box, one type step down, half the padding)
// ---------------------------------------------------------------------------

const CompactNotification = ({
    priority = 'info',
    title,
    children,
    onDismiss,
    className,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
    onDismiss?: () => void
    className?: string
}) => {
    const { icon, bg } = PRIORITY_META[priority]
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge(
                'flex items-start gap-1.5 rounded-sm p-2 text-start text-foreground-over-color-secondary',
                bg,
                className
            )}
        >
            <Icon name={icon} size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 text-body-s break-words">
                {title && <span className="text-body-s font-semibold">{title} </span>}
                {children}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    aria-label="close"
                    onClick={onDismiss}
                    className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-round"
                >
                    <Icon name="cancel" size={12} />
                </button>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// variant B — slim accent banner (left rule instead of a tint block)
// ---------------------------------------------------------------------------

const AccentNotification = ({
    priority = 'info',
    title,
    children,
    className,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
    className?: string
}) => {
    const { icon, accent, accentText } = PRIORITY_META[priority]
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge('flex items-start gap-2 border-l-2 py-0.5 pl-2.5 text-start', accent, className)}
        >
            <Icon name={icon} size={16} className={twMerge('mt-0.5 shrink-0', accentText)} />
            <div className="min-w-0 flex-1 text-body-s break-words text-foreground-primary">
                {title && <span className="font-semibold">{title} </span>}
                {children}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// variant C — quiet modal note (no box at all, reads as helper text)
// ---------------------------------------------------------------------------

const QuietNotification = ({
    priority = 'info',
    children,
    className,
}: {
    priority?: Priority
    children?: React.ReactNode
    className?: string
}) => {
    const { icon, accentText } = PRIORITY_META[priority]
    // error keeps the semantic red; everything else stays secondary so the
    // note never competes with the modal's title and cta
    const tone = priority === 'error' ? 'text-foreground-error' : 'text-foreground-secondary'
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge('flex items-start justify-center gap-1.5 text-start', tone, className)}
        >
            <Icon name={icon} size={16} className={twMerge('mt-px shrink-0', priority !== 'error' && accentText)} />
            <span className="min-w-0 text-body-xs break-words">{children}</span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// variant D — toast redesign (compact pill, ONE icon slot, dismiss affordance)
// ---------------------------------------------------------------------------

const ToastProposal = ({
    priority = 'info',
    children,
    content,
    onDismiss,
    className,
}: {
    priority?: Priority
    children?: React.ReactNode
    /** custom content REPLACES the icon+message slot entirely — the double-icon
        bug cannot happen because there is no second slot to stack onto */
    content?: React.ReactNode
    onDismiss?: () => void
    className?: string
}) => {
    const { icon, accentText } = PRIORITY_META[priority]
    return (
        <div
            role="status"
            className={twMerge(
                'flex w-max max-w-full items-center gap-2 rounded-sm border border-border-default bg-background-default py-2 pr-2 pl-3',
                className
            )}
        >
            {content ?? (
                <>
                    <Icon name={icon} size={16} className={twMerge('shrink-0', accentText)} />
                    <span className="min-w-0 text-body-s break-words text-foreground-primary">{children}</span>
                </>
            )}
            {onDismiss && (
                <button
                    type="button"
                    aria-label="close"
                    onClick={onDismiss}
                    className="flex size-6 shrink-0 items-center justify-center rounded-round text-foreground-secondary"
                >
                    <Icon name="cancel" size={12} />
                </button>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// page scaffolding
// ---------------------------------------------------------------------------

const noop = () => {}

/** real form controls + a mock modal panel, so each variant is judged in the
 *  two contexts the team complained about */
const ContextStrip = ({
    inline,
    modal,
}: {
    /** the variant rendered as a form-level note */
    inline: React.ReactNode
    /** the variant rendered inside a mock ActionModal panel */
    modal: React.ReactNode
}) => (
    <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-sm border border-border-subtle p-4">
            <p className="text-body-xs text-foreground-secondary">next to Input + Button</p>
            <BaseInput placeholder="IBAN" defaultValue="ES91 2100 0418 4502 0005 1332" readOnly />
            {inline}
            <Button size="small" onClick={noop} className="w-auto min-w-28 self-start">
                Continue
            </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-sm border border-border-subtle p-4">
            <p className="text-body-xs text-foreground-secondary">inside a modal panel</p>
            {/* mimics ActionModal: centered content, p-6, heading-xs title */}
            <div className="flex flex-col items-center gap-3 rounded-sm border border-border-default bg-background-default p-6 text-center">
                <h3 className="text-heading-xs">Confirm withdrawal</h3>
                <p className="text-body-s text-foreground-secondary">You are about to withdraw $50.00 to your bank.</p>
                {modal}
                <Button size="small" onClick={noop} className="w-auto min-w-28">
                    Confirm
                </Button>
            </div>
        </div>
    </div>
)

const VariantSection = ({
    label,
    rationale,
    children,
}: {
    label: string
    rationale: string
    children: React.ReactNode
}) => (
    <section className="flex flex-col gap-3">
        <DevSectionLabel>{label}</DevSectionLabel>
        <p className="max-w-3xl text-body-s text-foreground-secondary">{rationale}</p>
        {children}
    </section>
)

export default function NotificationProposalsPage() {
    const [toasts, setToasts] = useState<Priority[]>(['info', 'success', 'attention', 'error'])

    return (
        <DevPageShell
            title="Notification redesign proposals"
            description="Four candidate replacements for 0_Bruddle/Notification, built from existing tokens only. Nothing here ships — pick one (or a mix) and it gets built for real."
        >
            <section className="flex flex-col gap-3">
                <DevSectionLabel>current component (for comparison)</DevSectionLabel>
                <p className="max-w-3xl text-body-s text-foreground-secondary">
                    Body/M 16px text, 20px icon, 12px padding, full tint block. The complaints: too big, breaks layouts,
                    ugly next to line-based DS components, worst inside modals.
                </p>
                <div className="flex max-w-xl flex-col gap-2">
                    <Notification priority="error">Ups, something went wrong</Notification>
                    <Notification priority="info" title="EUR accounts only">
                        {LONG_COPY}
                    </Notification>
                </div>
            </section>

            <VariantSection
                label="A — compact inline"
                rationale="Same anatomy, one type step down (Body/S 14px), 16px icon, half the padding. Keeps the familiar tinted box but shrinks the footprint ~40% so it stops dominating forms. Lowest-risk swap: same props, same call sites."
            >
                <div className="flex max-w-xl flex-col gap-2">
                    {PRIORITIES.map((p) => (
                        <CompactNotification key={p} priority={p}>
                            {p === 'error' ? 'Ups, something went wrong' : `A short ${p} message`}
                        </CompactNotification>
                    ))}
                    <CompactNotification priority="error" title="Transfer failed." onDismiss={noop}>
                        {LONG_COPY}
                    </CompactNotification>
                </div>
                <ContextStrip
                    inline={<CompactNotification priority="error">This IBAN is not a EUR account.</CompactNotification>}
                    modal={
                        <CompactNotification priority="attention" className="w-full">
                            Withdrawals over $1,000 need extra verification.
                        </CompactNotification>
                    }
                />
            </VariantSection>

            <VariantSection
                label="B — slim accent banner"
                rationale="Kills the tint block: transparent background, 2px left rule + tinted 16px icon carry the priority. Fits the bordered, line-based DS components instead of fighting them, and long copy reads as text, not as a colored slab."
            >
                <div className="flex max-w-xl flex-col gap-3">
                    {PRIORITIES.map((p) => (
                        <AccentNotification key={p} priority={p}>
                            {p === 'error' ? 'Ups, something went wrong' : `A short ${p} message`}
                        </AccentNotification>
                    ))}
                    <AccentNotification priority="error" title="Transfer failed.">
                        {LONG_COPY}
                    </AccentNotification>
                </div>
                <ContextStrip
                    inline={<AccentNotification priority="error">This IBAN is not a EUR account.</AccentNotification>}
                    modal={
                        <AccentNotification priority="attention" className="w-full">
                            Withdrawals over $1,000 need extra verification.
                        </AccentNotification>
                    }
                />
            </VariantSection>

            <VariantSection
                label="C — quiet modal note"
                rationale="For inside modals only: no box at all. 16px tinted icon + Body/XS secondary text, so the note never competes with the modal title and CTA. Errors keep the semantic red. Would live alongside A or B, chosen per context."
            >
                <div className="flex max-w-xl flex-col items-start gap-2">
                    {PRIORITIES.map((p) => (
                        <QuietNotification key={p} priority={p}>
                            {p === 'error' ? 'Ups, something went wrong' : `A short ${p} message`}
                        </QuietNotification>
                    ))}
                    <QuietNotification priority="error">{LONG_COPY}</QuietNotification>
                </div>
                <ContextStrip
                    inline={<QuietNotification priority="error">This IBAN is not a EUR account.</QuietNotification>}
                    modal={
                        <QuietNotification priority="attention">
                            Withdrawals over $1,000 need extra verification.
                        </QuietNotification>
                    }
                />
            </VariantSection>

            <VariantSection
                label="D — toast redesign"
                rationale="Compact white pill: single 16px tinted icon, Body/S text, small explicit dismiss. Custom content replaces the icon+message slot entirely instead of rendering next to a priority icon — which is the double-icon bug, fixed by construction."
            >
                <div className="flex flex-col items-end gap-2 rounded-sm border border-border-subtle bg-background-page p-4">
                    <p className="mr-auto text-body-xs text-foreground-secondary">
                        mock of the bottom-right stack — dismiss works
                    </p>
                    {toasts.map((p) => (
                        <ToastProposal
                            key={p}
                            priority={p}
                            onDismiss={() => setToasts((prev) => prev.filter((t) => t !== p))}
                        >
                            {p === 'error' ? 'Ups, something went wrong' : `A short ${p} toast`}
                        </ToastProposal>
                    ))}
                    {toasts.length < 4 && (
                        <Button
                            size="small"
                            variant="stroke"
                            onClick={() => setToasts(['info', 'success', 'attention', 'error'])}
                            className="w-auto"
                        >
                            Reset stack
                        </Button>
                    )}
                    <ToastProposal priority="error" onDismiss={noop} className="max-w-md">
                        {LONG_COPY}
                    </ToastProposal>
                    <ToastProposal
                        content={
                            <span className="flex items-center gap-2 text-body-s">
                                <Icon name="clock" size={16} className="shrink-0" />
                                Card locked for 4:32
                            </span>
                        }
                        onDismiss={noop}
                    />
                </div>
                <p className="max-w-3xl text-body-xs text-foreground-secondary">
                    The last pill is the RainCooldownContext clock toast — today it renders the priority icon AND the
                    clock (the double-icon bug). Here custom content owns the whole slot, so one icon by construction.
                </p>
            </VariantSection>

            <DevNoteCard title="Proposal notes">
                All colors come from existing tokens: badge backgrounds, the icon-bubble accents, avatar foregrounds,
                and the error semantics. No new colors, shadows, or radii. Current-component comparison renders live
                above each context strip. Root cause of the double-icon toast bug: Toast passes caller content as
                Notification children while Notification still prepends its priority icon — hideIcon is opt-in and
                RainCooldownContext forgot it.
            </DevNoteCard>
        </DevPageShell>
    )
}
