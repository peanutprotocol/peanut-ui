'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Card } from '@/components/0_Bruddle/Card'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyOperation } from '@/services/currency-accounts'

export function EurcMoneyProgressView({
    userId,
    operation,
    onClose,
}: {
    userId: string
    operation: CurrencyOperation
    onClose: () => void
}) {
    const t = useAppTranslations('currencyAccounts'),
        client = useQueryClient()
    const state = useQuery({
        queryKey: ['currency-operation', userId, operation.id],
        queryFn: () => currencyAccountsApi.operation(operation.id),
        initialData: operation,
        refetchInterval: (query) =>
            ['COMPLETED', 'FAILED', 'CANCELLED'].includes(query.state.data?.status ?? '') ? false : 5_000,
        retry: 1,
    })
    const status = state.data.status
    const [resuming, setResuming] = useState(false),
        [resumeError, setResumeError] = useState(false)
    const resume = async () => {
        setResuming(true)
        setResumeError(false)
        try {
            const next = await currencyAccountsApi.resume(operation.id)
            client.setQueryData(['currency-operation', userId, operation.id], next)
            onClose()
        } catch {
            setResumeError(true)
        } finally {
            setResuming(false)
        }
    }
    useEffect(() => {
        if (status === 'COMPLETED') {
            void client.invalidateQueries({ queryKey: ['currency-account-balance', userId] })
            void client.invalidateQueries({ queryKey: ['currency-history', userId] })
            void client.invalidateQueries({ queryKey: ['balance'] })
        }
    }, [status, client, userId])
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
                {state.data.amount} {state.data.sourceAsset}
            </p>
            {status === 'COMPLETED' && state.data.receipt?.final_amount && (
                <p>
                    {t('settled')}: {state.data.receipt.final_amount} {state.data.destinationCurrency}
                </p>
            )}
            {status === 'COMPLETED' && state.data.receipt?.url?.startsWith('https://') && (
                <LinkButton className="my-3" external href={state.data.receipt.url}>
                    {t('viewReceipt')}
                </LinkButton>
            )}
            {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status) && <p>{t('pendingWarning')}</p>}
            {status === 'PREPARING' && (
                <Button onClick={resume} loading={resuming} disabled={resuming}>
                    {t('resume')}
                </Button>
            )}
            {resumeError && <p role="alert">{t('actionError')}</p>}
            {state.isError && (
                <div role="alert">
                    <p>{t('statusError')}</p>
                    <Button variant="ghost" onClick={() => void state.refetch()}>
                        {t('retry')}
                    </Button>
                </div>
            )}
            <Button variant="ghost" onClick={onClose}>
                {t('back')}
            </Button>
        </Card>
    )
}
