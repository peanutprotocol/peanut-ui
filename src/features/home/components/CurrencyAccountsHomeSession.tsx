'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import ActionModal from '@/components/Global/ActionModal/index'
import { Callout } from '@/components/0_Bruddle/Callout'
import { currencyAccountParsers } from '@/utils/currency-account-url'
import type { CurrencyAccountsHomeProps } from './currency-account.types'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useCurrencyAccounts, useEurcBalance, useEureBalance } from '@/hooks/wallet/useCurrencyAccounts'
import { BalanceSection } from '../views/BalanceSection'
import { Button } from '@/components/0_Bruddle/Button'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { EurcAccountView } from './EurcAccountView'
import { MoneriumAccountView } from './MoneriumAccountView'
import { MoneriumOnboardingView } from './MoneriumOnboardingView'
import { moneriumApi, type MoneriumOnboarding } from '@/services/monerium'
import { currencyOperationSession, assertCurrencyOperationSession } from '@/utils/currency-operation-recovery'

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
    const setSelected = (currency: 'USDC' | 'EURC' | 'EURE') => void setUrl({ currency })
    const [isAdding, setIsAdding] = useState(false)
    const [checkingEligibility, setCheckingEligibility] = useState(false)
    const addLock = useRef(false)
    const [onboarding, setOnboarding] = useState<MoneriumOnboarding | null>(null)
    const [onboardingDone, setOnboardingDone] = useState(false)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const accounts = useCurrencyAccounts(userId)
    const { refetch: refetchAccounts } = accounts
    const eurcAccount = accounts.data?.accounts.find((account) => account.asset === 'EURE' || account.asset === 'EURC')
    const eligibility = useQuery({
        queryKey: ['monerium-onboarding', userId],
        queryFn: ({ signal }) => moneriumApi.onboarding(signal),
        enabled: !!userId && accounts.isSuccess && !eurcAccount,
        retry: false,
        staleTime: 30_000,
    })
    useEffect(() => {
        if (!resetUrl) return
        void setUrl({ currency: null, action: null, operation: null }).then(() => setResetting(false))
    }, [resetUrl, setUrl])
    const canAdd =
        !eurcAccount &&
        ((accounts.data?.available.some((asset) => asset.asset === 'EURC') ?? false) ||
            (!!eligibility.data && eligibility.data.nextStep !== 'unavailable'))
    const isEurc = (selected === 'EURC' || selected === 'EURE') && !!eurcAccount
    const isMonerium = eurcAccount?.asset === 'EURE'
    const baseBalance = useEurcBalance(userId, isEurc && !isMonerium ? eurcAccount : undefined)
    const arbitrumBalance = useEureBalance(userId, isEurc && isMonerium ? eurcAccount : undefined)
    const eurcBalance = isMonerium ? arbitrumBalance : baseBalance
    const showSelector = !!eurcAccount || canAdd
    useEffect(() => {
        if (!onboardingDone || eurcAccount?.asset !== 'EURE') return
        void setUrl({ currency: 'EURE', action: null, operation: null })
        setOnboarding(null)
        setOnboardingDone(false)
    }, [onboardingDone, eurcAccount?.asset, setUrl])
    const refreshMoneriumAccount = useCallback(() => {
        setOnboardingDone(true)
        void refetchAccounts()
    }, [refetchAccounts])

    const addEurc = async () => {
        if (!userId || accounts.add.isPending || addLock.current) return
        addLock.current = true
        setCheckingEligibility(true)
        const version = currencyOperationSession(userId)
        try {
            // A failed or unavailable eligibility read explicitly keeps the
            // established EURC path. No provider mutation is retried here.
            const result = await eligibility.refetch()
            assertCurrencyOperationSession(userId, version)
            if (!mounted.current) return
            if (result.isSuccess && result.data.nextStep !== 'unavailable') {
                setOnboarding(result.data)
                setIsAdding(false)
                return
            }
            await accounts.add.mutateAsync(userId)
            assertCurrencyOperationSession(userId, version)
            if (!mounted.current) return
            setSelected('EURC')
            setIsAdding(false)
        } catch {
            // Keep the confirmation open with a localized, retryable error.
        } finally {
            addLock.current = false
            if (mounted.current) setCheckingEligibility(false)
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
                        onValueChange={(value) => {
                            setOnboarding(null)
                            setOnboardingDone(false)
                            setSelected(value === 'EURC' ? 'EURC' : 'USDC')
                        }}
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
                            disabled={accounts.add.isPending || checkingEligibility}
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
                    preventClose={accounts.add.isPending || checkingEligibility}
                    content={accounts.add.isError ? <Callout priority="error">{t('addError')}</Callout> : undefined}
                    ctas={[
                        {
                            text: accounts.add.isPending ? t('adding') : t('addEurc'),
                            onClick: addEurc,
                            disabled: accounts.add.isPending || checkingEligibility,
                            loading: accounts.add.isPending || checkingEligibility,
                        },
                    ]}
                    tertiaryCta={{
                        text: t('cancel'),
                        onClick: () => setIsAdding(false),
                        disabled: accounts.add.isPending || checkingEligibility,
                    }}
                />
            )}
            {onboarding && userId && !isEurc ? (
                <MoneriumOnboardingView
                    userId={userId}
                    initial={onboarding}
                    onClose={() => setOnboarding(null)}
                    onDone={refreshMoneriumAccount}
                />
            ) : isEurc ? (
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
                            decimals={isMonerium ? 18 : 6}
                            balance={eurcBalance.data}
                            isFetching={eurcBalance.isPending}
                            isStale={eurcBalance.isError}
                            actions={null}
                        />
                    )}
                    {!url.action && !url.operation && <h2 className="text-heading-card">{t('eurcAccount')}</h2>}
                    {isMonerium ? (
                        <MoneriumAccountView userId={userId!} state={url} onStateChange={setUrl} />
                    ) : (
                        <EurcAccountView userId={userId!} account={eurcAccount!} state={url} onStateChange={setUrl} />
                    )}
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
