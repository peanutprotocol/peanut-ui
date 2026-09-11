'use client'

import { Notification } from '@/components/0_Bruddle/Notification'
import type { DepositGateView } from '../depositGate'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/**
 * The banner for a gate that is not `ready`.
 *
 * Each kind gets its own words and its own button, because they are not the
 * same problem: `pending` and `waiting-on-provider` are a wait with nothing to
 * press, `accept-tos` is a document to agree to, and a terminal rejection
 * needs a person. The provider's own message wins over ours whenever it sent
 * one — it knows why it said no.
 */
export function DepositGateNotice({
    notice,
    onAct,
}: {
    notice: NonNullable<DepositGateView['notice']>
    onAct: () => void
}) {
    const { t } = useDepositAccountCopy()

    const title =
        notice.action === 'support'
            ? t('gate.blockedTitle')
            : notice.action === 'accept-tos'
              ? t('gate.tosTitle')
              : notice.action === 'none'
                ? t('gate.waitTitle')
                : t('gate.verifyTitle')

    const label =
        notice.action === 'accept-tos'
            ? t('gate.tosCta')
            : notice.action === 'support'
              ? t('gate.supportCta')
              : t('gate.verifyCta')

    return (
        <Notification
            priority="attention"
            title={title}
            ctas={notice.action === 'none' ? undefined : [{ label, onClick: onAct }]}
        >
            {notice.message ?? t(notice.action === 'none' ? 'gate.waitBody' : 'gate.verifyBody')}
        </Notification>
    )
}
