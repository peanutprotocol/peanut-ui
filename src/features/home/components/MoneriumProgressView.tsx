'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { moneriumApi } from '@/services/monerium'
import { moneriumOperationFinal, clearMoneriumWithdrawal } from '@/utils/monerium-withdrawal'
import { MoneriumActionError } from './MoneriumActionError'

const statuses = {
    READY: 'ready',
    SUBMITTED: 'submitted',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    NEEDS_REVIEW: 'needsReview',
} as const

export function MoneriumProgressView({
    userId,
    operationId,
    onClose,
    onResume,
}: {
    userId: string
    operationId: string
    onClose: () => void
    onResume?: () => void
}) {
    const t = useAppTranslations('currencyAccounts.monerium')
    const shared = useAppTranslations('currencyAccounts')
    const client = useQueryClient()
    const operation = useQuery({
        queryKey: ['monerium-operation', userId, operationId],
        queryFn: ({ signal }) => moneriumApi.operation(operationId, signal),
        refetchInterval: (query) => (moneriumOperationFinal(query.state.data?.status ?? '') ? false : 5_000),
        retry: 1,
    })
    const status = operation.data?.status
    useEffect(() => {
        if (status && moneriumOperationFinal(status)) {
            clearMoneriumWithdrawal(userId, operationId)
            void client.invalidateQueries({ queryKey: ['monerium-history', userId] })
            void client.invalidateQueries({ queryKey: ['currency-account-balance', userId] })
        }
    }, [status, userId, operationId, client])
    return (
        <Card className="flex flex-col gap-4 p-4" aria-live="polite">
            {status && (
                <h2 className="text-heading-card">{t(`withdraw.status.${statuses[status] ?? 'processing'}`)}</h2>
            )}
            {operation.data?.amount && <p>{`€${operation.data.amount}`}</p>}
            {status && !moneriumOperationFinal(status) && <p>{t('withdraw.pendingWarning')}</p>}
            {status === 'READY' && onResume && <Button onClick={onResume}>{shared('confirm')}</Button>}
            {operation.data?.errorCode && <MoneriumActionError withdraw error={{ code: operation.data.errorCode }} />}
            {operation.isError && (
                <>
                    <MoneriumActionError withdraw error={operation.error} />
                    <Button disabled={operation.isFetching} onClick={() => void operation.refetch()}>
                        {shared('retry')}
                    </Button>
                </>
            )}
            <LinkButton className="my-3" onClick={onClose}>
                {shared('back')}
            </LinkButton>
        </Card>
    )
}
