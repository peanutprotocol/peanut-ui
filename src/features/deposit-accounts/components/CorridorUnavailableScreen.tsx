'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import Link from 'next/link'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { RuleWithInfo } from './DepositRuleList'

/** the Unlock payments residence row, opened by its own query param */
const RESIDENCE_CHANGE_HREF = '/profile/identity-verification?open=residence'

/** the QR payment flow, which any balance can pay from */
const QR_PAY_HREF = '/qr-pay'

/**
 * A corridor the user has a rail for that is not a standing account, or one
 * their residence does not reach.
 *
 * Argentina and Brazil both mint their coordinates per deposit — the Argentine
 * CVU belongs to the provider and only credits a transfer the user sends
 * themselves — so there is nothing to hand to an employer. The screen says why
 * and sends the user to the top-up route that does work, rather than leaving
 * them on a skeleton waiting for details nobody is going to return.
 */
export function CorridorUnavailableScreen({
    rail,
    onBack,
    requiresResidence = false,
}: {
    rail: DepositRail
    onBack: () => void
    /**
     * The corridor exists and the user does not live there. The fix is not
     * another currency — it is the residence on their account, so the screen
     * sends them to the one flow that changes it.
     */
    requiresResidence?: boolean
}) {
    const { t, unclaimableReason, residenceLine, qrPayLine } = useDepositAccountCopy()
    const residence = residenceLine(rail.corridor)
    // Residence closes the account, not the country: Pix and Mercado Pago QR
    // codes are payable from a Peanut balance wherever the user lives.
    const qrPay = requiresResidence ? qrPayLine(rail) : undefined
    const unclaimable = unclaimableReason(rail.corridor)
    // The Manteca top-up lives at /add-money/[country]/manteca, a dynamic route
    // the native static export does not ship. rewriteMethodPath turns it into
    // the query-backed parent the export does have; on web it is a no-op.
    const topUpHref = rail.topUpHref ? rewriteMethodPath(rail.topUpHref) : undefined

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <PageStack.Center>
                <EmptyState
                    icon="globe-lock"
                    title={
                        requiresResidence && residence
                            ? t('details.residenceTitle')
                            : t('details.unavailableTitle', { currency: rail.currency })
                    }
                    description={
                        requiresResidence && residence ? (
                            <span className="inline">
                                {residence.requirement}
                                {qrPay ? ` ${qrPay}` : ''}
                            </span>
                        ) : unclaimable ? (
                            <RuleWithInfo text={unclaimable.text} why={unclaimable.why} />
                        ) : (
                            t('details.unavailableBody')
                        )
                    }
                    cta={
                        requiresResidence && residence ? (
                            <div className="flex flex-col items-center gap-2">
                                {/* the residence row on Unlock payments, opened on arrival */}
                                <Link href={withReturnTo(RESIDENCE_CHANGE_HREF, '/add-money?method=bank')}>
                                    <Button variant="stroke" size="small">
                                        {t('details.residenceCta')}
                                    </Button>
                                </Link>
                                {qrPay && (
                                    <Link href={QR_PAY_HREF} data-testid="corridor-qr-pay">
                                        <Button variant="stroke" size="small">
                                            {t('details.qrPayCta')}
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ) : topUpHref ? (
                            // a corridor with no standing account still has a
                            // real way in — send them to it rather than back
                            <Link href={topUpHref}>
                                <Button variant="stroke" size="small">
                                    {t('details.topUpCta', { currency: rail.currency })}
                                </Button>
                            </Link>
                        ) : (
                            <Button variant="stroke" size="small" onClick={onBack}>
                                {t('details.unavailableCta')}
                            </Button>
                        )
                    }
                />
            </PageStack.Center>
        </PageStack>
    )
}
