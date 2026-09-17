'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { Notification } from '@/components/0_Bruddle/Notification'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { canShare, isHeld } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function HeldDepositAccounts() {
    return useDepositAccountsEnabled() ? <HeldAccounts /> : null
}

function HeldAccounts() {
    const { accounts, gates, isLoading, isError, refetch } = useDepositAccounts()
    const { t, railName } = useDepositAccountCopy()
    const tProfile = useTranslations('profile.unlockPayments')
    const router = useRouter()
    const held = DEPOSIT_RAIL_ORDER.filter((corridor) => isHeld(accounts[corridor]))

    if (isLoading || (!isError && held.length === 0)) return null

    return (
        <Section title={tProfile('accountsTitle')}>
            <p className="text-body-s text-foreground-secondary">{tProfile('accountsSubtitle')}</p>
            {isError ? (
                <Notification priority="error" ctas={[{ label: t('list.errorRetry'), onClick: refetch }]}>
                    {t('list.errorBody')}
                </Notification>
            ) : (
                <ListGroup>
                    {held.map((corridor) => (
                        <ListItem
                            key={corridor}
                            title={`${DEPOSIT_RAILS[corridor].currency} · ${railName(corridor)}`}
                            trailing={
                                canShare(accounts[corridor], gates[corridor]) ? (
                                    <StatusBadge status="completed" customText={t('list.badgeReady')} />
                                ) : undefined
                            }
                            chevron
                            onClick={() =>
                                router.push(
                                    withReturnTo(
                                        `/add-money?method=bank&step=details&corridor=${corridor}`,
                                        '/profile/identity-verification'
                                    )
                                )
                            }
                        />
                    ))}
                </ListGroup>
            )}
        </Section>
    )
}
