'use client'

import { useEffect, useState } from 'react'
import { useQueryStates } from 'nuqs'
import ActionModal from '@/components/Global/ActionModal/index'
import { Callout } from '@/components/0_Bruddle/Callout'
import { currencyAccountParsers } from '@/utils/currency-account-url'
import type { CurrencyAccountsHomeProps } from './currency-account.types'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useCurrencyAccounts, useEurcBalance } from '@/hooks/wallet/useCurrencyAccounts'
import { BalanceSection } from '../views/BalanceSection'
import { Button } from '@/components/0_Bruddle/Button'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { EurcAccountView } from './EurcAccountView'

export function CurrencyAccountsHomeSession({
    userId,
    balanceProps,
    children,
    resetUrl,
}: CurrencyAccountsHomeProps & { userId: string | undefined; resetUrl: boolean }) {
    const t = useAppTranslations('currencyAccounts')
    const [url, setUrl] = useQueryStates(currencyAccountParsers)
    const [resetting, setResetting] = useState(resetUrl)
    const selected = resetting ? 'USDC' : url.currency
    const setSelected = (currency: 'USDC' | 'EURC') => void setUrl({ currency })
    const [isAdding, setIsAdding] = useState(false)
    const accounts = useCurrencyAccounts(userId)
    const eurcAccount = accounts.data?.accounts.find((account) => account.asset === 'EURC')
    useEffect(() => {
        if (!resetUrl) return
        void setUrl({ currency: null, action: null, operation: null }).then(() => setResetting(false))
    }, [resetUrl, setUrl])
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
                <Callout priority="error">
                    <p>{t('accountsError')}</p>
                    <Button variant="ghost" onClick={() => void accounts.refetch()}>
                        {t('retry')}
                    </Button>
                </Callout>
            )}
            {showSelector && (
                <div className="flex items-center justify-center gap-2" role="group" aria-label={t('accounts')}>
                    <Tabs
                        aria-label={t('accounts')}
                        value={isEurc ? 'EURC' : 'USDC'}
                        onValueChange={(value) => setSelected(value === 'EURC' ? 'EURC' : 'USDC')}
                        tabs={[
                            { value: 'USDC', label: 'USD' },
                            ...(eurcAccount ? [{ value: 'EURC', label: 'EUR' }] : []),
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
                <ActionModal
                    visible
                    title={t('addEurc')}
                    description={t('availability')}
                    onClose={() => setIsAdding(false)}
                    preventClose={accounts.add.isPending}
                    content={accounts.add.isError ? <Callout priority="error">{t('addError')}</Callout> : undefined}
                    ctas={[
                        {
                            text: accounts.add.isPending ? t('adding') : t('addEurc'),
                            onClick: addEurc,
                            disabled: accounts.add.isPending,
                            loading: accounts.add.isPending,
                        },
                    ]}
                    tertiaryCta={{
                        text: t('cancel'),
                        onClick: () => setIsAdding(false),
                        disabled: accounts.add.isPending,
                    }}
                />
            )}
            {isEurc ? (
                <>
                    {eurcBalance.isError && eurcBalance.data === undefined ? (
                        <Callout priority="error">
                            <p>{t('balanceError')}</p>
                            <Button type="button" variant="ghost" onClick={() => void eurcBalance.refetch()}>
                                {t('retry')}
                            </Button>
                        </Callout>
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
                    {!url.action && !url.operation && <h2 className="text-heading-card">{t('eurcAccount')}</h2>}
                    <EurcAccountView userId={userId!} account={eurcAccount!} state={url} onStateChange={setUrl} />
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
