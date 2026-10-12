'use client'

import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { moneriumApi } from '@/services/monerium'
import { EURE_ASSET } from '@/constants/currency-accounts.consts'
import { readMoneriumWithdrawal, restoreMoneriumWithdrawal } from '@/utils/monerium-withdrawal'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { MoneriumActionError } from './MoneriumActionError'
import { MoneriumWithdrawView } from './MoneriumWithdrawView'
import { MoneriumProgressView } from './MoneriumProgressView'
import type { CurrencyAccountFlowState } from './currency-account.types'

export function MoneriumAccountView({
    userId,
    initialIban,
    state,
    onStateChange,
}: {
    userId: string
    initialIban?: string | null
    state?: CurrencyAccountFlowState
    onStateChange?: (state: Partial<CurrencyAccountFlowState>) => Promise<URLSearchParams>
}) {
    const t = useAppTranslations('currencyAccounts.monerium')
    const shared = useAppTranslations('currencyAccounts')
    const { user } = useAuth()
    const [local, setLocal] = useState<CurrencyAccountFlowState>({ action: null, operation: null })
    const [copyError, setCopyError] = useState<unknown>(null)
    const current = state ?? local
    const change = (update: Partial<CurrencyAccountFlowState>) => {
        if (onStateChange) void onStateChange(update)
        else setLocal((previous) => ({ ...previous, ...update }))
    }
    const capabilities = useQuery({
        queryKey: ['monerium-capabilities', userId],
        queryFn: ({ signal }) => moneriumApi.capabilities(signal),
        retry: 1,
    })
    const history = useInfiniteQuery({
        queryKey: ['monerium-history', userId],
        queryFn: ({ pageParam, signal }) => moneriumApi.history(pageParam, signal),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page, pages) =>
            page.hasMore && page.cursor && !pages.slice(0, -1).some((previous) => previous.cursor === page.cursor)
                ? page.cursor
                : undefined,
        refetchInterval: 15_000,
        retry: 1,
    })
    const close = () => {
        change({ action: null, operation: null })
        void history.refetch()
    }
    const openOperation = (id: string) => change({ operation: id, action: null })
    const historical = history.data?.pages.flatMap((page) => page.operations).find((op) => op.id === current.operation)
    const recovery = readMoneriumWithdrawal(userId)
    const canResume =
        (recovery?.prepared?.operationId ?? recovery?.operationId) === current.operation ||
        (historical?.status === 'READY' && !!historical.requestKey && !!historical.externalAccountId)
    if (current.operation)
        return (
            <MoneriumProgressView
                userId={userId}
                operationId={current.operation}
                onClose={close}
                onResume={
                    canResume
                        ? () => {
                              if (historical) restoreMoneriumWithdrawal(userId, historical)
                              change({ operation: null, action: 'BANK_WITHDRAW' })
                          }
                        : undefined
                }
            />
        )
    if (current.action === 'BANK_WITHDRAW' && capabilities.data?.bankWithdraw && !capabilities.data.bankingBlock)
        return <MoneriumWithdrawView userId={userId} onClose={close} onOperation={openOperation} />
    const iban = capabilities.data?.iban ?? initialIban
    const holder = user?.user.fullName
    if (current.action === 'BANK_DEPOSIT' && capabilities.data?.bankDeposit && !capabilities.data.bankingBlock)
        return (
            <Card className="flex flex-col gap-4 p-4">
                <h2 className="text-heading-card">{t('addEuros')}</h2>
                {iban ? (
                    <>
                        <p className="font-mono break-words">
                            {iban
                                .replace(/\s/g, '')
                                .match(/.{1,4}/g)
                                ?.join(' ')}
                        </p>
                        <p>{t('accountHolder')}</p>
                        <p>{holder}</p>
                        <Button
                            onClick={() =>
                                void (async () => {
                                    try {
                                        const copied = await copyTextToClipboard(iban)
                                        if (!copied) throw new Error('Could not copy IBAN')
                                        setCopyError(null)
                                    } catch (failure) {
                                        setCopyError(failure)
                                    }
                                })()
                            }
                        >
                            {t('copyIban')}
                        </Button>
                        <p>{t('depositInstructions')}</p>
                    </>
                ) : (
                    <MoneriumActionError error={{ code: 'link_required' }} />
                )}
                {copyError ? <MoneriumActionError error={copyError} /> : null}
                <LinkButton className="my-3" onClick={close}>
                    {shared('back')}
                </LinkButton>
            </Card>
        )
    const operations = [
        ...new Map(history.data?.pages.flatMap((page) => page.operations).map((op) => [op.id, op])).values(),
    ]
    const entries = [
        ...new Map(history.data?.pages.flatMap((page) => page.entries).map((entry) => [entry.id, entry])).values(),
    ]
    const explorer = EURE_ASSET.chainId === '421614' ? 'https://sepolia.arbiscan.io' : 'https://arbiscan.io'
    return (
        <div className="flex flex-col gap-4">
            {capabilities.isError && (
                <>
                    <MoneriumActionError error={capabilities.error} />
                    <Button variant="ghost" onClick={() => void capabilities.refetch()}>
                        {shared('retry')}
                    </Button>
                </>
            )}
            <div className="grid grid-cols-2 gap-3">
                {capabilities.data?.bankDeposit && !capabilities.data.bankingBlock && (
                    <Button variant="secondary" onClick={() => change({ action: 'BANK_DEPOSIT' })}>
                        {t('addEuros')}
                    </Button>
                )}
                {capabilities.data?.bankWithdraw && !capabilities.data.bankingBlock && (
                    <Button variant="secondary" onClick={() => change({ action: 'BANK_WITHDRAW' })}>
                        {t('withdrawEuros')}
                    </Button>
                )}
            </div>
            {capabilities.data?.bankingBlock && <p>{t('error.moneriumUnavailable')}</p>}
            <p className="text-body-s text-foreground-secondary">{t('assetDescription')}</p>
            <h2 className="text-heading-card">{shared('activity')}</h2>
            {history.isError && (
                <>
                    <MoneriumActionError error={history.error} />
                    <Button variant="ghost" onClick={() => void history.refetch()}>
                        {shared('retry')}
                    </Button>
                </>
            )}
            {operations.map((op) => (
                <Button key={op.id} variant="secondary" onClick={() => openOperation(op.id)}>
                    {`€${op.amount}`} ·{' '}
                    {shared(
                        op.status === 'COMPLETED'
                            ? 'completed'
                            : op.status === 'FAILED'
                              ? 'failed'
                              : op.status === 'CANCELLED'
                                ? 'cancelled'
                                : op.status === 'NEEDS_REVIEW'
                                  ? 'needsReview'
                                  : 'pending'
                    )}
                </Button>
            ))}
            {entries.map((entry) => (
                <Card key={entry.id} className="gap-1 p-3">
                    <span>{`${entry.direction === 'CREDIT' ? '+' : '−'}€${entry.amount}`}</span>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString()}</time>
                    {entry.txHash && (
                        <LinkButton
                            className="my-3"
                            external
                            href={`${explorer}/tx/${encodeURIComponent(entry.txHash)}`}
                        >
                            {shared('viewTransaction')}
                        </LinkButton>
                    )}
                </Card>
            ))}
            {history.hasNextPage && (
                <Button
                    variant="secondary"
                    disabled={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                >
                    {shared('loadMore')}
                </Button>
            )}
            {history.isSuccess && !operations.length && !entries.length && <p>{shared('emptyActivity')}</p>}
        </div>
    )
}
