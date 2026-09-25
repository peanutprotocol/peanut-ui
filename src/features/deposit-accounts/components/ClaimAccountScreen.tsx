'use client'

import { useTranslations } from 'next-intl'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { corridorNeedsReference } from '../instructionRows'
import type { ClaimableCorridor, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositFeeLine } from './DepositFeeLine'
import { DepositRuleList } from './DepositRuleList'

/**
 * The claim step — the one screen where the user decides to hold an account.
 *
 * It sells the outcome (a real account, not a lookup) before it asks for the
 * tap: three one-line benefit rows for what the account actually buys them,
 * and the conditions — a bank's rules, not ours — held to one Callout above
 * the CTA rather than stacked into the page.
 *
 * Who may pay in is stated here, behind one closed toggle in the details
 * screen's card style, in the lines the details screen uses and through the
 * same resolver and `DepositRuleList`: the backend runs it before an account
 * exists and returns the terms as `claimable`. A user who reads
 * "anyone can pay you" only AFTER opening the account was deciding blind, and
 * on the corridors where a stranger's payment is sent back that is the one
 * fact they needed first.
 *
 * Without a `claimable` entry — an API that predates the preview — the step
 * keeps its old sentence and says the terms come with the account. It never
 * invents them.
 */
export function ClaimAccountScreen({
    rail,
    terms,
    userName,
    isClaiming,
    error,
    onContactSupport,
    isUnavailable = false,
    onClaim,
    onBack,
}: {
    rail: DepositRail
    /** the terms this corridor would carry, as the backend resolved them */
    terms?: ClaimableCorridor
    /** the name a payer reads where the account is NOT in the user's own name */
    userName: string
    isClaiming: boolean
    error?: string
    /** set where a retry alone may never clear the error, so the error also offers a person */
    onContactSupport?: () => void
    /** the backend refused to open an account for this user at all */
    isUnavailable?: boolean
    onClaim: () => void
    onBack: () => void
}) {
    const { t, arrivalShort, ruleLines } = useDepositAccountCopy()
    // "Good to know" already exists as a title for a bank's-rules-not-ours
    // aside (BalanceWarningDrawer) — reused rather than re-authored so the
    // catalog does not carry two English strings with two translations.
    const tGlobal = useTranslations('global')

    // The floor is one of these lines, and the screen states each rule once.
    const rules = terms ? ruleLines(terms.matching, terms.rules, userName) : undefined
    // The terms were resolved without one input, and only the dollar rail
    // reads it: the state on the user's residence can forbid a third-party
    // payment outright. The lines below are the rail's published terms without
    // it, so the screen names the rule still to be confirmed rather than
    // implying there is none.
    const statePending = terms?.preview === true && rail.currency === 'USD'

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('claim.heading', { currency: rail.currency })}
                    description={t('claim.subheading')}
                />

                <ListGroup>
                    <ListItem
                        leading={<IconBubble icon="wallet" size="s" color="blue" className="self-start" />}
                        title={t('claim.benefitBalance')}
                    />
                    <ListItem
                        leading={<IconBubble icon="clock" size="s" color="blue" className="self-start" />}
                        title={arrivalShort(rail.corridor)}
                    />
                    <ListItem
                        leading={<IconBubble icon="link" size="s" color="blue" className="self-start" />}
                        title={t('claim.benefitStable')}
                    />
                </ListGroup>

                {rules && (
                    <Accordion type="single" collapsible>
                        <Accordion.Item value="who-can-pay">
                            <Accordion.Trigger>{t('claim.whoCanPay')}</Accordion.Trigger>
                            <Accordion.Content className="flex flex-col gap-3">
                                <DepositRuleList lines={rules} />
                                {statePending && (
                                    <p className="text-body-xs text-foreground-secondary">{t('claim.statePending')}</p>
                                )}
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                )}
            </div>
            {/*
             * The CTA is the LAST child, and that is load-bearing rather than
             * taste. The shell reserves 6rem below the scroller to clear the
             * fixed bottom nav, and the reservation clears whatever ends the
             * page. With the Callout after it the reservation cleared the
             * Callout instead, and at 375x667 the button first painted at
             * y 602 against a nav that owns 597-667 — visibly there, 49px of it
             * behind the nav, and a tap on it switched tabs.
             */}
            <PageStack.Footer>
                {/* one Callout, max: an error the user must act on replaces
                    the general conditions rather than stacking beside them */}
                {isUnavailable ? (
                    /*
                     * Not a failure the user can retry their way out of: the
                     * rollout gate on the claim route, or a rail that is not
                     * served for them yet. Same words the corridor gate uses
                     * when it is only a wait, and never the backend's own
                     * sentence.
                     */
                    <Callout priority="attention" title={t('gate.notYetTitle')}>
                        {t('gate.notYetBody')}
                    </Callout>
                ) : error ? (
                    <Callout
                        priority="error"
                        title={t('claim.errorTitle')}
                        ctas={
                            onContactSupport ? [{ label: t('gate.supportCta'), onClick: onContactSupport }] : undefined
                        }
                    >
                        {error}
                    </Callout>
                ) : (
                    <Callout
                        priority="helper"
                        title={tGlobal('balanceWarningModal.goodToKnow')}
                        items={[
                            // what it costs, before the account is opened
                            <DepositFeeLine key="fee" rail={rail} />,
                            // A euro account is a shared SEPA one, so the IBAN can
                            // be issued in another EU country — said plainly here so
                            // a user who reached it by picking, say, France is not
                            // surprised by a non-French IBAN.
                            ...(rail.corridor === 'SEPA_EU' ? [t('claim.faqSepaShared')] : []),
                            // The terms are on the screen now, so promising
                            // them later would contradict the lines above.
                            ...(rules ? [] : [t('claim.conditionTerms', { currency: rail.currency })]),
                            // "No reference to remember" was promised on every
                            // corridor, and the Colombian account is credited
                            // by key AND reference: a transfer without it is
                            // not matched. Each corridor states its own rule.
                            corridorNeedsReference(rail.corridor)
                                ? t('claim.conditionReference')
                                : t('claim.conditionNoReference'),
                        ]}
                    />
                )}
                {!isUnavailable && (
                    <Button
                        variant="primary"
                        className="w-full"
                        loading={isClaiming}
                        disabled={isClaiming}
                        onClick={onClaim}
                    >
                        {t('claim.cta', { currency: rail.currency })}
                    </Button>
                )}
            </PageStack.Footer>
        </PageStack>
    )
}
