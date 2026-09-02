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
    // no own type step: inherits the variant's body size (A/B both set Body/S),
    // so a checklist reads at the same size as every other render of the variant
    <div className="flex flex-col gap-1">
        {items.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
                <Icon name="check" size={16} className="mt-0.5 shrink-0" />
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
    icon,
    iconBubbleClassName = 'bg-action-primary',
    title,
    description,
    cta,
    ctaIcon,
    children,
}: {
    /** ActionModal renders no bubble when no icon is passed */
    icon?: IconName
    iconBubbleClassName?: string
    title: React.ReactNode
    /** Body/S secondary line under the title, like ActionModal's description */
    description?: React.ReactNode
    cta?: string
    ctaIcon?: IconName
    children: React.ReactNode
}) => (
    <div className="w-full max-w-[375px] rounded border border-border-default bg-background-default">
        <div className="flex flex-col items-center gap-6 p-6 text-center">
            <div className="flex w-full flex-col items-center gap-4">
                {icon && (
                    <IconBubble
                        size="m"
                        icon={<Icon name={icon} fill="currentColor" size={24} className="text-black" />}
                        className={iconBubbleClassName}
                    />
                )}
                <div className="flex w-full flex-col gap-1">
                    <h3 className="text-heading-xs text-foreground-primary">{title}</h3>
                    {description && <div className="text-body-s text-foreground-secondary">{description}</div>}
                </div>
            </div>
            {children}
            {cta && (
                <Button onClick={noop} icon={ctaIcon} className="w-full justify-center">
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
                <ModalPanelReplica icon="info" title="What if I lose my phone?" cta="Got it">
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
                <ModalPanelReplica icon="info" title="What if I lose my phone?" cta={footnote ? undefined : 'Got it'}>
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
    /** overrides the group context for this one usage (e.g. a toast sample in the flow group) */
    ctx?: 'page' | 'form' | 'modal' | 'toast'
}

type UsageGroup = {
    name: string
    /** minimal context the notes render in */
    ctx: 'page' | 'form' | 'modal' | 'toast'
    note?: string
    usages: Usage[]
}

const b = (s: string) => <b key={s}>{s}</b>

// the 14 in-modal/in-drawer usages, named so the full host replicas below can
// render the exact same usage objects the catalog counts
const MODAL_USAGES = {
    losePhoneEnabled: {
        label: 'profile/backup:89 — lose-phone modal',
        priority: 'success',
        title: 'Backup is enabled',
        body: 'Sign into your new phone with your Apple ID. Download Peanut. Your wallet restores automatically',
    },
    losePhoneNoBackup: {
        label: 'profile/backup:92 — lose-phone modal',
        priority: 'error',
        title: 'No backup',
        body: "Your funds are permanently lost, we can't recover your wallet. This is how self-custody works.",
    },
    changeIphone: {
        label: 'profile/backup:112 — change-phone modal',
        priority: 'success',
        title: 'iPhone → iPhone',
        body: 'Just sign in. Everything transfers.',
    },
    changeAndroid: {
        label: 'profile/backup:115 — change-phone modal',
        priority: 'success',
        title: 'Android → Android',
        body: 'Sign into Google. Your wallet follows.',
    },
    changeCross: {
        label: 'profile/backup:118 — change-phone modal',
        priority: 'attention',
        title: 'iPhone ↔ Android',
        body: "Create new wallet on new device. Transfer your funds. Passkeys don't work cross-platform unless you are using a third party password manager such as 1Password.",
    },
    welcomeUnlock: {
        label: 'WelcomeUnlockModal:126 — unlock checklist',
        priority: 'info',
        items: [
            <p key="1">QR Payments in {b('Argentina and Brazil')}</p>,
            <p key="2">{b('United States')} ACH and Wire transfers</p>,
            <p key="3">{b('Europe')} SEPA transfers (+30 countries)</p>,
            <p key="4">{b('Mexico')} SPEI transfers</p>,
        ],
    },
    passkeySteps: {
        label: 'PasskeySetupHelpModal:89 — troubleshooting steps',
        rep: true,
        priority: 'info',
        items: [
            'Sign in to a Google account on this device',
            'Update Google Play Services',
            'Enable screen lock (Settings > Security)',
        ],
    },
    passkeyNote: {
        label: 'PasskeySetupHelpModal:92 — important note',
        priority: 'error',
        title: 'Important Note',
        body: 'Lower end Android devices may require recent security updates for passkeys to work properly.',
    },
    unlockRegion: {
        label: 'UnlockRegionModal:78 — unlock items',
        priority: 'info',
        items: [
            <p key="sepa">{b('Europe')} SEPA transfers (+30 countries)</p>,
            <p key="uk">{b('UK')} Faster payment transfers</p>,
            <p key="ach">{b('United States')} ACH and Wire transfers</p>,
            <p key="mx">{b('Mexico')} SPEI transfers</p>,
            <p key="qr">QR Payments in {b('Argentina and Brazil')}</p>,
        ],
    },
    howToDeposit: {
        label: 'HowToDepositModal:39 — network warning',
        priority: 'attention',
        body: 'Sending to the wrong network or token will result in permanent loss.',
    },
    supportedNetworks: {
        label: 'SupportedNetworksModal:26 — network warning',
        priority: 'attention',
        body: 'Sending to the wrong network or token will result in permanent loss.',
    },
    onrampNextStep: {
        label: 'OnrampConfirmationModal:39 — next-step list (drawer)',
        priority: 'helper',
        // bullet-lists hide the icon (prod fix 9fc4368d5)
        hideIcon: true,
        body: (
            <ul className="list-inside list-disc text-start">
                <li>Bank details to send money to</li>
                <li>A deposit reference code</li>
            </ul>
        ),
    },
    onrampChecklist: {
        label: 'OnrampConfirmationModal:46 — you-must checklist (drawer)',
        priority: 'info',
        items: [
            <span key="1">Send exactly {b('€50.00')} (the exact amount shown)</span>,
            'Copy the one-time reference code exactly',
            'Paste it in the description/reference field',
        ],
    },
    onrampMismatch: {
        label: 'OnrampConfirmationModal:60 — mismatch warning (drawer)',
        priority: 'error',
        title: "If the amount or reference don't match:",
        body: 'Your deposit will fail and it will take 2 to 10 days to return to your bank and might incur fees. The reference code is single use.',
    },
} satisfies Record<string, Usage>

// ponytail: catalog is hand-transcribed from grep + i18n on 2026-09-02 — if a
// call site is added/removed in prod, this page drifts until someone re-greps
const USAGE_GROUPS: UsageGroup[] = [
    {
        name: 'flow and form errors — 48 call sites, 3 representative samples',
        ctx: 'form',
        note: 'The biggest population: priority="error" under an amount input, form, or CTA — all 48 sites share this exact shape, so three samples stand in for the list (single-line, wrapping, error toast). Nothing is lost: the sites are enumerated by grepping <Notification priority="error">.',
        usages: [
            {
                label: 'single-line error — e.g. SendInputView:114 (real copy; 46 similar sites)',
                priority: 'error',
                body: 'Not enough balance to fulfill this payment with Peanut',
            },
            {
                label: 'wrapping multi-line error — e.g. SetupPasskey:241 (real copy)',
                priority: 'error',
                body: 'This username is already registered — possibly from an earlier attempt on this device. If that was you, your passkey is ready: just log in.',
            },
            {
                label: 'error toast — e.g. cancel link failed (real copy)',
                ctx: 'toast',
                priority: 'error',
                body: 'Failed to cancel link. Please try again.',
            },
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
                // bullet-lists hide the icon (prod fix 9fc4368d5)
                hideIcon: true,
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
        name: 'special: rich body with actions (1 site)',
        ctx: 'page',
        usages: [
            {
                label: 'LimitsWarningCard:74 — limits warning + action',
                priority: 'attention',
                // bullet-lists hide the icon (prod fix 9fc4368d5)
                hideIcon: true,
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
]

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
    const effCtx = usage.ctx ?? ctx
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-body-xs text-foreground-secondary">
                {usage.label}
                {usage.rep && <span className="text-foreground-error"> · representative copy</span>}
            </p>
            {effCtx === 'form' && (
                <div className="flex flex-col gap-1.5">
                    <BaseInput variant="sm" readOnly placeholder="Amount" />
                    {note}
                </div>
            )}
            {effCtx === 'modal' && (
                <div className="rounded border border-border-default bg-background-default p-3">{note}</div>
            )}
            {effCtx === 'toast' && (
                <div className="flex justify-end rounded-sm bg-background-page p-3">
                    <div className="w-max max-w-full rounded-sm border border-border-default bg-background-default">
                        {note}
                    </div>
                </div>
            )}
            {effCtx === 'page' && note}
        </div>
    )
}

type RenderFn = (u: Usage) => React.ReactNode

/**
 * the 14 in-modal/in-drawer call sites as their 8 complete host surfaces,
 * faithful to the production layouts (static replicas at ~375px width).
 * duplicates grouped: lose-phone hosts 2 sites, change-phone 3, onramp drawer 3.
 */
const MODAL_HOSTS: { sites: string; build: (render: RenderFn) => React.ReactNode }[] = [
    {
        sites: 'profile/backup lose-phone FAQ modal — sites backup:89 + backup:92',
        build: (render) => (
            <>
                <ModalPanelReplica icon="info" title="What if I lose my phone?">
                    <div className="space-y-3 w-full">
                        {render(MODAL_USAGES.losePhoneEnabled)}
                        {render(MODAL_USAGES.losePhoneNoBackup)}
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'profile/backup change-phone FAQ modal — sites backup:112 + :115 + :118',
        build: (render) => (
            <>
                <ModalPanelReplica icon="info" title="What if I change phone?">
                    <div className="space-y-3 w-full">
                        <ol className="list-decimal pl-6 text-left text-body-s text-foreground-primary">
                            <li>Verify backup is working (check step 3 above)</li>
                            <li>Know your Apple ID password</li>
                            <li>Keep old phone until new one works</li>
                        </ol>
                        {render(MODAL_USAGES.changeIphone)}
                        {render(MODAL_USAGES.changeAndroid)}
                        {render(MODAL_USAGES.changeCross)}
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'WelcomeUnlockModal — site :126',
        build: (render) => (
            <>
                <ModalPanelReplica icon="globe-lock" title="🎉 You're unlocked" cta="Start sending money">
                    <div className="flex w-full flex-col items-start gap-2">
                        <p>You can now:</p>
                        <div className="w-full">{render(MODAL_USAGES.welcomeUnlock)}</div>
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'PasskeySetupHelpModal — sites :89 + :92',
        build: (render) => (
            <>
                <ModalPanelReplica icon="alert" iconBubbleClassName="bg-action-secondary" title="Passkeys Not Enabled">
                    <div className="flex w-full flex-col gap-4 text-left">
                        <h2 className="mr-auto text-body-s text-foreground-secondary">
                            Passkeys are not enabled on your device. Check your device settings to enable them
                        </h2>
                        <h3 className="mr-auto font-bold">Try these fixes:</h3>
                        {render(MODAL_USAGES.passkeySteps)}
                        {render(MODAL_USAGES.passkeyNote)}
                        <div className="rounded-sm border border-border-disabled bg-background-disabled/5 p-3 text-body-xs text-foreground-secondary">
                            <p className="mb-1 font-bold">Still having issues?</p>
                            <p>
                                Contact our support team at{' '}
                                <span className="text-blue-500 underline">peanut.me/support</span>
                            </p>
                        </div>
                        <Button icon="retry" onClick={noop} className="w-full justify-center">
                            Retry
                        </Button>
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'UnlockRegionModal (europe) — site :78',
        build: (render) => (
            <>
                <ModalPanelReplica
                    icon="shield"
                    title="Unlock Europe"
                    description={
                        <p className="text-black">
                            To send and receive money here, confirm your ID with a <b>government-issued document.</b>
                        </p>
                    }
                    cta="Unlock now"
                    ctaIcon="check-circle"
                >
                    <div className="flex w-full flex-col items-start gap-2">
                        <h2 className="text-label-m">What you&apos;ll unlock:</h2>
                        <div className="w-full">{render(MODAL_USAGES.unlockRegion)}</div>
                        <div className="flex items-center gap-2">
                            <Icon name="info" size={16} className="text-foreground-secondary" />
                            <p className="text-body-xs text-foreground-secondary">
                                Peanut doesn&apos;t store any of your documents.
                            </p>
                        </div>
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'HowToDepositModal — site :39',
        build: (render) => (
            <>
                <ModalPanelReplica title="How to Deposit">
                    <div className="flex w-full flex-col gap-4 text-left">
                        <div className="flex flex-col overflow-hidden rounded-sm border border-border-default bg-background-default">
                            {[
                                'Copy your deposit address above',
                                'Open your wallet or exchange and start a withdrawal',
                                'Paste the address and select one of the supported networks',
                                'Confirm and send — funds arrive within a few minutes',
                            ].map((text, i) => (
                                <div key={i} className={`px-4 py-3 ${i !== 3 ? 'border-b border-border-default' : ''}`}>
                                    <p className="text-label-l">Step {i + 1}</p>
                                    <p className="text-body-s text-foreground-secondary">{text}</p>
                                </div>
                            ))}
                        </div>
                        {render(MODAL_USAGES.howToDeposit)}
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'SupportedNetworksModal — site :26',
        build: (render) => (
            <>
                <ModalPanelReplica
                    title="Supported Networks"
                    description="One address for all listed below EVM networks - send from any of them and your funds will be routed correctly."
                >
                    <div className="flex w-full flex-col gap-4 text-left">
                        <div className="flex flex-wrap gap-2">
                            {['Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon'].map((c) => (
                                <span
                                    key={c}
                                    className="rounded-round border border-border-default px-2 py-0.5 text-body-xs"
                                >
                                    {c}
                                </span>
                            ))}
                        </div>
                        {render(MODAL_USAGES.supportedNetworks)}
                    </div>
                </ModalPanelReplica>
            </>
        ),
    },
    {
        sites: 'OnrampConfirmationModal (drawer) — sites :39 + :46 + :60',
        build: (render) => (
            <>
                <div className="w-full max-w-[375px] rounded-t-lg border border-b-0 border-border-default bg-background-default">
                    {/* drawer handle */}
                    <div className="mx-auto mt-2 h-1 w-10 rounded-round bg-border-subtle" />
                    <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                        <IconBubble
                            size="m"
                            icon={<Icon name="alert" fill="currentColor" size={24} className="text-black" />}
                            className="bg-action-secondary"
                        />
                        <h3 className="text-heading-xs text-foreground-primary">IMPORTANT!</h3>
                        <div className="flex w-full flex-col gap-4 text-left">
                            <h2 className="mr-auto font-bold">In the next step you&apos;ll see:</h2>
                            {render(MODAL_USAGES.onrampNextStep)}
                            <h2 className="mr-auto font-bold">You must:</h2>
                            {render(MODAL_USAGES.onrampChecklist)}
                            {render(MODAL_USAGES.onrampMismatch)}
                        </div>
                        {/* static stand-in for SlideToConfirm */}
                        <div className="flex h-11 w-full items-center justify-center rounded-round border border-border-default bg-background-page text-body-s text-foreground-secondary">
                            Slide to Proceed →
                        </div>
                    </div>
                </div>
            </>
        ),
    },
]

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

const PageSection = ({
    id,
    title,
    blurb,
    children,
}: {
    id: string
    title: string
    blurb: string
    children: React.ReactNode
}) => (
    <section id={id} className="flex scroll-mt-14 flex-col gap-4 border-t border-border-subtle pt-6">
        <h2 className="text-heading-xs">{title}</h2>
        <p className="max-w-3xl text-body-s text-foreground-secondary">{blurb}</p>
        {children}
    </section>
)

const Fold = ({ summary, children }: { summary: string; children: React.ReactNode }) => (
    <details className="rounded-sm border border-border-subtle p-3">
        <summary className="cursor-pointer text-body-s font-semibold">{summary}</summary>
        <div className="flex flex-col gap-3 pt-3">{children}</div>
    </details>
)

const NAV = [
    ['problem', 'problem'],
    ['variant-a', 'A — compact inline'],
    ['variant-b', 'B — accent banner'],
    ['modals', 'modals side by side'],
    ['toasts', 'toasts'],
    ['secondary', 'other ideas'],
] as const

const renderCurrent: RenderFn = (u) => (
    <Notification priority={u.priority} title={u.title} items={u.items} hideIcon={u.hideIcon}>
        {u.body}
    </Notification>
)
const renderA: RenderFn = (u) => (
    <CompactNotification priority={u.priority} title={u.title} items={u.items} hideIcon={u.hideIcon}>
        {u.body}
    </CompactNotification>
)
const renderB: RenderFn = (u) => (
    <AccentNotification priority={u.priority} title={u.title} items={u.items} hideIcon={u.hideIcon}>
        {u.body}
    </AccentNotification>
)

const SHORT_COPY: Record<Priority, string> = {
    info: 'A short info message',
    success: 'Success, details changed',
    attention: 'Pay attention, this is important',
    error: 'Ups, something went wrong',
    helper: 'Leave empty to let payers choose amounts',
}

export default function NotificationProposalsPage() {
    const [toasts, setToasts] = useState<Priority[]>(['info', 'success', 'attention', 'error'])

    return (
        <DevPageShell
            title="Notification redesign proposals"
            description="Finalists A and B rendered in the actual app places, modal hosts compared side by side with the current component, and the toast redesign. Existing tokens only."
        >
            <nav className="sticky top-0 z-10 -my-2 flex gap-2 overflow-x-auto border-b border-border-subtle bg-background-default py-2">
                {NAV.map(([id, label]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="rounded-round border border-border-subtle px-3 py-1 text-body-xs whitespace-nowrap text-foreground-secondary hover:text-foreground-primary"
                    >
                        {label}
                    </a>
                ))}
            </nav>

            <PageSection
                id="problem"
                title="The problem today"
                blurb="Current component: Body/M 16px text, 20px icon, 12px padding, full tint block — too big, breaks layouts, worst inside modals."
            >
                <div className="flex max-w-xl flex-col gap-2">
                    <Notification priority="error">Ups, something went wrong</Notification>
                    <Notification priority="info" title="EUR accounts only">
                        {LONG_COPY}
                    </Notification>
                </div>
            </PageSection>

            <PageSection
                id="variant-a"
                title="Finalist A — compact inline"
                blurb="Same anatomy one type step down: Body/S 14px, 16px icon, half the padding. States first, then every real app place rendered with A (errors sampled — all 48 share one shape)."
            >
                <div className="flex max-w-xl flex-col gap-2">
                    {PRIORITIES.map((p) => (
                        <CompactNotification key={p} priority={p}>
                            {SHORT_COPY[p]}
                        </CompactNotification>
                    ))}
                    <CompactNotification priority="error" title="Transfer failed." onDismiss={noop}>
                        {LONG_COPY}
                    </CompactNotification>
                </div>
                <UsageShowcase render={renderA} />
            </PageSection>

            <PageSection
                id="variant-b"
                title="Finalist B — slim accent banner"
                blurb="No tint block: transparent background, 2px left rule + tinted 16px icon carry the priority. Same states and real app places, rendered with B."
            >
                <div className="flex max-w-xl flex-col gap-2">
                    {PRIORITIES.map((p) => (
                        <AccentNotification key={p} priority={p}>
                            {SHORT_COPY[p]}
                        </AccentNotification>
                    ))}
                    <AccentNotification priority="error" title="Transfer failed.">
                        {LONG_COPY}
                    </AccentNotification>
                </div>
                <UsageShowcase render={renderB} />
            </PageSection>

            <PageSection
                id="modals"
                title="Modals and drawers — current vs A vs B"
                blurb="The 8 host surfaces (all 14 in-modal call sites) rendered completely, three ways next to each other. Real production copy and layout."
            >
                <div className="flex flex-col gap-10">
                    {MODAL_HOSTS.map((host) => (
                        <div key={host.sites} className="flex flex-col gap-3">
                            <DevSectionLabel>{host.sites}</DevSectionLabel>
                            <div className="grid items-start gap-4 xl:grid-cols-3">
                                {(
                                    [
                                        ['current', renderCurrent],
                                        ['A — compact inline', renderA],
                                        ['B — accent banner', renderB],
                                    ] as const
                                ).map(([label, fn]) => (
                                    <div key={label} className="flex min-w-0 flex-col gap-1.5">
                                        <p className="text-body-xs font-semibold">{label}</p>
                                        {host.build(fn)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </PageSection>

            <PageSection
                id="toasts"
                title="Toasts — current vs proposal D"
                blurb="Left: today's toast (the full Notification floating; last pill reproduces the live double-icon bug). Right: D — compact pill, single icon slot, custom content replaces it entirely."
            >
                <div className="grid items-start gap-4 md:grid-cols-2">
                    <div className="flex flex-col items-end gap-2 rounded-sm border border-border-subtle bg-background-page p-4">
                        <p className="mr-auto text-body-xs text-foreground-secondary">current</p>
                        <div className="max-w-md">
                            <Notification priority="info" onDismiss={noop}>
                                Link copied
                            </Notification>
                        </div>
                        <div className="max-w-md">
                            <Notification priority="error" onDismiss={noop}>
                                Failed to cancel link. Please try again.
                            </Notification>
                        </div>
                        <div className="max-w-md">
                            {/* the double-icon bug, reproduced with the production component:
                                priority icon + the content's own clock icon */}
                            <Notification priority="info" onDismiss={noop}>
                                <span className="flex items-center gap-2">
                                    <Icon name="clock" size={16} className="shrink-0" />
                                    Card locked for 4:32
                                </span>
                            </Notification>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 rounded-sm border border-border-subtle bg-background-page p-4">
                        <p className="mr-auto text-body-xs text-foreground-secondary">
                            proposal D — dismiss works, reset below
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
                </div>
            </PageSection>

            <PageSection
                id="secondary"
                title="Other ideas (not finalists)"
                blurb="Kept for reference, collapsed. C is a quiet no-box note; E/F/G are in-modal-only treatments, each compared against the current component inside the lose-phone modal."
            >
                <Fold summary="C — quiet modal note (no box: tinted 16px icon + Body/XS secondary text)">
                    <div className="flex max-w-xl flex-col items-start gap-2">
                        {PRIORITIES.map((p) => (
                            <QuietNotification key={p} priority={p}>
                                {SHORT_COPY[p]}
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
                </Fold>
                <Fold summary="E — modal body row (icon + Body/S at the modal's own body type step)">
                    <InModalComparison
                        render={(p, title, copy) => (
                            <ModalBodyNote priority={p} title={title}>
                                {copy}
                            </ModalBodyNote>
                        )}
                    />
                </Fold>
                <Fold summary="F — footnote under the CTA (Body/XS centered, dimmed; error stays red)">
                    <InModalComparison
                        footnote
                        render={(p, _title, copy) => <ModalFootnote priority={p}>{copy}</ModalFootnote>}
                    />
                </Fold>
                <Fold summary="G — tinted chip (badge-weight: Body/XS, 12px icon, 4px vertical padding)">
                    <InModalComparison
                        render={(p, title, copy) => (
                            <ModalChip priority={p} title={title}>
                                {copy}
                            </ModalChip>
                        )}
                    />
                </Fold>
            </PageSection>

            <DevNoteCard title="Proposal notes">
                All colors come from existing tokens: badge backgrounds, the icon-bubble accents, avatar foregrounds,
                and the error semantics. No new colors, shadows, or radii. Root cause of the double-icon toast bug:
                Toast passes caller content as Notification children while Notification still prepends its priority icon
                — hideIcon is opt-in and RainCooldownContext forgot it.
            </DevNoteCard>
        </DevPageShell>
    )
}
