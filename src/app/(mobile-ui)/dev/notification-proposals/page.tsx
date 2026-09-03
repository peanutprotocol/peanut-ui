'use client'

import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import DevPageShell from '../_components/DevPageShell'
import DevSectionLabel from '../_components/DevSectionLabel'
import DevNoteCard from '../_components/DevNoteCard'

/**
 * /dev/notification-proposals — notification USAGE INVENTORY.
 *
 * The compact-inline redesign shipped (production Notification is now Body/S,
 * 16px icon, tight padding, one size everywhere). This page is no longer a
 * proposal: it renders the real production component in every place it is
 * actually used, grouped by context, as the working inventory for designing
 * the SECOND notification component (Vlad) — the current one is over-used,
 * especially inside modals and drawers.
 */

type Priority = 'info' | 'success' | 'attention' | 'error' | 'helper'

const LONG_COPY =
    'Your transfer could not be completed because the receiving bank rejected the payment. Check the account details and try again, or contact support if the problem does not go away.'

// ---------------------------------------------------------------------------
// variant A — compact inline (tinted box, one type step down, half the padding)
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
        name: 'flow and form errors — 48 call sites, 4 representative samples',
        ctx: 'form',
        note: 'The biggest population: priority="error" under an amount input, form, or CTA — all 48 sites share this exact shape, so four samples stand in for the list (single-line, wrapping, error toast, multi-line toast). Nothing is lost: the sites are enumerated by grepping <Notification priority="error">.',
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
            { label: 'multi-line error toast', ctx: 'toast', rep: true, priority: 'error', body: LONG_COPY },
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

const noop = () => {}

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

const NAV = [
    ['errors', 'flow errors'],
    ['banners', 'page banners'],
    ['modals', 'modals & drawers'],
    ['special', 'rich body'],
    ['toasts', 'toasts'],
] as const

const renderCurrent: RenderFn = (u) => (
    <Notification priority={u.priority} title={u.title} items={u.items} hideIcon={u.hideIcon}>
        {u.body}
    </Notification>
)

const [G_ERRORS, G_WRAPPERS, G_BANNERS, G_SPECIAL] = USAGE_GROUPS

// ---------------------------------------------------------------------------
// full-page banner frames — the notification in its real on-page position
// ---------------------------------------------------------------------------

/** ~375px static page frame: banner slot at the very top of the shell (the
 *  production Banner renders above page content with mx-4 mt-2), content
 *  below, optional bottom tab bar. Height-capped so five frames scan in a row. */
const PageFrame = ({
    banner,
    tabBar = false,
    children,
}: {
    banner?: React.ReactNode
    tabBar?: boolean
    children: React.ReactNode
}) => (
    <div className="flex h-[560px] w-full max-w-[375px] flex-col overflow-hidden rounded border border-border-default bg-background-default">
        {banner}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">{children}</div>
        {tabBar && (
            <div className="flex items-center justify-around border-t border-border-default py-2 text-foreground-secondary">
                <Icon name="home" size={20} className="text-foreground-primary" />
                <Icon name="plus" size={20} />
                <Icon name="history" size={20} />
                <Icon name="user" size={20} />
            </div>
        )}
    </div>
)

/** home-ish scaffold shared by the two shell-banner frames */
const HomeScaffold = () => (
    <>
        <div className="flex items-center justify-between">
            <div className="size-8 rounded-round border border-border-default bg-background-badge-accent" />
            <Icon name="gift" size={20} className="text-foreground-secondary" />
        </div>
        <div className="flex flex-col items-center gap-1 py-4">
            <p className="text-body-xs text-foreground-secondary">Balance</p>
            <p className="text-heading-m">$ 1,024.50</p>
        </div>
        <div className="flex justify-center gap-2">
            {['Add', 'Send', 'Withdraw'].map((a) => (
                <span key={a} className="rounded-round border border-border-default px-4 py-1.5 text-button-s">
                    {a}
                </span>
            ))}
        </div>
        <div className="flex flex-col gap-2 pt-2">
            <p className="text-label-m tracking-wide text-foreground-secondary uppercase">Recent</p>
            {['Maria — $12.00', 'Coffee Shop — $4.80'].map((r) => (
                <div key={r} className="flex items-center gap-3 rounded-sm border border-border-default p-3">
                    <div className="size-8 rounded-round bg-background-badge-helper" />
                    <span className="text-body-s">{r}</span>
                </div>
            ))}
        </div>
    </>
)

const BANNER_PAGES: { label: string; frame: React.ReactNode }[] = [
    {
        label: 'Global/Banner:43 — offline, top of the shell on home (also has a degraded-connectivity attention state)',
        frame: (
            <PageFrame
                tabBar
                banner={
                    <Notification priority="error" className="mx-4 mt-2">
                        No internet connection — some features won&apos;t work until you reconnect
                    </Notification>
                }
            >
                <HomeScaffold />
            </PageFrame>
        ),
    },
    {
        label: 'Global/Banner:57 — maintenance, same shell position',
        frame: (
            <PageFrame
                tabBar
                banner={
                    <Notification priority="error" className="mx-4 mt-2">
                        Maintenance mode, some functionalities won&apos;t be available. Funds safe
                    </Notification>
                }
            >
                <HomeScaffold />
            </PageFrame>
        ),
    },
    {
        label: 'add-money/[country]/bank:515 — EUR-only note under the amount input',
        frame: (
            <PageFrame>
                <div className="flex items-center gap-2">
                    <Icon name="chevron-right" size={20} className="rotate-180" />
                    <p className="text-heading-xs">Add money</p>
                </div>
                <div className="flex flex-col items-center gap-1 py-4">
                    <p className="text-heading-l">€ 50</p>
                    <p className="text-body-xs text-foreground-secondary">from your bank account</p>
                </div>
                <Notification priority="info" title="EUR accounts only">
                    Only EUR accounts with IBAN work for onramps. Your local currency account may not work.
                </Notification>
                <Button onClick={noop} className="mt-auto w-full justify-center">
                    Continue
                </Button>
            </PageFrame>
        ),
    },
    {
        label: 'Kyc/states/KycActionRequired:42 — status banner on the verification page',
        frame: (
            <PageFrame>
                <div className="flex items-center gap-2">
                    <Icon name="chevron-right" size={20} className="rotate-180" />
                    <p className="text-heading-xs">Verify your identity</p>
                </div>
                <div className="flex flex-col items-center gap-3 py-6">
                    <IconBubble
                        size="m"
                        icon={<Icon name="alert" fill="currentColor" size={24} className="text-black" />}
                        className="bg-action-secondary"
                    />
                    <p className="text-body-s text-foreground-secondary">Verification status: action required</p>
                </div>
                <Notification priority="info">
                    We need a bit more to verify your identity. Tap below to continue.
                </Notification>
                <Button onClick={noop} className="mt-auto w-full justify-center">
                    Continue verification
                </Button>
            </PageFrame>
        ),
    },
    {
        label: 'TransactionDetails/CardUsdAbroadNotice:50 — nudge inside the receipt',
        frame: (
            <PageFrame>
                <div className="flex items-center gap-2">
                    <Icon name="chevron-right" size={20} className="rotate-180" />
                    <p className="text-heading-xs">Payment</p>
                </div>
                <div className="flex flex-col gap-2 rounded-sm border border-border-default p-4">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-round bg-background-badge-helper" />
                        <div>
                            <p className="text-body-s font-semibold">Ramen Bar Tokyo</p>
                            <p className="text-body-xs text-foreground-secondary">Card payment</p>
                        </div>
                        <p className="ml-auto text-body-m-semibold">-$18.40</p>
                    </div>
                    <div className="border-t border-border-subtle pt-2 text-body-xs text-foreground-secondary">
                        <div className="flex justify-between py-0.5">
                            <span>Date</span>
                            <span>Sep 2, 2026</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                            <span>Status</span>
                            <span>Settled</span>
                        </div>
                    </div>
                </div>
                <Notification priority="info" title="Pay in local currency next time">
                    You were charged in US dollars. When a terminal offers to bill in dollars, choose the local currency
                    instead — Peanut&apos;s exchange rate is usually better.
                </Notification>
            </PageFrame>
        ),
    },
]

/** one usage group: label + note + grid of real-component renders */
const GroupBlock = ({ group }: { group: UsageGroup }) => (
    <div className="flex flex-col gap-3">
        <DevSectionLabel>{group.name}</DevSectionLabel>
        {group.note && <p className="max-w-3xl text-body-xs text-foreground-secondary">{group.note}</p>}
        <div className="grid items-start gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
            {group.usages.map((u) => (
                <UsageCell key={u.label} usage={u} ctx={group.ctx} render={renderCurrent} />
            ))}
        </div>
    </div>
)

export default function NotificationUsageInventoryPage() {
    return (
        <DevPageShell
            title="Notification usage inventory"
            description="Every place the (shipped, compact) production Notification renders today, grouped by context — the working inventory for designing the second notification component. The in-modal/drawer group is the over-served context that component targets."
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
                id="errors"
                title="Flow and form errors"
                blurb="48 call sites, one shape: priority=error under an input or CTA. Four samples stand in for the list. This context is well-served by the current component — probably not the second component's job."
            >
                <GroupBlock group={G_ERRORS} />
            </PageSection>

            <PageSection
                id="banners"
                title="Page banners"
                blurb="Exhaustive: every page-level banner — load errors, titled info/attention notices, transaction-detail nudges, the shell connectivity/maintenance banner. Note the stacking smell: AddMoneyBankDetails shows three attention boxes on one screen."
            >
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <DevSectionLabel>in full-page context — 5 framed examples</DevSectionLabel>
                        <p className="max-w-3xl text-body-xs text-foreground-secondary">
                            Banner = page-level context; the second component probably isn&apos;t for these. Static
                            frames, real copy, real component in its real position.
                        </p>
                        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {BANNER_PAGES.map((p) => (
                                <div key={p.label} className="flex min-w-0 flex-col gap-1.5">
                                    <p className="text-body-xs text-foreground-secondary">{p.label}</p>
                                    {p.frame}
                                </div>
                            ))}
                        </div>
                    </div>
                    <GroupBlock group={G_WRAPPERS} />
                    <GroupBlock group={G_BANNERS} />
                </div>
            </PageSection>

            <PageSection
                id="modals"
                title="Inside modals and drawers — the over-served context"
                blurb="All 14 in-modal/in-drawer call sites as their 8 complete host surfaces (real copy and layout, ~375px). This is where the current component fits worst and where the second component should win. Labels list the call sites each host covers."
            >
                <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {MODAL_HOSTS.map((host) => (
                        <div key={host.sites} className="flex min-w-0 flex-col gap-1.5">
                            <p className="text-body-xs text-foreground-secondary">{host.sites}</p>
                            {host.build(renderCurrent)}
                        </div>
                    ))}
                </div>
            </PageSection>

            <PageSection
                id="special"
                title="Rich body with actions"
                blurb="One site stretches the component furthest: bullet list + divider + action link inside the notification body. A shape the second component should either own properly or reject."
            >
                <GroupBlock group={G_SPECIAL} />
            </PageSection>

            <PageSection
                id="toasts"
                title="Toasts"
                blurb="Every useToast caller renders the same component floating bottom-right (ToastStack). Four generic types plus two custom-content pills; the cooldown pill still shows the double-icon bug (content brings its own icon, hideIcon not passed)."
            >
                <div className="flex max-w-xl flex-col items-end gap-2 rounded-sm border border-border-subtle bg-background-page p-4">
                    <div className="max-w-md">
                        <Notification priority="success" onDismiss={noop}>
                            Document submitted! Your limits will be updated shortly.
                        </Notification>
                    </div>
                    <div className="max-w-md">
                        <Notification priority="error" onDismiss={noop}>
                            Failed to cancel link. Please try again.
                        </Notification>
                    </div>
                    <div className="max-w-md">
                        <Notification priority="info" onDismiss={noop}>
                            Link copied
                        </Notification>
                    </div>
                    <div className="max-w-md">
                        {/* toast.warning maps to attention; representative copy */}
                        <Notification priority="attention" onDismiss={noop}>
                            Your session is about to expire.
                        </Notification>
                    </div>
                    <div className="max-w-md">
                        {/* RainCooldownContext:109 — renders like this today: priority icon
                            AND the content's clock icon (the double-icon bug) */}
                        <Notification priority="info" onDismiss={noop}>
                            <span className="flex items-center gap-2">
                                <Icon name="clock" size={16} className="shrink-0" />
                                Card locked for 4:32
                            </span>
                        </Notification>
                    </div>
                    <div className="max-w-md">
                        {/* BadgeEarnToast:84 — custom content with hideIcon, badge art mocked */}
                        <Notification priority="success" hideIcon onDismiss={noop}>
                            <span className="flex items-center gap-2">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-round bg-background-badge-accent">
                                    🏅
                                </span>
                                Badge unlocked: First Steps
                            </span>
                        </Notification>
                    </div>
                </div>
            </PageSection>

            <DevNoteCard title="Inventory notes">
                Hand-transcribed from grep + i18n (2026-09-02, re-checked 2026-09-03) — re-grep before trusting counts
                after big merges. 96 inline call sites + the toast surface; flow errors sampled, everything else
                exhaustive. Runtime-only copy is marked &quot;representative&quot;. Known bug for the toast rows:
                RainCooldownContext passes content with its own clock icon and no hideIcon, so the pill renders two
                icons.
            </DevNoteCard>
        </DevPageShell>
    )
}
