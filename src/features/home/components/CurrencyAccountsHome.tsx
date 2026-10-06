'use client'

import { useState, type ReactNode, type ComponentProps } from 'react'
import { useAuth } from '@/context/authContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useCurrencyAccounts, useEurcBalance } from '@/hooks/wallet/useCurrencyAccounts'
import { BalanceSection } from '../views/BalanceSection'
import { Icon } from '@/components/Global/Icons/Icon'
import { AccountType } from '@/interfaces/interfaces'

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
            {showSelector && (
                <div className="flex items-center justify-center gap-2" role="group" aria-label={t('accounts')}>
                    <button
                        type="button"
                        aria-pressed={!isEurc}
                        onClick={() => setSelected('USDC')}
                        className="min-h-11 rounded-full border border-border-default px-4 aria-pressed:bg-action-primary"
                    >
                        {'USD · USDC'}
                    </button>
                    {eurcAccount && (
                        <button
                            type="button"
                            aria-pressed={isEurc}
                            onClick={() => setSelected('EURC')}
                            className="min-h-11 rounded-full border border-border-default px-4 aria-pressed:bg-action-primary"
                        >
                            {'EUR · EURC'}
                        </button>
                    )}
                    {canAdd && (
                        <button
                            type="button"
                            aria-label={t('addAccount')}
                            aria-expanded={isAdding}
                            disabled={accounts.add.isPending}
                            onClick={() => {
                                accounts.add.reset()
                                setIsAdding((open) => !open)
                            }}
                            className="flex size-11 items-center justify-center rounded-full border border-border-default"
                        >
                            <Icon name="plus" size={20} />
                        </button>
                    )}
                </div>
            )}
            {isAdding && canAdd && (
                <section
                    className="flex flex-col gap-3 rounded-xl border border-border-default p-4"
                    aria-label={t('addEurc')}
                >
                    <h2 className="font-bold">{t('addEurc')}</h2>
                    <p>{t('description')}</p>
                    <p className="text-sm">{t('availability')}</p>
                    {accounts.add.isError && <p role="alert">{t('addError')}</p>}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={addEurc}
                            disabled={accounts.add.isPending}
                            className="min-h-11 rounded-full bg-action-primary px-4 disabled:opacity-50"
                        >
                            {accounts.add.isPending ? t('adding') : t('addEurc')}
                        </button>
                        <button
                            type="button"
                            disabled={accounts.add.isPending}
                            onClick={() => setIsAdding(false)}
                            className="min-h-11 px-4"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </section>
            )}
            {isEurc ? (
                <>
                    {eurcBalance.isError && eurcBalance.data === undefined ? (
                        <div className="flex flex-col items-center gap-2" role="alert">
                            <p>{t('balanceError')}</p>
                            <button type="button" onClick={() => void eurcBalance.refetch()} className="min-h-11 px-4">
                                {t('retry')}
                            </button>
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
                    <section className="flex flex-col gap-3 rounded-xl border border-border-default p-4">
                        <h2 className="font-bold">{t('eurcAccount')}</h2>
                        <p>{t('description')}</p>
                        <p>{t('availability')}</p>
                    </section>
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
