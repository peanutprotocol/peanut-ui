'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/**
 * A corridor the provider closed on the user.
 *
 * There are no details to render. The screen says so and offers the top-up
 * route that still works, rather than leaving them on a skeleton waiting for
 * details nobody is going to return.
 */
export function CorridorUnavailableScreen({ rail, onBack }: { rail: DepositRail; onBack: () => void }) {
    const { t } = useDepositAccountCopy()
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
