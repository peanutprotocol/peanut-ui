'use client'

import { EURC_WALLET_CONFIGURED } from '@/constants/currency-accounts.consts'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'
import type { CurrencyAccountFlowState } from './currency-account.types'
import { useState } from 'react'
import Loading from '@/components/Global/Loading'
import { mergeCurrencyHistory } from '@/utils/currency-history'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Card } from '@/components/0_Bruddle/Card'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyAccount, type CurrencyOperation } from '@/services/currency-accounts'
import { EurcMoneyFormView } from './EurcMoneyFormView'
import { EurcReceiveView } from './EurcReceiveView'
import { EurcMoneyProgressView } from './EurcMoneyProgressView'

export function EurcAccountView({
    userId,
    account,
    state,
    onStateChange,
}: {
    userId: string
    account: CurrencyAccount
    state: CurrencyAccountFlowState
    onStateChange: (state: Partial<CurrencyAccountFlowState>) => Promise<URLSearchParams>
}) {
    const t = useAppTranslations('currencyAccounts')
    const { action, operation: operationId } = state
    const [closing, setClosing] = useState(false)
    const client = useQueryClient()
    const setAction = (action: 'RECEIVE' | 'SEND' | 'EXCHANGE' | 'BANK_DEPOSIT' | 'BANK_WITHDRAW') =>
        void onStateChange({ action })
    const openOperation = (operation: CurrencyOperation) => {
        client.setQueryData(['currency-operation', userId, operation.id], operation)
        void onStateChange({ operation: operation.id, action: null })
    }
    const capabilities = useQuery({
        queryKey: ['currency-capabilities', userId],
        queryFn: currencyAccountsApi.capabilities,
        retry: 1,
    })
    const walletConfigured = EURC_WALLET_CONFIGURED || isDemoMode() || !!peekActiveFixture()
    const history = useInfiniteQuery({
        queryKey: ['currency-history', userId],
        queryFn: ({ pageParam, signal }) => currencyAccountsApi.history(pageParam, signal),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page) => (page.hasMore && page.cursor ? page.cursor : undefined),
        refetchInterval: 15_000,
        retry: 1,
    })
    const activity = mergeCurrencyHistory(history.data?.pages)
    const close = async () => {
        setClosing(true)
        await onStateChange({ action: null, operation: null })
        setClosing(false)
        void history.refetch()
    }
    if (closing) return <Loading />
    if (operationId)
        return <EurcMoneyProgressView key={operationId} userId={userId} operationId={operationId} onClose={close} />
    if (action === 'RECEIVE') return <EurcReceiveView account={account} onClose={close} />
    if (action) return <EurcMoneyFormView userId={userId} kind={action} onPrepared={openOperation} onClose={close} />
    return (
        <div className="flex flex-col gap-4">
            {capabilities.isError || !walletConfigured ? (
                <Callout priority="error">
                    <p>{t('actionsError')}</p>
                    <Button variant="ghost" onClick={() => void capabilities.refetch()}>
                        {t('retry')}
                    </Button>
                </Callout>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {capabilities.data?.receive && (
                        <Button variant="secondary" onClick={() => setAction('RECEIVE')}>
                            {t('receive')}
                        </Button>
                    )}
                    {capabilities.data?.send && (
                        <Button variant="secondary" onClick={() => setAction('SEND')}>
                            {t('send')}
                        </Button>
                    )}
                    {capabilities.data?.exchange && (
                        <Button variant="secondary" onClick={() => setAction('EXCHANGE')}>
                            {t('exchange')}
                        </Button>
                    )}
                    {capabilities.data?.bankDeposit && (
                        <Button variant="secondary" onClick={() => setAction('BANK_DEPOSIT')}>
                            {t('bankDeposit')}
                        </Button>
                    )}
                    {capabilities.data?.bankWithdraw && (
                        <Button variant="secondary" onClick={() => setAction('BANK_WITHDRAW')}>
                            {t('bankWithdraw')}
                        </Button>
                    )}
                </div>
            )}
            <h2 className="text-heading-card">{t('activity')}</h2>
            {history.isError && (
                <Callout priority="error">
                    <p>{t('historyError')}</p>
                    <Button variant="ghost" onClick={() => void history.refetch()}>
                        {t('retry')}
                    </Button>
                </Callout>
            )}
            {activity.operations.map((op) => (
                <Button key={op.id} variant="secondary" onClick={() => openOperation(op)}>
                    {op.amount} {op.sourceAsset} ·{' '}
                    {t(
                        op.status === 'COMPLETED'
                            ? 'completed'
                            : op.status === 'CANCELLED'
                              ? 'cancelled'
                              : op.status === 'FAILED'
                                ? 'failed'
                                : op.status === 'NEEDS_REVIEW'
                                  ? 'needsReview'
                                  : 'pending'
                    )}
                </Button>
            ))}
            {activity.entries.map((entry) => (
                <Card key={entry.id} className="gap-1 p-3">
                    <span>{`${entry.direction === 'CREDIT' ? '+' : '−'}€${entry.amount}`}</span>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString()}</time>
                    {entry.txHash && (
                        <LinkButton className="my-3" external href={`https://basescan.org/tx/${entry.txHash}`}>
                            {t('viewTransaction')}
                        </LinkButton>
                    )}
                </Card>
            ))}
            {history.hasNextPage && (
                <Button
                    variant="secondary"
                    onClick={() => void history.fetchNextPage()}
                    disabled={history.isFetchingNextPage}
                    loading={history.isFetchingNextPage}
                >
                    {t('loadMore')}
                </Button>
            )}
            {history.isSuccess && !activity.entries.length && !activity.operations.length && (
                <p>{t('emptyActivity')}</p>
            )}
        </div>
    )
}
