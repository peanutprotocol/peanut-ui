'use client'

import { EURC_WALLET_CONFIGURED } from '@/constants/currency-accounts.consts'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Card } from '@/components/0_Bruddle/Card'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyAccount, type CurrencyOperation } from '@/services/currency-accounts'
import { EurcMoneyFormView } from './EurcMoneyFormView'
import { EurcMoneyReviewView } from './EurcMoneyReviewView'
import { EurcMoneyProgressView } from './EurcMoneyProgressView'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'

export function EurcAccountView({ userId, account }: { userId: string; account: CurrencyAccount }) {
    const t = useAppTranslations('currencyAccounts')
    const [action, setAction] = useState<'RECEIVE' | 'SEND' | 'EXCHANGE' | 'BANK_DEPOSIT' | 'BANK_WITHDRAW' | null>(
        null
    )
    const [operation, setOperation] = useState<CurrencyOperation | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const capabilities = useQuery({
        queryKey: ['currency-capabilities', userId],
        queryFn: currencyAccountsApi.capabilities,
        retry: 1,
    })
    const banks = useQuery({
        queryKey: ['currency-banks', userId],
        queryFn: currencyAccountsApi.bankAccounts,
        enabled: operation?.kind === 'BANK_WITHDRAW',
        retry: 1,
    })
    const walletConfigured = EURC_WALLET_CONFIGURED || isDemoMode() || !!peekActiveFixture()
    const history = useQuery({
        queryKey: ['currency-history', userId],
        queryFn: currencyAccountsApi.history,
        refetchInterval: 15_000,
        retry: 1,
    })
    const close = () => {
        setAction(null)
        setOperation(null)
        setSubmitted(false)
        void history.refetch()
    }
    if (operation) {
        return submitted || !['READY', 'AWAITING_FUNDS'].includes(operation.status) ? (
            <EurcMoneyProgressView userId={userId} operation={operation} onClose={close} />
        ) : (
            <EurcMoneyReviewView
                operation={operation}
                destinationLabel={banks.data?.accounts.find((bank) => bank.id === operation.externalAccountId)?.label}
                onSubmitted={(op) => {
                    setOperation(op)
                    setSubmitted(true)
                }}
                onClose={close}
            />
        )
    }
    if (action === 'RECEIVE')
        return (
            <Card className="gap-3 p-4">
                <h2 className="text-heading-card">{t('receive')}</h2>
                <p>{t('receiveWarning')}</p>
                <QRCodeWrapper url={`ethereum:${account.tokenAddress}@8453/transfer?address=${account.address}`} />
                <p className="text-body-s break-all">{account.address}</p>
                <Button variant="ghost" onClick={close}>
                    {t('back')}
                </Button>
            </Card>
        )
    if (action) return <EurcMoneyFormView userId={userId} kind={action} onPrepared={setOperation} onClose={close} />
    return (
        <div className="flex flex-col gap-4">
            {capabilities.isError || !walletConfigured ? (
                <div role="alert">
                    <p>{t('actionsError')}</p>
                    <Button variant="ghost" onClick={() => void capabilities.refetch()}>
                        {t('retry')}
                    </Button>
                </div>
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
                <div role="alert">
                    <p>{t('historyError')}</p>
                    <Button variant="ghost" onClick={() => void history.refetch()}>
                        {t('retry')}
                    </Button>
                </div>
            )}
            {history.data?.operations.map((op) => (
                <Button key={op.id} variant="secondary" onClick={() => setOperation(op)}>
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
            {history.data?.entries.map((entry) => (
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
            {history.isSuccess && !history.data.entries.length && !history.data.operations.length && (
                <p>{t('emptyActivity')}</p>
            )}
        </div>
    )
}
