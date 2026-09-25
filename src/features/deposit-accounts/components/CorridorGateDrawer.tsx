'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Badge from '@/components/Global/Badges/Badge'
import { type IconName } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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
    // The title and the button already say it: one document to read and
    // agree to. The identity sentence that used to sit here was about a
    // different step (konrad review, 2026-09-23).
    'accept-tos': null,
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

/** Reasons with nothing to press: the button closes the drawer, and the drawer updates by itself. */
const WAITS: ReadonlySet<string> = new Set(['none', 'pending-review'])

/**
 * A corridor the user cannot open yet, and the one thing that changes it.
 *
 * This used to be a banner over the whole list, which told a user holding two
 * working accounts to go and verify their identity. The gate belongs to the
 * corridor: the row stays tappable, and the tap opens this drawer with the
 * reason and the button that clears it.
 *
 * It is a drawer over the list rather than a page of its own: most reasons are
 * one sentence and one button, which left a full page half empty, and the list
 * the user tapped from stays mounted underneath (TASK-22762). Screens for an
 * account the user holds stay full pages.
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
export function CorridorGateDrawer({
    open,
    rail,
    notice,
    slotsHeld = 0,
    isActing = false,
    actFailed = false,
    onClose,
    onDismiss = onClose,
    onAct,
    onTopUp,
}: {
    open: boolean
    rail: DepositRail
    notice: NonNullable<DepositGateView['notice']>
    /** how many accounts the cap drawer says the user has — their own count, never a default */
    slotsHeld?: number
    /** the button's action is in flight */
    isActing?: boolean
    /** the button's action failed for a reason a retry may clear */
    actFailed?: boolean
    /** the wait button: back to the list underneath */
    onClose: () => void
    /** the user swiped or tapped the drawer away: back where they came from */
    onDismiss?: () => void
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
    const bodyKey = BODIES[notice.action]
    const body =
        notice.message ??
        (topUpLeads ? t('gate.limitBodyTopUp') : bodyKey ? t(bodyKey, { currency: rail.currency }) : undefined)

    const actButton = (
        <Button
            key="act"
            variant={topUpLeads ? 'secondary' : 'primary'}
            className="w-full"
            loading={isActing}
            disabled={isActing}
            onClick={waiting ? onClose : onAct}
            data-testid={`corridor-gate-${notice.action}`}
        >
            {t(LABELS[notice.action])}
        </Button>
    )
    const topUpButton = onTopUp ? (
        <Button
            key="top-up"
            variant={topUpLeads ? 'primary' : 'secondary'}
            className="w-full"
            onClick={onTopUp}
            data-testid="corridor-gate-top-up"
        >
            {t('gate.topUpCta')}
        </Button>
    ) : null

    const gateIcon = ICONS[notice.action as keyof typeof ICONS] as IconName | undefined

    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onDismiss()
            }}
        >
            <DrawerContent className="pb-4" data-testid="corridor-gate-drawer">
                <div className="flex flex-col items-center text-center">
                    {notice.action === 'pending-review' && <Badge status="pending" className="mb-4" />}
                    <IconBubble
                        icon={gateIcon ?? 'globe-lock'}
                        // waiting on review is yellow, a way forward is blue, a closed gate gray
                        color={!gateIcon ? 'gray' : gateIcon === 'clock' ? 'yellow' : 'blue'}
                        className="mb-4"
                    />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t(TITLES[notice.action], { count: slotsHeld })}</DrawerTitle>
                        {body && <DrawerDescription>{body}</DrawerDescription>}
                    </DrawerHeader>
                    {/* a flow-level failure, so a Callout: it carries role="alert"
                        and the button below is the retry */}
                    {actFailed && (
                        <Callout priority="error" className="mt-4 w-full" data-testid="corridor-gate-act-failed">
                            {t('gate.actFailed')}
                        </Callout>
                    )}
                    {/* the leading button first in the DOM, so the order on
                        screen and the tab order both say which one to press */}
                    <div className="mt-6 flex w-full flex-col gap-2">
                        {topUpLeads ? [topUpButton, actButton] : [actButton, topUpButton]}
                    </div>
                    {/* which corridor the user tapped, so the drawer is not about "an account" */}
                    <p className="mt-4 text-body-xs text-foreground-secondary">
                        {`${rail.currency} · ${railName(rail.corridor)}`}
                    </p>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
