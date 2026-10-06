'use client'
import { EurcActionError } from './EurcActionError'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAddress, parseUnits, zeroAddress } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyOperation, type CurrencyOperationKind } from '@/services/currency-accounts'

import { EurcBankAccountView } from './EurcBankAccountView'

export function EurcMoneyFormView({
    userId,
    kind,
    onPrepared,
    onClose,
}: {
    userId: string
    kind: CurrencyOperationKind
    onPrepared: (operation: CurrencyOperation) => void
    onClose: () => void
}) {
    const t = useAppTranslations('currencyAccounts')
    const [amount, setAmount] = useState(''),
        [recipient, setRecipient] = useState(''),
        [bank, setBank] = useState('')
    const [source, setSource] = useState<'EURC' | 'USDC'>('EURC')
    const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
    const [addingBank, setAddingBank] = useState(false)
    const [attempted, setAttempted] = useState(false)
    const edit = (change: () => void) => {
        change()
        if (attempted) {
            setRequestKey(crypto.randomUUID())
            setAttempted(false)
        }
    }
    const [pending, setPending] = useState(false),
        [error, setError] = useState<unknown>(null)
    const banks = useQuery({
        queryKey: ['currency-banks', userId],
        queryFn: currencyAccountsApi.bankAccounts,
        enabled: kind === 'BANK_WITHDRAW',
        retry: 1,
    })
    const rate = useQuery({
        queryKey: ['currency-rate', userId, source],
        queryFn: () => currencyAccountsApi.exchangeRate(source),
        enabled: kind === 'EXCHANGE',
        staleTime: 30_000,
        retry: 1,
    })
    const validAmount =
        /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(amount) &&
        parseUnits(amount, 6) > 0n &&
        (kind !== 'BANK_DEPOSIT' || parseUnits(amount, 6) % 10_000n === 0n)
    const valid =
        validAmount &&
        (kind !== 'SEND' || (isAddress(recipient) && recipient.toLowerCase() !== zeroAddress)) &&
        (kind !== 'BANK_WITHDRAW' || !!bank) &&
        (kind !== 'EXCHANGE' || rate.isSuccess)
    const prepare = async () => {
        if (pending || !valid) return
        setPending(true)
        setError(null)
        setAttempted(true)
        try {
            onPrepared(
                await currencyAccountsApi.prepare({
                    requestKey,
                    kind,
                    sourceAsset: source,
                    amount,
                    ...(kind === 'SEND' ? { recipient } : {}),
                    ...(kind === 'BANK_WITHDRAW' ? { externalAccountId: bank } : {}),
                })
            )
        } catch (reason) {
            setError(reason)
        } finally {
            setPending(false)
        }
    }
    if (addingBank)
        return (
            <EurcBankAccountView
                onSaved={async () => {
                    await banks.refetch()
                    setAddingBank(false)
                }}
                onClose={() => setAddingBank(false)}
            />
        )
    return (
        <Card className="gap-3 p-4">
            <h2 className="text-heading-card">{t('newOperation')}</h2>
            {kind === 'EXCHANGE' && (
                <BaseSelect
                    aria-label={t('from')}
                    value={source}
                    options={[
                        { value: 'EURC', label: 'EUR · EURC' },
                        { value: 'USDC', label: 'USD · USDC' },
                    ]}
                    onValueChange={(value) => edit(() => setSource(value as 'EURC' | 'USDC'))}
                    disabled={pending}
                />
            )}
            <label className="text-body-m">
                {t('amount')} · {kind === 'BANK_DEPOSIT' ? 'EUR' : source}
                <BaseInput
                    inputMode="decimal"
                    value={amount}
                    disabled={pending}
                    onChange={(event) => edit(() => setAmount(event.target.value))}
                />
            </label>
            {kind === 'SEND' && (
                <label className="text-body-m">
                    {t('recipient')}
                    <BaseInput
                        value={recipient}
                        disabled={pending}
                        autoComplete="off"
                        onChange={(event) => edit(() => setRecipient(event.target.value))}
                    />
                </label>
            )}
            {kind === 'BANK_WITHDRAW' && (
                <>
                    <BaseSelect
                        aria-label={t('bankAccount')}
                        placeholder={t('bankAccount')}
                        value={bank}
                        options={banks.data?.accounts.map((a) => ({ value: a.id, label: a.label })) ?? []}
                        onValueChange={(value) => edit(() => setBank(value))}
                        disabled={pending || banks.isPending}
                    />
                    {banks.isSuccess && !banks.data.accounts.length && <p>{t('noBankAccounts')}</p>}
                    <Button variant="ghost" onClick={() => setAddingBank(true)} disabled={pending}>
                        {t('addBank')}
                    </Button>
                    {banks.isError && (
                        <Button variant="ghost" onClick={() => void banks.refetch()}>
                            {t('retry')}
                        </Button>
                    )}
                </>
            )}
            {kind === 'EXCHANGE' && (
                <>
                    {rate.isSuccess && (
                        <p>
                            {t('referenceRate')}: {rate.data.midmarket_rate}
                        </p>
                    )}
                    {rate.isError && (
                        <Button variant="ghost" onClick={() => void rate.refetch()}>
                            {t('retry')}
                        </Button>
                    )}
                    <p className="text-body-s">{t('rateWarning')}</p>
                </>
            )}
            <EurcActionError error={error} />
            <Button onClick={prepare} disabled={!valid || pending} loading={pending}>
                {t('review')}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
                {t('cancel')}
            </Button>
        </Card>
    )
}
