'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { ResidenceRequiredScreen } from './ResidenceRequiredScreen'

/** the Unlock payments residence row, opened by its own query param */
const RESIDENCE_CHANGE_HREF = '/profile/accounts-and-payments?open=residence'

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
    const { t, qrPayLine } = useDepositAccountCopy()
    // The Manteca top-up lives at /add-money/[country]/manteca, a dynamic route
    // the native static export does not ship. rewriteMethodPath turns it into
    // the query-backed parent the export does have; on web it is a no-op.
    const topUpHref = rail.topUpHref ? rewriteMethodPath(rail.topUpHref) : undefined

    // The corridor exists and the user does not live there. The shared residence
    // screen states the rule and offers the residence flow, plus the QR route
    // where the country takes one.
    if (requiresResidence && rail.residenceIso2) {
        return (
            <ResidenceRequiredScreen
                // the catalogue only sets residenceIso2 on the AR/BR corridors
                residenceIso2={rail.residenceIso2 as 'AR' | 'BR'}
                qrPayHref={qrPayLine(rail) ? QR_PAY_HREF : undefined}
                residenceChangeHref={withReturnTo(RESIDENCE_CHANGE_HREF, '/add-money?method=bank')}
                onBack={onBack}
            />
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <PageStack.Center>
                <EmptyState
                    icon="globe-lock"
                    title={t('details.unavailableTitle', { currency: rail.currency })}
                    description={t('details.unavailableBody')}
                    cta={
                        topUpHref ? (
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
