'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import type { DepositGateView } from '../depositGate'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

const TITLES = {
    support: 'gate.blockedTitle',
    'accept-tos': 'gate.tosTitle',
    'provide-email': 'gate.emailTitle',
    none: 'gate.waitTitle',
    verify: 'gate.verifyTitle',
    'account-limit': 'gate.limitTitle',
    'pending-review': 'gate.reviewTitle',
    'finish-review': 'gate.finishReviewTitle',
    'finish-review-support': 'gate.finishReviewTitle',
} as const

const BODIES = {
    none: 'gate.waitBody',
    'provide-email': 'gate.emailBody',
    'accept-tos': 'gate.verifyBody',
    // Support is offered to users who are already verified: a terminal
    // rejection, or a block the backend could not explain. The identity
    // sentence is false for both.
    support: 'gate.blockedBody',
    verify: 'gate.verifyBody',
    'account-limit': 'gate.limitBody',
    'pending-review': 'gate.reviewBody',
    'finish-review': 'gate.finishReviewBody',
    'finish-review-support': 'gate.finishReviewSupportBody',
} as const

const LABELS = {
    'accept-tos': 'gate.tosCta',
    'provide-email': 'gate.emailCta',
    support: 'gate.supportCta',
    verify: 'gate.verifyCta',
    none: 'details.unavailableCta',
    // The same shared support entry point, and the same label, as every other
    // screen that offers a person — never a second wording for one door.
    'account-limit': 'gate.supportCta',
    'pending-review': 'gate.reviewCta',
    'finish-review': 'gate.finishReviewCta',
    'finish-review-support': 'gate.supportCta',
} as const

/** the picture each reason gets; the default says "closed to you", which a wait is not */
const ICONS = {
    none: 'clock',
    'pending-review': 'clock',
    'account-limit': 'peanut-support',
    'finish-review': 'user-id',
    'finish-review-support': 'peanut-support',
} as const

/** Reasons with nothing to press: the button goes back, and the screen updates by itself. */
const WAITS: ReadonlySet<string> = new Set(['none', 'pending-review'])

/**
 * A corridor the user cannot open yet, and the one thing that changes it.
 *
 * This used to be a banner over the whole list, which told a user holding two
 * working accounts to go and verify their identity. The gate belongs to the
 * corridor: the row stays tappable, and the tap lands here with the reason and
 * the button that clears it.
 *
 * Each kind gets its own words and its own button, because they are not the
 * same problem: `pending` and `waiting-on-provider` are a wait with nothing to
 * press, `accept-tos` is a document to agree to, `provide-email` is one missing
 * address on an already-verified user, a terminal rejection needs a person, and
 * a provider review that waits on the user needs the provider's own hosted
 * check — identity verification cannot clear it.
 * The provider's own message wins over ours whenever it sent one — it knows why
 * it said no.
 */
export function CorridorGateScreen({
    rail,
    notice,
    slotsHeld = 0,
    isActing = false,
    actFailed = false,
    onBack,
    onAct,
    onTopUp,
}: {
    rail: DepositRail
    notice: NonNullable<DepositGateView['notice']>
    /** how many accounts the cap screen says the user has — their own count, never a default */
    slotsHeld?: number
    /** the button's action is in flight */
    isActing?: boolean
    /** the button's action failed for a reason a retry may clear */
    actFailed?: boolean
    onBack: () => void
    onAct: () => void
    /**
     * The other way in: a transfer the user sends themselves on this same
     * rail. It needs no account, so it works while the account does not.
     * Absent where the corridor has no country live for it.
     */
    onTopUp?: () => void
}) {
    const { t, railName } = useDepositAccountCopy()
    const waiting = WAITS.has(notice.action)
    /*
     * At the account cap there is nothing to unblock: the user holds every
     * account we open for them, and support opening one more is a conversation,
     * not a deposit. The transfer they can send themselves is the thing that
     * moves money today, so it leads and support follows. Every other reason
     * keeps its own button first — those DO clear the block.
     */
    const topUpLeads = !!onTopUp && notice.action === 'account-limit'

    const actButton = (
        <Button
            key="act"
            variant={topUpLeads ? 'stroke' : 'purple'}
            className="w-full"
            loading={isActing}
            disabled={isActing}
            onClick={waiting ? onBack : onAct}
            data-testid={`corridor-gate-${notice.action}`}
        >
            {t(LABELS[notice.action])}
        </Button>
    )
    const topUpButton = onTopUp ? (
        <Button
            key="top-up"
            variant={topUpLeads ? 'purple' : 'stroke'}
            className="w-full"
            onClick={onTopUp}
            data-testid="corridor-gate-top-up"
        >
            {t('gate.topUpCta')}
        </Button>
    ) : null

    return (
        <PageStack>
            <NavHeader title={t('list.addTitle')} onPrev={onBack} />
            <PageStack.Center>
                {notice.action === 'pending-review' && (
                    <div className="mb-4 flex justify-center">
                        <StatusBadge status="pending" />
                    </div>
                )}
                {/* a flow-level failure, so a Notification: it carries role="alert"
                    and the button below is the retry */}
                {actFailed && (
                    <Notification priority="error" className="mb-4" data-testid="corridor-gate-act-failed">
                        {t('gate.actFailed')}
                    </Notification>
                )}
                <EmptyState
                    icon={ICONS[notice.action as keyof typeof ICONS] ?? 'globe-lock'}
                    title={t(TITLES[notice.action], { count: slotsHeld })}
                    description={
                        notice.message ??
                        (topUpLeads ? t('gate.limitBodyTopUp') : t(BODIES[notice.action], { currency: rail.currency }))
                    }
                    cta={
                        // the leading button first in the DOM, so the order on
                        // screen and the tab order both say which one to press
                        <div className="mt-4 flex w-full flex-col gap-2">
                            {topUpLeads ? [topUpButton, actButton] : [actButton, topUpButton]}
                        </div>
                    }
                />
                {/* which corridor the user tapped, so the screen is not about "an account" */}
                <p className="text-center text-body-xs text-foreground-secondary">
                    {`${rail.currency} · ${railName(rail.corridor)}`}
                </p>
            </PageStack.Center>
        </PageStack>
    )
}
