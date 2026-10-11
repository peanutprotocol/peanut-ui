'use client'
import { EurcActionError } from './EurcActionError'
import { CurrencyBalanceNotice } from '@/components/Global/CurrencyBalanceNotice'
import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { Field } from '@/components/0_Bruddle/Field'
import { Callout } from '@/components/0_Bruddle/Callout'
import { currencyAmount } from '@/utils/currency-amount'
import { assertCurrencyOperationSession, currencyOperationSession } from '@/utils/currency-operation-recovery'
import type { CurrencyMoneyForm } from './currency-account.types'
import { useQuery } from '@tanstack/react-query'
import { isAddress, zeroAddress } from 'viem'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyOperation, type CurrencyOperationKind } from '@/services/currency-accounts'

import { EurcBankAccountView } from './EurcBankAccountView'

export function EurcMoneyFormFields({
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
    const locale = useLocale()
    const { control, watch, handleSubmit } = useForm<CurrencyMoneyForm>({
        defaultValues: { amount: '', recipient: '', bank: '', source: 'EURC' },
        mode: 'onChange',
    })
    const { amount, recipient, bank, source } = watch()
    const preparing = useRef(false)
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
    const normalizedAmount = currencyAmount(amount, locale, kind === 'BANK_DEPOSIT')
    const validAmount = normalizedAmount !== null
    const valid =
        validAmount &&
        (kind !== 'SEND' || (isAddress(recipient) && recipient.toLowerCase() !== zeroAddress)) &&
        (kind !== 'BANK_WITHDRAW' || !!banks.data?.accounts.some((account) => account.id === bank)) &&
        (kind !== 'EXCHANGE' || rate.isSuccess)
    const prepare = async () => {
        if (preparing.current || !valid || !normalizedAmount) return
        preparing.current = true
        const version = currencyOperationSession(userId)
        setPending(true)
        setError(null)
        setAttempted(true)
        try {
            const operation = await currencyAccountsApi.prepare({
                requestKey,
                kind,
                sourceAsset: source,
                amount: normalizedAmount,
                ...(kind === 'SEND' ? { recipient } : {}),
                ...(kind === 'BANK_WITHDRAW' ? { externalAccountId: bank } : {}),
            })
            assertCurrencyOperationSession(userId, version)
            onPrepared(operation)
        } catch (reason) {
            setError(reason)
        } finally {
            preparing.current = false
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
            <form className="flex flex-col gap-3" onSubmit={handleSubmit(prepare)}>
                <h2 className="text-heading-card">{t('newOperation')}</h2>
                {kind === 'EXCHANGE' && (
                    <Controller
                        name="source"
                        control={control}
                        render={({ field }) => (
                            <Field>
                                <BaseSelect
                                    aria-label={t('from')}
                                    value={field.value}
                                    options={[
                                        { value: 'EURC', label: 'EUR · EURC' },
                                        { value: 'USDC', label: 'USD · USDC' },
                                    ]}
                                    onValueChange={(value) => edit(() => field.onChange(value))}
                                    disabled={pending}
                                />
                            </Field>
                        )}
                    />
                )}
                <Controller
                    name="amount"
                    control={control}
                    rules={{
                        validate: (value) =>
                            currencyAmount(value, locale, kind === 'BANK_DEPOSIT') !== null || t('invalidAmount'),
                    }}
                    render={({ field, fieldState }) => (
                        <Field
                            htmlFor="eurc-amount"
                            label={`${t('amount')} · ${kind === 'BANK_DEPOSIT' ? 'EUR' : source}`}
                            error={fieldState.error?.message}
                        >
                            <BaseInput
                                {...field}
                                id="eurc-amount"
                                inputMode="decimal"
                                disabled={pending}
                                onChange={(event) => edit(() => field.onChange(event.target.value))}
                            />
                        </Field>
                    )}
                />
                {kind === 'SEND' && (
                    <CurrencyBalanceNotice currency="EURC" amount={normalizedAmount ?? ''} showSelectedBalance />
                )}
                {kind === 'SEND' && (
                    <Controller
                        name="recipient"
                        control={control}
                        rules={{
                            validate: (value) =>
                                (isAddress(value) && value.toLowerCase() !== zeroAddress) || t('invalidRecipient'),
                        }}
                        render={({ field, fieldState }) => (
                            <Field htmlFor="eurc-recipient" label={t('recipient')} error={fieldState.error?.message}>
                                <BaseInput
                                    {...field}
                                    id="eurc-recipient"
                                    disabled={pending}
                                    autoComplete="off"
                                    onChange={(event) => edit(() => field.onChange(event.target.value))}
                                />
                            </Field>
                        )}
                    />
                )}
                {kind === 'BANK_WITHDRAW' && (
                    <>
                        <Controller
                            name="bank"
                            control={control}
                            rules={{
                                validate: (value) =>
                                    !!banks.data?.accounts.some((account) => account.id === value) || t('badBank'),
                            }}
                            render={({ field, fieldState }) => (
                                <Field error={fieldState.error?.message}>
                                    <BaseSelect
                                        aria-label={t('bankAccount')}
                                        placeholder={t('bankAccount')}
                                        value={field.value}
                                        options={
                                            banks.data?.accounts.map((account) => ({
                                                value: account.id,
                                                label: account.label,
                                            })) ?? []
                                        }
                                        onValueChange={(value) => edit(() => field.onChange(value))}
                                        disabled={pending || banks.isPending}
                                    />
                                </Field>
                            )}
                        />
                        {banks.isSuccess && !banks.data.accounts.length && <p>{t('noBankAccounts')}</p>}
                        <LinkButton className="my-3" onClick={() => setAddingBank(true)} disabled={pending}>
                            {t('addBank')}
                        </LinkButton>
                        {banks.isError && (
                            <Callout priority="error">
                                <p>{t('actionError')}</p>
                                <Button variant="ghost" onClick={() => void banks.refetch()}>
                                    {t('retry')}
                                </Button>
                            </Callout>
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
                            <Callout priority="error">
                                <p>{t('actionError')}</p>
                                <Button variant="ghost" onClick={() => void rate.refetch()}>
                                    {t('retry')}
                                </Button>
                            </Callout>
                        )}
                        <p className="text-body-s">{t('rateWarning')}</p>
                    </>
                )}
                <EurcActionError error={error} minimumCurrency={kind === 'BANK_DEPOSIT' ? 'EUR' : source} />
                <Button type="submit" disabled={!valid || pending} loading={pending}>
                    {t('review')}
                </Button>
                <LinkButton className="mt-3 mb-3" onClick={onClose} disabled={pending}>
                    {t('cancel')}
                </LinkButton>
            </form>
        </Card>
    )
}
