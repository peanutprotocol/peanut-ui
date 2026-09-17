'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/** the Unlock payments residence row, opened by its own query param */
const RESIDENCE_CHANGE_HREF = '/profile/identity-verification?open=residence'

/** the QR payment flow, which any balance can pay from */
const QR_PAY_HREF = '/qr-pay'

/**
 * A corridor the user's residence does not reach, or one the provider closed
 * on them.
 *
 * Either way there are no details to render. The screen says why and offers
 * the one thing that changes it — the residence on their account, or the
 * top-up route that still works — rather than leaving them on a skeleton
 * waiting for details nobody is going to return.
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
    const { t, residenceLine, qrPayLine } = useDepositAccountCopy()
    const residence = residenceLine(rail.corridor)
    // Residence closes the account, not the country: Pix and Mercado Pago QR
    // codes are payable from a Peanut balance wherever the user lives.
    const qrPay = requiresResidence ? qrPayLine(rail) : undefined
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
                            ? residence.title
                            : t('details.unavailableTitle', { currency: rail.currency })
                    }
                    description={
                        requiresResidence && residence ? (
                            <span className="inline">
                                {residence.requirement}
                                {qrPay ? ` ${qrPay}` : ''}
                            </span>
                        ) : (
                            t('details.unavailableBody')
                        )
                    }
                    cta={
                        requiresResidence && residence ? (
                            <div className="mt-4 flex w-full flex-col items-center gap-4">
                                {/* the residence row on Unlock payments, opened on arrival */}
                                <Button
                                    variant="purple"
                                    className="w-full"
                                    href={withReturnTo(RESIDENCE_CHANGE_HREF, '/add-money?method=bank')}
                                >
                                    {t('details.residenceCta')}
                                </Button>
                                {qrPay && (
                                    <LinkButton href={QR_PAY_HREF} data-testid="corridor-qr-pay">
                                        {t('details.qrPayCta')}
                                    </LinkButton>
                                )}
                            </div>
                        ) : topUpHref ? (
                            // a closed corridor still has a real way in — send
                            // them to it rather than back
                            <Button variant="purple" className="mt-4 w-full" href={topUpHref}>
                                {t('details.topUpCta', { currency: rail.currency })}
                            </Button>
                        ) : (
                            <Button variant="purple" className="mt-4 w-full" onClick={onBack}>
                                {t('details.unavailableCta')}
                            </Button>
                        )
                    }
                />
            </PageStack.Center>
        </PageStack>
    )
}
