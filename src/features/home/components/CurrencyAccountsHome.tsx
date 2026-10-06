'use client'

import { useEffect, useState, type ReactNode, type ComponentProps } from 'react'
import { useAuth } from '@/context/authContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useCurrencyAccounts, useEurcBalance } from '@/hooks/wallet/useCurrencyAccounts'
import { BalanceSection } from '../views/BalanceSection'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { AccountType } from '@/interfaces/interfaces'
import { EurcAccountView } from './EurcAccountView'

type Props = { balanceProps: ComponentProps<typeof BalanceSection>; children: ReactNode }

export function CurrencyAccountsHome(props: Props) {
    const { userId, user } = useAuth()
    const walletAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
    // A different login gets a fresh default selection and no stale dialogs.
    return (
        <CurrencyAccountsHomeSession
            key={`${userId}:${walletAddress}`}
            userId={walletAddress ? userId : undefined}
            {...props}
        />
    )
}

function CurrencyAccountsHomeSession({ userId, balanceProps, children }: Props & { userId: string | undefined }) {
    const t = useAppTranslations('currencyAccounts')
    const [selected, setSelected] = useState<'USDC' | 'EURC'>('USDC')
    const [isAdding, setIsAdding] = useState(false)
    const accounts = useCurrencyAccounts(userId)
    const eurcAccount = accounts.data?.accounts.find((account) => account.asset === 'EURC')
    const eurcAccountId = eurcAccount?.id
    useEffect(() => {
        if (eurcAccountId && new URLSearchParams(window.location.search).get('currency') === 'EURC') setSelected('EURC')
    }, [eurcAccountId])
    const canAdd = !eurcAccount && (accounts.data?.available.some((asset) => asset.asset === 'EURC') ?? false)
    const isEurc = selected === 'EURC' && !!eurcAccount
    const eurcBalance = useEurcBalance(userId, isEurc ? eurcAccount : undefined)
    const showSelector = !!eurcAccount || canAdd

    const addEurc = async () => {
        if (!userId || accounts.add.isPending) return
        try {
            await accounts.add.mutateAsync(userId)
            setSelected('EURC')
            setIsAdding(false)
        } catch {
            // Keep the confirmation open with a localized, retryable error.
        }
    }

    return (
        <>
            {accounts.isError && (
                <div role="alert" className="flex flex-col items-center gap-2">
                    <p>{t('accountsError')}</p>
                    <Button variant="ghost" onClick={() => void accounts.refetch()}>
                        {t('retry')}
                    </Button>
                </div>
            )}
            {showSelector && (
                <div className="flex items-center justify-center gap-2" role="group" aria-label={t('accounts')}>
                    <Tabs
                        aria-label={t('accounts')}
                        value={isEurc ? 'EURC' : 'USDC'}
                        onValueChange={(value) => setSelected(value === 'EURC' ? 'EURC' : 'USDC')}
                        tabs={[
                            { value: 'USDC', label: 'USD · USDC' },
                            ...(eurcAccount ? [{ value: 'EURC', label: 'EUR · EURC' }] : []),
                        ]}
                    />
                    {canAdd && (
                        <Button
                            type="button"
                            aria-label={t('addAccount')}
                            aria-expanded={isAdding}
                            disabled={accounts.add.isPending}
                            onClick={() => {
                                accounts.add.reset()
                                setIsAdding((open) => !open)
                            }}
                            variant="secondary"
                            shape="square"
                            size="medium"
                            className="shrink-0"
                            icon="plus"
                        />
                    )}
                </div>
            )}
            {isAdding && canAdd && (
                <Card className="gap-3 p-4" role="region" aria-label={t('addEurc')}>
                    <h2 className="text-heading-card">{t('addEurc')}</h2>
                    <p>{t('description')}</p>
                    <p className="text-body-s">{t('availability')}</p>
                    {accounts.add.isError && <p role="alert">{t('addError')}</p>}
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            onClick={addEurc}
                            disabled={accounts.add.isPending}
                            loading={accounts.add.isPending}
                        >
                            {accounts.add.isPending ? t('adding') : t('addEurc')}
                        </Button>
                        <Button
                            type="button"
                            disabled={accounts.add.isPending}
                            onClick={() => setIsAdding(false)}
                            variant="ghost"
                        >
                            {t('cancel')}
                        </Button>
                    </div>
                </Card>
            )}
            {isEurc ? (
                <>
                    {eurcBalance.isError && eurcBalance.data === undefined ? (
                        <div className="flex flex-col items-center gap-2" role="alert">
                            <p>{t('balanceError')}</p>
                            <Button type="button" variant="ghost" onClick={() => void eurcBalance.refetch()}>
                                {t('retry')}
                            </Button>
                        </div>
                    ) : (
                        <BalanceSection
                            {...balanceProps}
                            currencySymbol="€"
                            decimals={6}
                            balance={eurcBalance.data}
                            isFetching={eurcBalance.isPending}
                            isStale={eurcBalance.isError}
                            actions={null}
                        />
                    )}
                    <Card className="gap-3 p-4">
                        <h2 className="text-heading-card">{t('eurcAccount')}</h2>
                        <p>{t('description')}</p>
                        <p>{t('availability')}</p>
                    </Card>
                    <EurcAccountView userId={userId!} account={eurcAccount!} />
                </>
            ) : (
                <>
                    <BalanceSection {...balanceProps} />
                    {children}
                </>
            )}
        </>
    )
}
