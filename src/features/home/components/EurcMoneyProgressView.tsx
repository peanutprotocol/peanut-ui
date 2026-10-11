'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Card } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { EurcMoneyReviewView } from './EurcMoneyReviewView'
import { clearSignedCurrencyOperation } from '@/utils/currency-operation-recovery'
import { isFinalCurrencyOperation } from '@/utils/currency-operation'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi } from '@/services/currency-accounts'

export function EurcMoneyProgressView({
    userId,
    operationId,
    onClose,
}: {
    userId: string
    operationId: string
    onClose: () => void
}) {
    const t = useAppTranslations('currencyAccounts'),
        client = useQueryClient()
    const state = useQuery({
        queryKey: ['currency-operation', userId, operationId],
        queryFn: ({ signal }) => currencyAccountsApi.operation(operationId, signal),
        refetchInterval: (query) =>
            ['COMPLETED', 'FAILED', 'CANCELLED'].includes(query.state.data?.status ?? '') ? false : 5_000,
        retry: 1,
    })
    const operation = state.data
    const status = operation?.status
    const banks = useQuery({
        queryKey: ['currency-banks', userId],
        queryFn: currencyAccountsApi.bankAccounts,
        enabled: operation?.kind === 'BANK_WITHDRAW',
        retry: 1,
    })
    const [resuming, setResuming] = useState(false),
        [resumeError, setResumeError] = useState(false)
    const resume = async () => {
        setResuming(true)
        setResumeError(false)
        try {
            const next = await currencyAccountsApi.resume(operationId)
            client.setQueryData(['currency-operation', userId, operationId], next)
        } catch {
            setResumeError(true)
        } finally {
            setResuming(false)
        }
    }
    useEffect(() => {
        if (status && isFinalCurrencyOperation(status)) {
            try {
                clearSignedCurrencyOperation(userId, operationId)
            } catch {
                setResumeError(true)
            }
        }
        if (status === 'COMPLETED') {
            void client.invalidateQueries({ queryKey: ['currency-account-balance', userId] })
            void client.invalidateQueries({ queryKey: ['currency-history', userId] })
            void client.invalidateQueries({ queryKey: ['balance'] })
        }
    }, [status, client, userId, operationId])
    if (!operation)
        return (
            <Card className="gap-3 p-4">
                {state.isError && <Callout priority="error">{t('statusError')}</Callout>}
                <Button onClick={() => void state.refetch()} disabled={state.isFetching} loading={state.isFetching}>
                    {t('retry')}
                </Button>
                <LinkButton className="mt-3 mb-3" onClick={onClose}>
                    {t('back')}
                </LinkButton>
            </Card>
        )
    if (status === 'READY' || status === 'AWAITING_FUNDS')
        return (
            <EurcMoneyReviewView
                key={operationId}
                userId={userId}
                operation={operation}
                destinationLabel={banks.data?.accounts.find((bank) => bank.id === operation.externalAccountId)?.label}
                onSubmitted={(next) => client.setQueryData(['currency-operation', userId, operationId], next)}
                onClose={onClose}
            />
        )
    return (
        <Card className="gap-3 p-4" aria-live="polite">
            <h2 className="text-heading-card">
                {status === 'COMPLETED'
                    ? t('completed')
                    : status === 'FAILED'
                      ? t('failed')
                      : status === 'CANCELLED'
                        ? t('cancelled')
                        : status === 'NEEDS_REVIEW'
                          ? t('needsReview')
                          : t('pending')}
            </h2>
            <p>
                {operation.amount} {operation.sourceAsset}
            </p>
            {status === 'COMPLETED' && operation.receipt?.final_amount && (
                <p>
                    {t('settled')}: {operation.receipt.final_amount} {operation.destinationCurrency}
                </p>
            )}
            {status === 'COMPLETED' && operation.receipt?.url?.startsWith('https://') && (
                <LinkButton className="my-3" external href={operation.receipt.url}>
                    {t('viewReceipt')}
                </LinkButton>
            )}
            {!isFinalCurrencyOperation(status ?? '') && <p>{t('pendingWarning')}</p>}
            {status === 'PREPARING' && (
                <Button onClick={resume} loading={resuming} disabled={resuming}>
                    {t('resume')}
                </Button>
            )}
            {resumeError && <Callout priority="error">{t('actionError')}</Callout>}
            {state.isError && (
                <Callout priority="error">
                    <p>{t('statusError')}</p>
                    <Button variant="ghost" onClick={() => void state.refetch()}>
                        {t('retry')}
                    </Button>
                </Callout>
            )}
            <LinkButton className="mt-3 mb-3" onClick={onClose}>
                {t('back')}
            </LinkButton>
        </Card>
    )
}
