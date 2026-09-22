'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { instructionRows } from '../instructionRows'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DepositFeeLine } from './DepositFeeLine'
import { DepositRuleList } from './DepositRuleList'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositShareActions } from './DepositShareActions'

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
    const { t, rowLabels, railLabels, arrivalDetail, railName, ruleLines } = useDepositAccountCopy()

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
                    <Button variant="primary" className="w-full" onClick={onRetry}>
                        {t('details.timedOutRetry')}
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={onBack}>
                        {t('details.unavailableCta')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    const provisioning = account.status === 'provisioning'
    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const rules = ruleLines(account.matching, account.rules, userName)

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('details.heading', { currency: rail.currency, rail: railName(rail.corridor) })}
                    description={
                        provisioning
                            ? t('details.provisioning', { currency: rail.currency })
                            : arrivalDetail(rail.corridor)
                    }
                />

                {provisioning ? (
                    <DepositDetailsSkeleton rows={rail.detailRowCount} />
                ) : (
                    <>
                        <Section title={t('details.sectionTitle')}>
                            <DepositDetailsCard rows={rows} />
                            {/* The reference row is one more field to copy; that
                                the transfer is not matched without it is the
                                fact the holder has to pass on. */}
                            {account.instructions?.depositMessage && (
                                <p className="text-body-xs text-foreground-secondary">
                                    {t('details.referenceRequired')}
                                </p>
                            )}
                            {/* what the conversion costs, beside the details it applies to */}
                            <p className="text-body-xs text-foreground-secondary">
                                <DepositFeeLine rail={rail} />
                            </p>
                        </Section>

                        <Section title={t('details.whoCanPay')}>
                            <DepositRuleList lines={rules} />
                            {/* EUR is offered to anyone, and the one third-party
                                SEPA transfer seen so far came back as a
                                third-party payment. Until a third-party credit
                                is proven the holder is told what to ask of a
                                payer, beside the terms that say anyone may pay. */}
                            {rail.corridor === 'SEPA_EU' && (
                                <p className="text-body-xs text-foreground-secondary">{t('details.eurOwnName')}</p>
                            )}
                        </Section>
                    </>
                )}
            </div>

            {/* Keep both sharing actions behind the same eligibility check. */}
            {canShare && <DepositShareActions rail={rail} account={account} userName={userName} />}
        </PageStack>
    )
}
