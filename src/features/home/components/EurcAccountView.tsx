'use client'

import { EURC_WALLET_CONFIGURED } from '@/constants/currency-accounts.consts'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'
import type { CurrencyAccountFlowState } from './currency-account.types'
import { useEffect, useState, type ReactNode } from 'react'
import { USER } from '@/constants/query.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
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
    const { gateFor } = useCapabilities()
    const { resolveGate, verifyCorridor, modals } = useDepositGateRemediation()
    const onVerificationRequired = () => verifyCorridor('SEPA_EU')
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
    const bankingBlock = capabilities.data?.bankingBlock
    // Capabilities ask the payment partner, so re-read them only while a verification can unlock banking.
    useEffect(() => {
        if (bankingBlock !== 'verification_required') return
        return client.getQueryCache().subscribe((event) => {
            if (event.type === 'updated' && event.query.queryKey[0] === USER && event.action.type === 'success') {
                void client.invalidateQueries({ queryKey: ['currency-capabilities', userId] })
            }
        })
    }, [client, userId, bankingBlock])
    const openBankAction = (action: 'EXCHANGE' | 'BANK_DEPOSIT' | 'BANK_WITHDRAW') => {
        if (bankingBlock === 'verification_required') {
            const op = action === 'BANK_WITHDRAW' ? 'withdraw' : 'deposit'
            const gate = gateFor(op, { railId: 'bridge.sepa_eu' })
            if (gate.kind !== 'ready' && gate.kind !== 'loading') resolveGate(gate, 'SEPA_EU')
            else onVerificationRequired()
            return
        }
        if (bankingBlock !== 'unavailable') setAction(action)
    }
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
    let content: ReactNode
    if (closing) content = <Loading />
    else if (operationId)
        content = (
            <EurcMoneyProgressView
                key={operationId}
                userId={userId}
                operationId={operationId}
                onVerificationRequired={onVerificationRequired}
                onClose={close}
            />
        )
    else if (action === 'RECEIVE') content = <EurcReceiveView account={account} onClose={close} />
    else if (action)
        content = (
            <EurcMoneyFormView
                userId={userId}
                kind={action}
                onPrepared={openOperation}
                onVerificationRequired={onVerificationRequired}
                onClose={close}
            />
        )
    else
        content = (
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
                        {bankingBlock !== 'unavailable' &&
                            (capabilities.data?.exchange || bankingBlock === 'verification_required') && (
                                <Button variant="secondary" onClick={() => openBankAction('EXCHANGE')}>
                                    {t('exchange')}
                                </Button>
                            )}
                        {bankingBlock !== 'unavailable' &&
                            (capabilities.data?.bankDeposit || bankingBlock === 'verification_required') && (
                                <Button variant="secondary" onClick={() => openBankAction('BANK_DEPOSIT')}>
                                    {t('bankDeposit')}
                                </Button>
                            )}
                        {bankingBlock !== 'unavailable' &&
                            (capabilities.data?.bankWithdraw || bankingBlock === 'verification_required') && (
                                <Button variant="secondary" onClick={() => openBankAction('BANK_WITHDRAW')}>
                                    {t('bankWithdraw')}
                                </Button>
                            )}
                        {bankingBlock === 'unavailable' && <p className="col-span-2">{t('bankingUnavailable')}</p>}
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
    return (
        <>
            {content}
            {modals}
        </>
    )
}
