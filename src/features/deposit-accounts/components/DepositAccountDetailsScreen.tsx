'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { instructionRows } from '../instructionRows'
import type { DepositAccount, DepositRail, ReturnedPayment } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'

/**
 * Screen 2 — the user's own view of one account.
 *
 * Block order is priority order. Whose name a payer will read comes before
 * the numbers, because it decides whether the details are safe to hand over;
 * everything below the card sets expectations.
 */
export function DepositAccountDetailsScreen({
    rail,
    account,
    returnedPayment,
    userName,
    onBack,
    onShare,
    onRetry,
}: {
    rail: DepositRail
    account: DepositAccount
    returnedPayment?: ReturnedPayment
    userName: string
    onBack: () => void
    onShare: () => void
    onRetry: () => void
}) {
    const { t, rowLabels, arrivalDetail, unclaimableReason } = useDepositAccountCopy()

    if (account.status === 'unavailable') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center>
                    <EmptyState
                        icon="globe-lock"
                        title={t('details.unavailableTitle', { currency: rail.currency })}
                        description={unclaimableReason(rail.corridor) ?? t('details.unavailableBody')}
                        cta={
                            <Button variant="stroke" size="small" onClick={onBack}>
                                {t('details.unavailableCta')}
                            </Button>
                        }
                    />
                </PageStack.Center>
            </PageStack>
        )
    }

    if (account.status === 'failed') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="error" color="red" />
                    <TitleBlock
                        align="center"
                        size="s"
                        title={t('details.failedTitle', { currency: rail.currency })}
                        description={t('details.failedBody')}
                    />
                    <Button variant="purple" className="w-full" onClick={onRetry}>
                        {t('details.failedRetry')}
                    </Button>
                    <Button variant="transparent" className="w-full" onClick={onBack}>
                        {t('details.unavailableCta')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    const provisioning = account.status === 'provisioning'
    const rows = account.instructions ? instructionRows(account.instructions, rowLabels) : []
    const pooled = account.matching.nameOnAccount === 'provider'
    const ownNameOnly = account.matching.sender === 'own-name-only'
    const holder = account.instructions?.accountHolderName ?? ''

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('details.heading', { currency: rail.currency, rail: rail.railName })}
                    description={
                        provisioning
                            ? t('details.provisioning', { currency: rail.currency })
                            : ownNameOnly
                              ? t('details.ownNameOnly')
                              : t('details.openToAnyone')
                    }
                />

                {returnedPayment && !provisioning && (
                    <Notification
                        priority="error"
                        title={t('details.returnedTitle')}
                        ctas={[{ label: t('details.returnedCta'), onClick: onShare }]}
                    >
                        {t('details.returnedBody', {
                            amount: returnedPayment.amount,
                            payer: returnedPayment.payer,
                            date: returnedPayment.date,
                            reason: returnedPayment.reason,
                        })}
                    </Notification>
                )}

                {provisioning ? (
                    <DepositDetailsSkeleton rows={rail.detailRowCount} withNotice={pooled} />
                ) : (
                    <>
                        {pooled && (
                            <Notification priority="info" title={t('details.pooledTitle')}>
                                {ownNameOnly
                                    ? t('details.pooledOwnNameOnly', { holder, currency: rail.currency })
                                    : t('details.pooledShared', {
                                          holder,
                                          currency: rail.currency,
                                          user: userName,
                                      })}
                            </Notification>
                        )}

                        <Section title={t('details.sectionTitle')}>
                            <DepositDetailsCard rows={rows} />
                        </Section>

                        <p className="text-body-xs text-foreground-secondary">
                            {arrivalDetail(rail.corridor)}
                            {rail.thirdPartyCap ? ` ${t('details.thirdPartyCap', { cap: rail.thirdPartyCap })}` : ''}
                        </p>
                    </>
                )}
            </div>

            {!ownNameOnly && (
                <PageStack.Footer>
                    <Button variant="purple" className="w-full" icon="share" disabled={provisioning} onClick={onShare}>
                        {t('details.shareCta')}
                    </Button>
                </PageStack.Footer>
            )}
        </PageStack>
    )
}
