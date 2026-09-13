'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { instructionRows } from '../instructionRows'
import { isShareable } from '../rails'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DepositRuleList } from './DepositRuleList'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'

/**
 * The per-amount bank deposit that predates standing accounts: pick a country,
 * name an amount, get details valid for that one payment. It is the only path
 * that can check an amount against the user's limits before the money moves.
 */
const ONE_OFF_TRANSFER_HREF = '/add-money?method=bank'

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
    onBack,
    onShare,
    onRetry,
}: {
    rail: DepositRail
    account: DepositAccountView
    /** the name a payer reads when the account is NOT in the user's own name */
    userName: string
    onBack: () => void
    onShare: () => void
    onRetry: () => void
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
                            <Button variant="stroke" size="small" onClick={onBack}>
                                {t('details.unavailableCta')}
                            </Button>
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
                    <Button variant="purple" className="w-full" onClick={onRetry}>
                        {t('details.timedOutRetry')}
                    </Button>
                    <Button variant="transparent" className="w-full" onClick={onBack}>
                        {t('details.unavailableCta')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    const provisioning = account.status === 'provisioning'
    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const ownNameOnly = account.matching.sender === 'own-name-only'
    const shareable = isShareable(account.matching.sender)
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
                        </Section>

                        <Section title={t('details.whoCanPay')}>
                            <DepositRuleList lines={rules} />
                        </Section>

                        {/*
                         * The one-off transfer flow, kept and reachable. A
                         * standing account takes any amount, which also means
                         * nothing checks the amount against the user's limits
                         * before the money moves. Naming a figure first is the
                         * only way to see that a deposit would exceed them, so
                         * the older flow stays the answer for a large or
                         * first-time transfer rather than being retired.
                         */}
                        {!ownNameOnly && (
                            <LinkButton href={ONE_OFF_TRANSFER_HREF}>{t('details.exactAmountCta')}</LinkButton>
                        )}
                    </>
                )}
            </div>

            {shareable && (
                <PageStack.Footer>
                    <Button variant="purple" className="w-full" icon="share" disabled={provisioning} onClick={onShare}>
                        {t('details.shareCta')}
                    </Button>
                </PageStack.Footer>
            )}
        </PageStack>
    )
}
