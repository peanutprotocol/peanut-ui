'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositAccountDetailsBody } from './DepositAccountDetailsBody'
import { DepositShareActions } from './DepositShareActions'

/**
 * Screen 2 — the user's own view of one account.
 *
 * One card of numbers and the actions that hand them over, like a bank's own
 * account-details screen. Who can pay, fees and timing are one collapsed
 * section below the card (founders review, 2026-09-23: the screen read as the
 * heaviest in the app).
 */
export function DepositAccountDetailsScreen({
    rail,
    account,
    userName,
    canShare,
    onBack,
    onRetry,
    onContactSupport,
}: {
    rail: DepositRail
    account: DepositAccountView
    /** the name a payer reads when the account is NOT in the user's own name */
    userName: string
    /** may these details be handed to a payer — the resolver's own answer */
    canShare: boolean
    onBack: () => void
    onRetry: () => void
    /** revoked details have no self-service fix — this is the only way out */
    onContactSupport: () => void
}) {
    const { t } = useDepositAccountCopy()

    if (account.status === 'revoked') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center>
                    <EmptyState
                        icon="lock"
                        title={t('details.revokedTitle', { currency: rail.currency })}
                        description={t('details.revokedBody')}
                        cta={
                            /*
                             * There is no self-service way out. Claiming again
                             * returns the same dead account — the provider's
                             * create call is idempotent per customer and
                             * currency — so the screen that says the details
                             * are dead hands the user to a person instead of
                             * to a button that loops.
                             */
                            <div className="flex w-full flex-col gap-2">
                                <Button variant="primary" className="w-full" onClick={onContactSupport}>
                                    {t('details.revokedCta')}
                                </Button>
                                <Button variant="secondary" className="w-full" onClick={onBack}>
                                    {t('details.unavailableCta')}
                                </Button>
                            </div>
                        }
                    />
                </PageStack.Center>
            </PageStack>
        )
    }

    // The provider never answered inside the wait we give it. Only the client
    // knows this, so it is checked before the status branches below.
    if (account.timedOut) {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="error" color="red" />
                    <TitleBlock
                        align="center"
                        size="s"
                        title={t('details.timedOutTitle', { currency: rail.currency })}
                        description={t('details.timedOutBody')}
                    />
                    {/* one CTA stack, the same gap-2 pair as the revoked state */}
                    <div className="flex w-full flex-col gap-2">
                        <Button variant="primary" className="w-full" onClick={onRetry}>
                            {t('details.timedOutRetry')}
                        </Button>
                        <Button variant="secondary" className="w-full" onClick={onBack}>
                            {t('details.unavailableCta')}
                        </Button>
                    </div>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <DepositAccountDetailsBody rail={rail} account={account} userName={userName} />

            {/* Keep both sharing actions behind the same eligibility check. */}
            {canShare && <DepositShareActions rail={rail} account={account} userName={userName} />}
        </PageStack>
    )
}
