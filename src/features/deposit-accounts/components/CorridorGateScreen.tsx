'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
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
} as const

const BODIES = {
    none: 'gate.waitBody',
    'provide-email': 'gate.emailBody',
    'accept-tos': 'gate.verifyBody',
    support: 'gate.verifyBody',
    verify: 'gate.verifyBody',
    'account-limit': 'gate.limitBody',
    'pending-review': 'gate.reviewBody',
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
} as const

/** the picture each reason gets; the default says "closed to you", which a wait is not */
const ICONS = {
    none: 'clock',
    'pending-review': 'clock',
    'account-limit': 'peanut-support',
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
 * address on an already-verified user, and a terminal rejection needs a person.
 * The provider's own message wins over ours whenever it sent one — it knows why
 * it said no.
 */
export function CorridorGateScreen({
    rail,
    notice,
    onBack,
    onAct,
}: {
    rail: DepositRail
    notice: NonNullable<DepositGateView['notice']>
    onBack: () => void
    onAct: () => void
}) {
    const { t, railName } = useDepositAccountCopy()
    const waiting = WAITS.has(notice.action)
    // A gate on the standing account does not close the country. Where the rail
    // has a top-up, waiting on the gate is not the user's only option.
    const topUpHref = rail.topUpHref ? rewriteMethodPath(rail.topUpHref) : undefined

    return (
        <PageStack>
            <NavHeader title={t('list.addTitle')} onPrev={onBack} />
            <PageStack.Center>
                {notice.action === 'pending-review' && (
                    <div className="mb-4 flex justify-center">
                        <StatusBadge status="pending" />
                    </div>
                )}
                <EmptyState
                    icon={ICONS[notice.action as keyof typeof ICONS] ?? 'globe-lock'}
                    title={t(TITLES[notice.action])}
                    description={notice.message ?? t(BODIES[notice.action])}
                    cta={
                        <div className="mt-4 flex w-full flex-col items-center gap-4">
                            <Button
                                variant="purple"
                                className="w-full"
                                onClick={waiting ? onBack : onAct}
                                data-testid={`corridor-gate-${notice.action}`}
                            >
                                {t(LABELS[notice.action])}
                            </Button>
                            {topUpHref && (
                                <LinkButton href={topUpHref} data-testid="corridor-top-up">
                                    {t('details.topUpCta', { currency: rail.currency })}
                                </LinkButton>
                            )}
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
