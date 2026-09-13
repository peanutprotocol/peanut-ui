'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { rewriteMethodPath } from '@/utils/native-routes'
import Link from 'next/link'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { RuleWithInfo } from './DepositRuleList'

/**
 * A corridor the user has a rail for that is not a standing account.
 *
 * Argentina and Brazil both mint their coordinates per deposit — the Argentine
 * CVU belongs to the provider and only credits a transfer the user sends
 * themselves — so there is nothing to hand to an employer. The screen says why
 * and sends the user to the top-up route that does work, rather than leaving
 * them on a skeleton waiting for details nobody is going to return.
 */
export function CorridorUnavailableScreen({ rail, onBack }: { rail: DepositRail; onBack: () => void }) {
    const { t, unclaimableReason } = useDepositAccountCopy()
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
                    title={t('details.unavailableTitle', { currency: rail.currency })}
                    description={
                        unclaimable ? (
                            <RuleWithInfo text={unclaimable.text} why={unclaimable.why} />
                        ) : (
                            t('details.unavailableBody')
                        )
                    }
                    cta={
                        topUpHref ? (
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
