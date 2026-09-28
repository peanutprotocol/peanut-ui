'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { instructionRows } from '../instructionRows'
import type { DepositRuleKey } from '../ruleLines'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DepositFeeLine } from './DepositFeeLine'
import { DepositRuleList, RuleWithInfo } from './DepositRuleList'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositShareActions } from './DepositShareActions'

/**
 * Rules that limit the holder's OWN use of the account. Every other rule is
 * about third-party payers and waits behind the toggle; these decide whether
 * the account works for the user at all, so they stay beside the card.
 */
const GATE_RULE_KEYS: ReadonlySet<DepositRuleKey> = new Set<DepositRuleKey>([
    'ownName',
    'stateRestricted',
    'ownAccountNo',
])

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
    const { t, rowLabels, railLabels, arrivalDetail, accountRailName, ruleLines } = useDepositAccountCopy()

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

    const provisioning = account.status === 'provisioning'
    // The heading names this account's own rails, so the card does not repeat them.
    const rows = account.instructions
        ? instructionRows(account.instructions, rowLabels, railLabels).filter((row) => row.key !== 'accepts')
        : []
    const rules = ruleLines(account.matching, account.rules, userName)
    const gateRules = rules.filter((rule) => GATE_RULE_KEYS.has(rule.key))
    const termRules = rules.filter((rule) => !GATE_RULE_KEYS.has(rule.key))

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('details.heading', {
                        currency: rail.currency,
                        rail: accountRailName(rail.corridor, account.instructions),
                    })}
                    description={provisioning ? t('details.provisioning') : undefined}
                />

                {provisioning ? (
                    <DepositDetailsSkeleton rows={rail.detailRowCount} />
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            <DepositDetailsCard rows={rows} />
                            {/* Only a line that decides whether a transfer lands at
                                all stays outside the toggle: a transfer without the
                                reference is not matched, and an own-name-only rule
                                decides who can use the account. */}
                            {account.instructions?.depositMessage && (
                                <p className="text-body-xs text-foreground-secondary">
                                    {t('details.referenceRequired')}
                                </p>
                            )}
                            {gateRules.map((rule) => (
                                // a div, not a p: the (i) renders a div of its own
                                <div key={rule.key} className="text-body-xs text-foreground-secondary">
                                    <RuleWithInfo text={rule.text} why={rule.why} />
                                </div>
                            ))}
                        </div>

                        {/* Everything a holder reads once and a payer never needs
                            stays one tap away, so the numbers are the screen. */}
                        <Accordion type="single" collapsible>
                            <Accordion.Item value="terms">
                                <Accordion.Trigger>{t('details.termsToggle')}</Accordion.Trigger>
                                <Accordion.Content className="flex flex-col gap-3">
                                    {termRules.length > 0 && <DepositRuleList lines={termRules} />}
                                    <p className="text-body-xs text-foreground-secondary">
                                        <DepositFeeLine rail={rail} />
                                    </p>
                                    <p className="text-body-xs text-foreground-secondary">
                                        {arrivalDetail(rail.corridor)}
                                    </p>
                                </Accordion.Content>
                            </Accordion.Item>
                        </Accordion>
                    </>
                )}
            </div>

            {/* Keep both sharing actions behind the same eligibility check. */}
            {canShare && <DepositShareActions rail={rail} account={account} userName={userName} />}
        </PageStack>
    )
}
