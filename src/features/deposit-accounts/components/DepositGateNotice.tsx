'use client'

import { Notification } from '@/components/0_Bruddle/Notification'
import type { DepositGateView } from '../depositGate'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

const TITLES = {
    support: 'gate.blockedTitle',
    'accept-tos': 'gate.tosTitle',
    'provide-email': 'gate.emailTitle',
    none: 'gate.waitTitle',
    verify: 'gate.verifyTitle',
} as const

const LABELS = {
    'accept-tos': 'gate.tosCta',
    'provide-email': 'gate.emailCta',
    support: 'gate.supportCta',
    verify: 'gate.verifyCta',
    none: 'gate.verifyCta',
} as const

const BODIES = {
    none: 'gate.waitBody',
    'provide-email': 'gate.emailBody',
    'accept-tos': 'gate.verifyBody',
    support: 'gate.verifyBody',
    verify: 'gate.verifyBody',
} as const

/**
 * The banner for a gate that is not `ready`.
 *
 * Each kind gets its own words and its own button, because they are not the
 * same problem: `pending` and `waiting-on-provider` are a wait with nothing to
 * press, `accept-tos` is a document to agree to, `provide-email` is one missing
 * address on an already-verified user, and a terminal rejection needs a person.
 * The provider's own message wins over ours whenever it sent one — it knows
 * why it said no.
 */
export function DepositGateNotice({
    notice,
    onAct,
}: {
    notice: NonNullable<DepositGateView['notice']>
    onAct: () => void
}) {
    const { t } = useDepositAccountCopy()

    return (
        <Notification
            priority="attention"
            title={t(TITLES[notice.action])}
            ctas={notice.action === 'none' ? undefined : [{ label: t(LABELS[notice.action]), onClick: onAct }]}
        >
            {notice.message ?? t(BODIES[notice.action])}
        </Notification>
    )
}
