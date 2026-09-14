'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import type { DepositDetailRow, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'

/**
 * The claim step — the one screen where the user decides to hold an account.
 *
 * It sells the outcome (a real account, not a lookup) before it asks for the
 * tap: a preview of the details card so the shape is not a surprise, three
 * benefit rows for what the account actually buys them, and the conditions
 * — a bank's rules, not ours — held to one Notification above the CTA rather
 * than stacked into the page.
 *
 * Who may pay in is a condition here, not a benefit: the rules travel on the
 * account, and no account exists yet, so this step can only say that the terms
 * are coming. It says so with the other conditions rather than
 * spending a benefit row on a sentence that promises nothing.
 */
export function ClaimAccountScreen({
    rail,
    isClaiming,
    error,
    isUnavailable = false,
    onClaim,
    onBack,
}: {
    rail: DepositRail
    isClaiming: boolean
    error?: string
    /** the backend refused to open an account for this user at all */
    isUnavailable?: boolean
    onClaim: () => void
    onBack: () => void
}) {
    const { t, rowLabels, arrivalDetail } = useDepositAccountCopy()
    // "Good to know" already exists as a title for a bank's-rules-not-ours
    // aside (BalanceWarningDrawer) — reused rather than re-authored so the
    // catalog does not carry two English strings with two translations.
    const tGlobal = useTranslations('global')

    // A sample of the shape the real card will have, never real numbers: the
    // backend only returns instructions once the account exists, so anything
    // more specific here would be a promise the claim has not made yet. The
    // account holder is left out for the same reason — on a provider-held
    // corridor the name is our banking partner, not the user's.
    const previewRows: DepositDetailRow[] = [
        { key: 'accountNumber', label: rowLabels.accountNumber, value: '•••• •••• 4821', copyable: false },
    ]

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('claim.heading', { currency: rail.currency })}
                    description={t('claim.subheading')}
                />

                <Section title={t('claim.previewTitle')}>
                    <DepositDetailsCard rows={previewRows} />
                    <p className="text-body-xs text-foreground-secondary">{t('claim.previewCaption')}</p>
                </Section>

                {/*
                 * `title` is a plain string here on purpose, wrapped in a span:
                 * ListItem truncates a bare string title to one line, and these
                 * are full sentences, not row labels.
                 */}
                <ListGroup>
                    <ListItem
                        leading={<Icon name="wallet" size={24} className="text-foreground-primary" />}
                        title={<span>{t('claim.benefitBalance')}</span>}
                    />
                    <ListItem
                        leading={<Icon name="clock" size={24} className="text-foreground-primary" />}
                        title={<span>{arrivalDetail(rail.corridor)}</span>}
                    />
                    <ListItem
                        leading={<Icon name="link" size={24} className="text-foreground-primary" />}
                        title={<span>{t('claim.benefitStable')}</span>}
                    />
                </ListGroup>
            </div>
            {/*
             * The CTA is the LAST child, and that is load-bearing rather than
             * taste. The shell reserves 6rem below the scroller to clear the
             * fixed bottom nav, and the reservation clears whatever ends the
             * page. With the Notification after it the reservation cleared the
             * Notification instead, and at 375x667 the button first painted at
             * y 602 against a nav that owns 597-667 — visibly there, 49px of it
             * behind the nav, and a tap on it switched tabs.
             */}
            <PageStack.Footer>
                {/* one Notification, max: an error the user must act on replaces
                    the general conditions rather than stacking beside them */}
                {isUnavailable ? (
                    /*
                     * Not a failure the user can retry their way out of: the
                     * rollout gate on the claim route, or a rail that is not
                     * served for them yet. Same words the corridor gate uses
                     * when it is only a wait, and never the backend's own
                     * sentence.
                     */
                    <Notification priority="attention" title={t('gate.notYetTitle')}>
                        {t('gate.notYetBody')}
                    </Notification>
                ) : error ? (
                    <Notification priority="error" title={t('claim.errorTitle')}>
                        {error}
                    </Notification>
                ) : (
                    <Notification
                        priority="helper"
                        title={tGlobal('balanceWarningModal.goodToKnow')}
                        items={[
                            t('claim.conditionTerms', { currency: rail.currency }),
                            t('claim.conditionNoReference'),
                        ]}
                    />
                )}
                <Button
                    variant="purple"
                    className="w-full"
                    loading={isClaiming}
                    disabled={isClaiming}
                    onClick={onClaim}
                >
                    {t('claim.cta', { currency: rail.currency })}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
