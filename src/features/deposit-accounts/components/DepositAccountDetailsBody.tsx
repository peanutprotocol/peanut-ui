'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { instructionRows } from '../instructionRows'
import type { DepositRuleKey } from '../ruleLines'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositFeeLine } from './DepositFeeLine'
import { DepositRuleList, RuleWithInfo } from './DepositRuleList'

/**
 * Rules that limit the holder's OWN use of the account. Every other rule is
 * about third-party payers and waits behind the toggle; these decide whether
 * the account works for the user at all, so they stay beside the card. The
 * minimum is one of them: a smaller deposit is neither added nor returned
 * (TASK-23245).
 */
const GATE_RULE_KEYS: ReadonlySet<DepositRuleKey> = new Set<DepositRuleKey>([
    'ownName',
    'stateRestricted',
    'ownAccountNo',
    'minimum',
])

/**
 * One account's details as its holder reads them: heading, the numbers (or
 * their skeleton while the provider opens the account), the lines that decide
 * whether a transfer lands, and the terms behind a toggle. Extracted from the
 * details screen so the card's add-money drawer (ui#4279, TASK-25169) renders
 * the same body and the two never disagree. The caller owns the revoked and
 * timed-out states, which have no details.
 */
export function DepositAccountDetailsBody({
    rail,
    account,
    userName,
}: {
    rail: DepositRail
    account: DepositAccountView
    /** the name a payer reads when the account is NOT in the user's own name */
    userName: string
}) {
    const { t, rowLabels, railLabels, arrivalDetail, accountRailName, ruleLines } = useDepositAccountCopy()
    const bridgeProviderId = useBridgeProviderId()

    const provisioning = account.status === 'provisioning'
    // The heading names this account's own rails, so the card does not repeat them.
    const rows = account.instructions
        ? instructionRows(account.instructions, rowLabels, railLabels).filter((row) => row.key !== 'accepts')
        : []
    const rules = ruleLines(account.matching, account.rules, userName)
    const gateRules = rules.filter((rule) => GATE_RULE_KEYS.has(rule.key))
    const termRules = rules.filter((rule) => !GATE_RULE_KEYS.has(rule.key))

    return (
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
                        <DepositDetailsCard
                            rows={rows}
                            providerId={rail.provider === 'bridge' ? bridgeProviderId : null}
                        />
                        {/* Only a line that decides whether a transfer lands at
                            all stays outside the toggle: a transfer without the
                            reference is not matched, and an own-name-only rule
                            decides who can use the account. */}
                        {account.instructions?.depositMessage && (
                            <p className="text-body-xs text-foreground-secondary">{t('details.referenceRequired')}</p>
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
                                <p className="text-body-xs text-foreground-secondary">{arrivalDetail(rail.corridor)}</p>
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                </>
            )}
        </div>
    )
}
