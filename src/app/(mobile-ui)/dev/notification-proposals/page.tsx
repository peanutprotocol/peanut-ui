'use client'

import { useState } from 'react'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
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

/** checklist rows shared by the A/B variants (mirrors the production `items` prop) */
const CheckRows = ({ items }: { items: React.ReactNode[] }) => (
    <div className="flex flex-col gap-1 text-body-xs">
        {items.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
                <Icon name="check" size={14} className="mt-px shrink-0" />
                <div className="min-w-0 flex-1">{item}</div>
            </div>
        ))}
    </div>
)

const CompactNotification = ({
    priority = 'info',
    title,
    children,
    items,
    hideIcon,
    onDismiss,
    className,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
    items?: React.ReactNode[]
    hideIcon?: boolean
    onDismiss?: () => void
    className?: string
}) => {
    const { icon, bg } = PRIORITY_META[priority]
    const showIcon = !items && !hideIcon
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge(
                'flex items-start gap-1.5 rounded-sm p-2 text-start text-foreground-over-color-secondary',
                bg,
                className
            )}
        >
            {showIcon && <Icon name={icon} size={16} className="mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1 text-body-s break-words">
                {title && <span className="text-body-s font-semibold">{title} </span>}
                {items ? <CheckRows items={items} /> : children}
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
    items,
    hideIcon,
    className,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
    items?: React.ReactNode[]
    hideIcon?: boolean
    className?: string
}) => {
    const { icon, accent, accentText } = PRIORITY_META[priority]
    const showIcon = !items && !hideIcon
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge('flex items-start gap-2 border-l-2 py-0.5 pl-2.5 text-start', accent, className)}
        >
            {showIcon && <Icon name={icon} size={16} className={twMerge('mt-0.5 shrink-0', accentText)} />}
            <div className="min-w-0 flex-1 text-body-s break-words text-foreground-primary">
                {title && <span className="font-semibold">{title} </span>}
                {items ? <CheckRows items={items} /> : children}
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
// in-modal variants E/F/G — tuned for inside ActionModal only
// ---------------------------------------------------------------------------

// variant E — modal body row: icon + Body/S at the modal's own body type step,
// so the note reads as part of the description stack, not as a foreign block
const ModalBodyNote = ({
    priority = 'info',
    title,
    children,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
}) => {
    const { icon, accentText } = PRIORITY_META[priority]
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className="flex w-full items-start gap-2 text-start"
        >
            <Icon name={icon} size={16} className={twMerge('mt-0.5 shrink-0', accentText)} />
            <span
                className={twMerge(
                    'min-w-0 flex-1 text-body-s break-words',
                    priority === 'error' ? 'text-foreground-error' : 'text-foreground-primary'
                )}
            >
                {title && <span className="font-semibold">{title} </span>}
                {children}
            </span>
        </div>
    )
}

// variant F — footnote under the CTA: Body/XS centered, dimmed; the note is
// the least important thing in the modal and finally looks like it
const ModalFootnote = ({ priority = 'info', children }: { priority?: Priority; children?: React.ReactNode }) => (
    <p
        role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
        className={twMerge(
            'w-full text-center text-body-xs break-words',
            priority === 'error' ? 'text-foreground-error' : 'text-foreground-secondary'
        )}
    >
        {children}
    </p>
)

// variant G — tinted chip: badge-weight, keeps a hint of the tinted background
// but at Label/M chip scale, so the tone survives without the slab
const ModalChip = ({
    priority = 'info',
    title,
    children,
}: {
    priority?: Priority
    title?: string
    children?: React.ReactNode
}) => {
    const { icon, bg } = PRIORITY_META[priority]
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge(
                'flex w-full items-start gap-1.5 rounded-sm px-2 py-1 text-start text-foreground-over-color-secondary',
                bg
            )}
        >
            <Icon name={icon} size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 text-body-xs break-words">
                {title && <span className="font-semibold">{title} </span>}
                {children}
            </span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// faithful ActionModal panel replica (static — real ActionModal is an overlay)
// ---------------------------------------------------------------------------

/** copies ActionModal's panel exactly: white bg, border-default, rounded (4px),
 *  p-6 gap-6 centered stack, 48px IconBubble, Heading/XS title, full-width
 *  purple cta. Only `visible`/overlay plumbing is dropped. */
const ModalPanelReplica = ({
    icon = 'info',
    iconBubbleClassName = 'bg-action-primary',
    title,
    cta,
    children,
}: {
    icon?: IconName
    iconBubbleClassName?: string
    title: React.ReactNode
    cta?: string
    children: React.ReactNode
}) => (
    <div className="w-full max-w-sm rounded border border-border-default bg-background-default">
        <div className="flex flex-col items-center gap-6 p-6 text-center">
            <div className="flex w-full flex-col items-center gap-4">
                <IconBubble
                    size="m"
                    icon={<Icon name={icon} fill="currentColor" size={24} className="text-black" />}
                    className={iconBubbleClassName}
                />
                <h3 className="text-heading-xs text-foreground-primary">{title}</h3>
            </div>
            {children}
            {cta && (
                <Button onClick={noop} className="w-full justify-center">
                    {cta}
                </Button>
            )}
        </div>
    </div>
)

/** side-by-side pair for the in-modal variants: the same modal frame (backup
 *  lose-phone content) once with the current Notification, once with the
 *  proposed variant — info + error priorities and a long-copy case each.
 *  `footnote` renders the variant's notes below the CTA instead of above it. */
const InModalComparison = ({
    render,
    footnote = false,
}: {
    render: (priority: Priority, title: string, copy: string) => React.ReactNode
    footnote?: boolean
}) => {
    const variantNotes = (
        <div className={twMerge('flex w-full flex-col items-start', footnote ? 'gap-1' : 'gap-2')}>
            {render(
                'info',
                'Backup is enabled',
                'Sign into your new phone with your Apple ID. Your wallet restores automatically.'
            )}
            {render('error', 'No backup', "Your funds are permanently lost, we can't recover your wallet.")}
            {render('error', 'Transfer failed.', LONG_COPY)}
        </div>
    )
    return (
        <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
                <p className="text-body-xs text-foreground-secondary">current</p>
                <ModalPanelReplica title="What if I lose my phone?" cta="Got it">
                    <div className="space-y-3 w-full">
                        <Notification priority="info" title="Backup is enabled">
                            Sign into your new phone with your Apple ID. Your wallet restores automatically.
                        </Notification>
                        <Notification priority="error" title="No backup">
                            Your funds are permanently lost, we can&apos;t recover your wallet.
                        </Notification>
                        <Notification priority="error" title="Transfer failed.">
                            {LONG_COPY}
                        </Notification>
                    </div>
                </ModalPanelReplica>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-body-xs text-foreground-secondary">proposal</p>
                <ModalPanelReplica title="What if I lose my phone?" cta={footnote ? undefined : 'Got it'}>
                    {footnote ? (
                        <div className="flex w-full flex-col gap-3">
                            <Button onClick={noop} className="w-full justify-center">
                                Got it
                            </Button>
                            {variantNotes}
                        </div>
                    ) : (
                        variantNotes
                    )}
                </ModalPanelReplica>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// full usage catalog — every production render of Notification
// ---------------------------------------------------------------------------

type Usage = {
    /** file — context */
    label: string
    /** copy is representative (real copy only known at runtime) */
    rep?: boolean
    priority: Priority
    title?: string
    body?: React.ReactNode
    items?: React.ReactNode[]
    /** self-designed content, no priority icon (toast hideIcon / custom content) */
    hideIcon?: boolean
}

type UsageGroup = {
    name: string
    /** minimal context the notes render in */
    ctx: 'page' | 'form' | 'modal' | 'toast'
    note?: string
    usages: Usage[]
}

const REP_ERROR = 'Something went wrong. Please try again.'
const b = (s: string) => <b key={s}>{s}</b>

// ponytail: catalog is hand-transcribed from grep + i18n on 2026-09-02 — if a
// call site is added/removed in prod, this page drifts until someone re-greps
const USAGE_GROUPS: UsageGroup[] = [
    {
        name: 'flow and form errors — under an input or CTA (48 sites)',
        ctx: 'form',
        note: 'The biggest population: priority="error" under an amount input, form, or CTA. Most bodies are runtime API/validation messages.',
        usages: [
            {
                label: 'SendInputView:114 — insufficient balance',
                priority: 'error',
                body: 'Not enough balance to fulfill this payment with Peanut',
            },
            { label: 'SendInputView:116 — flow error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'SemanticRequestInputView:201 — insufficient balance',
                priority: 'error',
                body: 'Not enough balance to fulfill this payment with Peanut',
            },
            { label: 'SemanticRequestInputView:203 — flow error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'ContributePotInputView:117 — insufficient balance',
                priority: 'error',
                body: 'Not enough balance to fulfill this request with Peanut',
            },
            { label: 'ContributePotInputView:119 — flow error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'SemanticRequestConfirmView:290 — confirm error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'InputAmountStep:137 — add-money amount error',
                rep: true,
                priority: 'error',
                body: 'Amount exceeds your remaining monthly limit.',
            },
            { label: 'add-money/[country]/bank:540 — onramp error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'withdraw/page:470 — withdraw error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'withdraw/[country]/bank:562 — submit error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'withdraw/[country]/bank:564 — balance error',
                rep: true,
                priority: 'error',
                body: 'Not enough balance. Add funds to continue.',
            },
            {
                label: 'withdraw/manteca:806 — balance error',
                rep: true,
                priority: 'error',
                body: 'Not enough balance. Add funds to continue.',
            },
            { label: 'withdraw/manteca:917 — sumsub/flow error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'withdraw/manteca:984 — sumsub/flow error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'Initial.withdraw.view:246 — validation error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'PixKeySend.view:90 — pix key error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'Confirm.withdraw.view:242 — not enough balance',
                priority: 'error',
                body: 'Not enough balance. Add funds to continue.',
            },
            {
                label: 'Confirm.withdraw.view:245 — below minimum',
                rep: true,
                priority: 'error',
                body: 'Minimum withdrawal is $5.00.',
            },
            { label: 'Confirm.withdraw.view:247 — submit error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'qr-pay:1654 — balance error',
                rep: true,
                priority: 'error',
                body: 'Not enough balance. Add funds to continue.',
            },
            { label: 'qr-pay:1733 — payment error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'qr/[code]:224 — qr claim error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'DynamicBankAccountForm:678 — submission error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'DynamicBankAccountForm:680 — validation error',
                rep: true,
                priority: 'error',
                body: 'This IBAN does not look valid.',
            },
            {
                label: 'SetupPasskey:241 — username taken',
                priority: 'error',
                body: 'This username is already registered — possibly from an earlier attempt on this device. If that was you, your passkey is ready: just log in.',
            },
            { label: 'SetupPasskey:254 — inline error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'InstallPWA:214 — install cancelled',
                priority: 'error',
                body: 'Installation cancelled. You can try adding to Home Screen again.',
            },
            { label: 'ProfileEdit.view:246 — save error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'JoinWaitlistPage:411 — join error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'AddCardEntryScreen:61 — apply error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'CardRejectionScreen:219 — waitlist join error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'card-recovery:116 — recovery error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'recover-funds:406 — recovery error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'recover-wallet:188 — fatal error',
                rep: true,
                priority: 'error',
                body: 'This recovery link is invalid or expired.',
            },
            {
                label: 'recover-wallet:239 — no balance',
                priority: 'error',
                body: 'This wallet has no recoverable balance.',
            },
            { label: 'recover-wallet:261 — signing error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'AdditionalVerificationView:93 — hosted KYC start error',
                rep: true,
                priority: 'error',
                body: REP_ERROR,
            },
            { label: 'CancelDepositActions:114 — cancel error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'MantecaFlowManager:150 — sumsub error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'MantecaReviewStep:148 — review error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'MantecaDetailsStep:68 — details error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'Confirm.bank-claim.view:135 — claim error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'Claim/Initial.view:1004 — claim error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'Claim/Onchain/Confirm.view:256 — claim error', rep: true, priority: 'error', body: REP_ERROR },
            {
                label: 'Claim/Onchain/Success.view:198 — claim failure',
                rep: true,
                priority: 'error',
                body: 'This link has already been claimed.',
            },
            { label: 'Initial.direct.request.view:305 — request error', rep: true, priority: 'error', body: REP_ERROR },
            { label: 'Initial.link.send.view:297 — create-link error', rep: true, priority: 'error', body: REP_ERROR },
        ],
    },
    {
        name: 'page-wrapper load errors (3 sites)',
        ctx: 'page',
        usages: [
            {
                label: 'DirectSendPageWrapper:68 — user not found',
                priority: 'error',
                body: 'user @satoshi not found or has no peanut wallet',
            },
            { label: 'SemanticRequestPageWrapper:104 — invalid url', priority: 'error', body: 'invalid payment url' },
            { label: 'ContributePotPageWrapper:75 — request not found', priority: 'error', body: 'request not found' },
        ],
    },
    {
        name: 'titled and info/attention banners on pages (30 sites)',
        ctx: 'page',
        usages: [
            {
                label: 'add-money/bank:510 — amount must match',
                priority: 'attention',
                body: 'Amount must match what you send from your bank!',
            },
            {
                label: 'add-money/bank:515 — EUR accounts only',
                priority: 'info',
                title: 'EUR accounts only',
                body: 'Only EUR accounts with IBAN work for onramps. Your local currency account may not work.',
            },
            {
                label: 'profile/backup:64 — no backup warning',
                priority: 'attention',
                title: 'No backup = No recovery',
                body: 'If you lose your phone without backup enabled, your money is gone forever.',
            },
            {
                label: 'profile/backup:69 — third-party manager note',
                priority: 'info',
                body: "Using 1Password, Samsung Pass, or another password manager? Your passkey may be saved there instead. Check that manager's own backup.",
            },
            {
                label: 'withdraw/[country]/bank:471 — EUR to your bank',
                priority: 'info',
                title: 'We send EUR to your bank',
                body: 'Withdrawals are sent in EUR. Your bank may charge conversion fees or reject the transaction if EUR deposits are not supported.',
            },
            {
                label: 'withdraw/[country]/bank:558 — transfer processing',
                rep: true,
                priority: 'info',
                title: 'Transfer processing',
                body: 'Your transfer was submitted and is on its way to your bank.',
            },
            {
                label: 'LimitsPageView:85 — page description',
                priority: 'info',
                body: 'Payment limits control how much you can send and receive. Limits vary by region and reset monthly or yearly.',
            },
            {
                label: 'Create.request.link.view:397 — helper hint',
                priority: 'helper',
                body: 'Leave empty to let payers choose amounts.',
            },
            {
                label: 'Confirm.withdraw.view:206 — high fee warning',
                priority: 'info',
                body: 'Note: the network fee is a large share of this withdrawal. Withdrawing a larger amount or choosing a cheaper network reduces it.',
            },
            {
                label: 'YourCardScreen:101 — balance due',
                priority: 'attention',
                title: '$4.20 will be debited based on your next deposit',
                body: "A recent card payment ended up higher than the amount held at checkout. This happens with tips or updated totals. We'll cover the difference automatically.",
            },
            {
                label: 'YourCardScreen:109 — pay as credit',
                priority: 'info',
                title: 'Pay as credit',
                body: 'When a terminal asks debit or credit, choose credit — your Peanut card runs on the credit network.',
            },
            {
                label: 'KycFailedContent:16 — terminal rejection',
                priority: 'error',
                body: 'Your verification cannot be retried. Please contact support for help.',
            },
            {
                label: 'RejectLabelsList:26 — fallback description',
                priority: 'info',
                body: 'We need a bit more from you to confirm your ID. Please provide the requested details to continue.',
            },
            {
                label: 'RejectLabelsList:32 — reject reason',
                rep: true,
                priority: 'info',
                title: 'Your selfie was too blurry',
                body: 'Retake it in good lighting with your whole face visible.',
            },
            {
                label: 'KycActionRequired:42 — action required',
                priority: 'info',
                body: 'We need a bit more to verify your identity. Tap below to continue.',
            },
            {
                label: 'KycPrepChecklist:54 — single session',
                priority: 'attention',
                title: 'Finish it in one go',
                body: (
                    <span className="text-body-xs">
                        Our partner does not save your progress. If you close the page or step away to look for a
                        document, you start again from the first step.
                    </span>
                ),
            },
            {
                label: 'CryptoDeposit.view:123 — address error',
                priority: 'attention',
                title: "We couldn't prepare your deposit address",
                body: 'Nothing was sent. Please try again — if this keeps happening, contact support.',
            },
            {
                label: 'CryptoDeposit.view:243 — network warning',
                priority: 'attention',
                title: 'Send to supported networks only',
                body: 'Wrong token or network may cause permanent loss.',
            },
            {
                label: 'Initial.link.send.view:276 — min fiat claim',
                priority: 'attention',
                body: "Amounts under $5 can't be claimed to a bank, Pix or Mercado Pago — the recipient can still claim to a Peanut account or crypto wallet.",
            },
            {
                label: 'MantecaDepositShareDetails:124 — own account only',
                priority: 'attention',
                title: 'Send only from your own account',
                body: 'Deposits from third-party accounts are not supported and funds may be lost.',
            },
            {
                label: 'AddMoneyBankDetails:289 — send exact amount',
                priority: 'attention',
                body: 'Send exactly this amount!',
            },
            {
                label: 'AddMoneyBankDetails:310 — paste reference',
                priority: 'attention',
                body: "Paste in your bank's reference field",
            },
            {
                label: 'AddMoneyBankDetails:440 — double check list',
                priority: 'attention',
                title: 'Double check in your bank before sending:',
                body: (
                    <ul className="list-inside list-disc text-start">
                        <li>Amount: €50.00 (exact)</li>
                        <li>Reference: PNT-8F3K2 (included)</li>
                    </ul>
                ),
            },
            {
                label: 'RhinoDeposit.view:175 — supported tokens chips',
                priority: 'attention',
                body: (
                    <span className="flex flex-wrap items-center gap-2">
                        Supported tokens:
                        <span className="rounded-round border border-border-default px-2 text-body-xs">USDC</span>
                        <span className="rounded-round border border-border-default px-2 text-body-xs">USDT</span>
                    </span>
                ),
            },
            {
                label: 'RateUnavailable:24 — rates down',
                priority: 'error',
                body: 'Exchange rates are temporarily unavailable. Please try again in a moment.',
            },
            {
                label: 'Global/Banner:43 — offline (top of shell)',
                priority: 'error',
                body: "No internet connection — some features won't work until you reconnect",
            },
            {
                label: 'Global/Banner:57 — maintenance (top of shell)',
                priority: 'error',
                body: "Maintenance mode, some functionalities won't be available. Funds safe",
            },
            {
                label: 'CardUsdAbroadNotice:50 — tx detail nudge',
                priority: 'info',
                title: 'Pay in local currency next time',
                body: "You were charged in US dollars. When a terminal offers to bill in dollars, choose the local currency instead — Peanut's exchange rate is usually better.",
            },
            {
                label: 'LocalRailNudge:46 — tx detail nudge',
                rep: true,
                priority: 'info',
                title: 'Pay like a local next time',
                body: 'In Brazil, paying with Pix costs around 2% less than using your card.',
            },
            {
                label: 'CardAdjustmentNotice:35 — settlement adjusted',
                rep: true,
                priority: 'info',
                body: "The final amount was $1.20 higher than the initial hold. This is common with tips and updated totals. Don't recognize it? Contact the merchant.",
            },
        ],
    },
    {
        name: 'inside modals and drawers (14 sites)',
        ctx: 'modal',
        usages: [
            {
                label: 'profile/backup:89 — lose-phone modal',
                priority: 'success',
                title: 'Backup is enabled',
                body: 'Sign into your new phone with your Apple ID. Download Peanut. Your wallet restores automatically',
            },
            {
                label: 'profile/backup:92 — lose-phone modal',
                priority: 'error',
                title: 'No backup',
                body: "Your funds are permanently lost, we can't recover your wallet. This is how self-custody works.",
            },
            {
                label: 'profile/backup:112 — change-phone modal',
                priority: 'success',
                title: 'iPhone → iPhone',
                body: 'Just sign in. Everything transfers.',
            },
            {
                label: 'profile/backup:115 — change-phone modal',
                priority: 'success',
                title: 'Android → Android',
                body: 'Sign into Google. Your wallet follows.',
            },
            {
                label: 'profile/backup:118 — change-phone modal',
                priority: 'attention',
                title: 'iPhone ↔ Android',
                body: "Create new wallet on new device. Transfer your funds. Passkeys don't work cross-platform unless you are using a third party password manager such as 1Password.",
            },
            {
                label: 'WelcomeUnlockModal:126 — unlock checklist',
                priority: 'info',
                items: [
                    <p key="1">QR Payments in {b('Argentina and Brazil')}</p>,
                    <p key="2">{b('United States')} ACH and Wire transfers</p>,
                    <p key="3">{b('Europe')} SEPA transfers (+30 countries)</p>,
                    <p key="4">{b('Mexico')} SPEI transfers</p>,
                ],
            },
            {
                label: 'PasskeySetupHelpModal:89 — troubleshooting steps',
                rep: true,
                priority: 'info',
                items: [
                    'Sign in to a Google account on this device',
                    'Update Google Play Services',
                    'Enable screen lock (Settings > Security)',
                ],
            },
            {
                label: 'PasskeySetupHelpModal:92 — important note',
                priority: 'error',
                title: 'Important Note',
                body: 'Lower end Android devices may require recent security updates for passkeys to work properly.',
            },
            {
                label: 'UnlockRegionModal:78 — unlock items',
                rep: true,
                priority: 'info',
                items: ['Bank transfers in your country'],
            },
            {
                label: 'HowToDepositModal:39 — network warning',
                priority: 'attention',
                body: 'Sending to the wrong network or token will result in permanent loss.',
            },
            {
                label: 'SupportedNetworksModal:26 — network warning',
                priority: 'attention',
                body: 'Sending to the wrong network or token will result in permanent loss.',
            },
            {
                label: 'OnrampConfirmationModal:39 — next-step list (drawer)',
                priority: 'helper',
                body: (
                    <ul className="list-inside list-disc text-start">
                        <li>Bank details to send money to</li>
                        <li>A deposit reference code</li>
                    </ul>
                ),
            },
            {
                label: 'OnrampConfirmationModal:46 — you-must checklist (drawer)',
                priority: 'info',
                items: [
                    <span key="1">Send exactly {b('€50.00')} (the exact amount shown)</span>,
                    'Copy the one-time reference code exactly',
                    'Paste it in the description/reference field',
                ],
            },
            {
                label: 'OnrampConfirmationModal:60 — mismatch warning (drawer)',
                priority: 'error',
                title: "If the amount or reference don't match:",
                body: 'Your deposit will fail and it will take 2 to 10 days to return to your bank and might incur fees. The reference code is single use.',
            },
        ],
    },
    {
        name: 'special: rich body with actions (1 site)',
        ctx: 'page',
        usages: [
            {
                label: 'LimitsWarningCard:74 — limits warning + action',
                priority: 'attention',
                title: "You're close to your limit.",
                body: (
                    <div className="flex flex-col gap-2">
                        <ul className="list-inside list-disc text-start">
                            <li>You can add up to $150.00</li>
                            <li>You can add up to $500.00 per transaction</li>
                        </ul>
                        <div className="my-1 border-t" />
                        <span className="flex items-center gap-1">
                            <Icon name="plus-circle" size={16} />
                            <span className="font-semibold underline">Increase my limits</span>
                        </span>
                    </div>
                ),
            },
        ],
    },
    {
        name: 'toasts — via ToastStack (6 configurations)',
        ctx: 'toast',
        note: 'Every useToast caller renders through these. The two custom-content pills are the hideIcon/double-icon cases.',
        usages: [
            {
                label: 'toast.success — e.g. limits document submitted',
                priority: 'success',
                body: 'Document submitted! Your limits will be updated shortly.',
            },
            {
                label: 'toast.error — e.g. cancel link failed',
                priority: 'error',
                body: 'Failed to cancel link. Please try again.',
            },
            { label: 'toast.info — e.g. link copied', priority: 'info', body: 'Link copied' },
            {
                label: 'toast.warning — maps to attention',
                rep: true,
                priority: 'attention',
                body: 'Your session is about to expire.',
            },
            {
                label: 'RainCooldownContext:109 — persistent cooldown pill (custom content)',
                priority: 'info',
                hideIcon: true,
                body: (
                    <span className="flex items-center gap-2">
                        <Icon name="clock" size={16} className="shrink-0" />
                        Card locked for 4:32
                    </span>
                ),
            },
            {
                label: 'BadgeEarnToast:84 — badge celebration (custom content)',
                rep: true,
                priority: 'success',
                hideIcon: true,
                body: (
                    <span className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-round bg-background-badge-accent">
                            🏅
                        </span>
                        Badge unlocked: First Steps
                    </span>
                ),
            },
        ],
    },
]

const USAGE_TOTAL = USAGE_GROUPS.reduce((n, g) => n + g.usages.length, 0)

/** one usage rendered by a variant, wrapped in its minimal real context */
const UsageCell = ({
    usage,
    ctx,
    render,
}: {
    usage: Usage
    ctx: UsageGroup['ctx']
    render: (u: Usage) => React.ReactNode
}) => {
    const note = render(usage)
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-body-xs text-foreground-secondary">
                {usage.label}
                {usage.rep && <span className="text-foreground-error"> · representative copy</span>}
            </p>
            {ctx === 'form' && (
                <div className="flex flex-col gap-1.5">
                    <BaseInput variant="sm" readOnly placeholder="Amount" />
                    {note}
                </div>
            )}
            {ctx === 'modal' && (
                <div className="rounded border border-border-default bg-background-default p-3">{note}</div>
            )}
            {ctx === 'toast' && (
                <div className="flex justify-end rounded-sm bg-background-page p-3">
                    <div className="w-max max-w-full rounded-sm border border-border-default bg-background-default">
                        {note}
                    </div>
                </div>
            )}
            {ctx === 'page' && note}
        </div>
    )
}

const UsageShowcase = ({ render }: { render: (u: Usage) => React.ReactNode }) => (
    <div className="flex flex-col gap-6">
        {USAGE_GROUPS.map((group) => (
            <div key={group.name} className="flex flex-col gap-3">
                <DevSectionLabel>{group.name}</DevSectionLabel>
                {group.note && <p className="max-w-3xl text-body-xs text-foreground-secondary">{group.note}</p>}
                <div className="grid items-start gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.usages.map((u) => (
                        <UsageCell key={u.label} usage={u} ctx={group.ctx} render={render} />
                    ))}
                </div>
            </div>
        ))}
    </div>
)

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

            <section className="flex flex-col gap-3">
                <DevSectionLabel>current component inside real modals</DevSectionLabel>
                <p className="max-w-3xl text-body-s text-foreground-secondary">
                    Faithful static replicas of three production modals (real ActionModal panel styles, real copy), with
                    the current Notification exactly as production styles it. This is what ships today.
                </p>
                <div className="grid items-start gap-4 lg:grid-cols-3">
                    <ModalPanelReplica title="What if I lose my phone?">
                        {/* profile/backup lose-phone faq modal, verbatim */}
                        <div className="space-y-3 w-full">
                            <Notification priority="success" title="Backup is enabled">
                                Sign into your new phone with your Apple ID. Download Peanut. Your wallet restores
                                automatically
                            </Notification>
                            <Notification priority="error" title="No backup">
                                Your funds are permanently lost, we can&apos;t recover your wallet. This is how
                                self-custody works.
                            </Notification>
                        </div>
                    </ModalPanelReplica>
                    <ModalPanelReplica title="What if I change phone?">
                        {/* profile/backup change-phone faq modal, verbatim */}
                        <div className="space-y-3 w-full">
                            <ol className="list-decimal pl-6 text-left text-body-s text-foreground-primary">
                                <li>Verify backup is working (check step 3 above)</li>
                                <li>Know your Apple ID password</li>
                                <li>Keep old phone until new one works</li>
                            </ol>
                            <Notification priority="success" title="iPhone → iPhone">
                                Just sign in. Everything transfers.
                            </Notification>
                            <Notification priority="success" title="Android → Android">
                                Sign into Google. Your wallet follows.
                            </Notification>
                            <Notification priority="attention" title="iPhone ↔ Android">
                                Create new wallet on new device. Transfer your funds. Passkeys don&apos;t work
                                cross-platform unless you are using a third party password manager such as 1Password.
                            </Notification>
                        </div>
                    </ModalPanelReplica>
                    <ModalPanelReplica title="🎉 You're unlocked" icon="globe-lock" cta="Start sending money">
                        {/* WelcomeUnlockModal (via HomeModals), verbatim */}
                        <div className="flex w-full flex-col items-start gap-2">
                            <p>You can now:</p>
                            <Notification
                                priority="info"
                                className="w-full"
                                items={[
                                    <p key="qr">
                                        QR Payments in <b>Argentina and Brazil</b>
                                    </p>,
                                    <p key="us">
                                        <b>United States</b> ACH and Wire transfers
                                    </p>,
                                    <p key="eu">
                                        <b>Europe</b> SEPA transfers (+30 countries)
                                    </p>,
                                    <p key="mx">
                                        <b>Mexico</b> SPEI transfers
                                    </p>,
                                ]}
                            />
                        </div>
                    </ModalPanelReplica>
                </div>
            </section>

            <VariantSection
                label="E — modal body row"
                rationale="Icon + Body/S at the modal's own body type step, no box. The note joins the description stack instead of interrupting it — a step louder than C, for notes that carry real content (the backup modals)."
            >
                <InModalComparison
                    render={(p, title, copy) => (
                        <ModalBodyNote priority={p} title={title}>
                            {copy}
                        </ModalBodyNote>
                    )}
                />
            </VariantSection>

            <VariantSection
                label="F — footnote under the CTA"
                rationale="Body/XS centered below the button, dimmed (error stays red). For caveats that today get a full tint block despite being the least important thing in the modal."
            >
                <InModalComparison
                    footnote
                    render={(p, _title, copy) => <ModalFootnote priority={p}>{copy}</ModalFootnote>}
                />
            </VariantSection>

            <VariantSection
                label="G — tinted chip"
                rationale="Keeps a hint of the tinted background but at chip weight: Body/XS, 12px icon, 4px vertical padding. The tone survives without the slab — for modals where the color coding itself matters (backup success vs error)."
            >
                <InModalComparison
                    render={(p, title, copy) => (
                        <ModalChip priority={p} title={title}>
                            {copy}
                        </ModalChip>
                    )}
                />
            </VariantSection>

            <section className="flex flex-col gap-4">
                <DevSectionLabel>variant A — full usage showcase ({USAGE_TOTAL} usages)</DevSectionLabel>
                <p className="max-w-3xl text-body-s text-foreground-secondary">
                    Every production render of Notification (96 inline call sites, grep-verified 2026-09-02) plus the
                    toast surface as 6 configurations, rebuilt with the compact inline variant. Real i18n/hardcoded
                    copy; runtime-only messages carry representative copy and are marked.
                </p>
                <UsageShowcase
                    render={(u) => (
                        <CompactNotification
                            priority={u.priority}
                            title={u.title}
                            items={u.items}
                            hideIcon={u.hideIcon}
                        >
                            {u.body}
                        </CompactNotification>
                    )}
                />
            </section>

            <section className="flex flex-col gap-4">
                <DevSectionLabel>variant B — full usage showcase ({USAGE_TOTAL} usages)</DevSectionLabel>
                <p className="max-w-3xl text-body-s text-foreground-secondary">
                    The same {USAGE_TOTAL} usages rebuilt with the slim accent banner. As a toast the accent row sits on
                    a white bordered pill (a floating element needs a surface; inline it stays transparent).
                </p>
                <UsageShowcase
                    render={(u) => (
                        <AccentNotification priority={u.priority} title={u.title} items={u.items} hideIcon={u.hideIcon}>
                            {u.body}
                        </AccentNotification>
                    )}
                />
            </section>

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
