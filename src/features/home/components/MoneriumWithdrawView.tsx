'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useMoneriumSigner } from '@/hooks/wallet/useMoneriumSigner'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { moneriumApi } from '@/services/monerium'
import { apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { assertCurrencyOperationSession, currencyOperationSession } from '@/utils/currency-operation-recovery'
import {
    moneriumEuroAmount,
    moneriumOperationFinal,
    clearMoneriumWithdrawal,
    readMoneriumWithdrawal,
    storeMoneriumWithdrawal,
    restoreMoneriumWithdrawal,
    type MoneriumWithdrawalAttempt,
} from '@/utils/monerium-withdrawal'
import { MoneriumActionError } from './MoneriumActionError'
import { MoneriumProgressView } from './MoneriumProgressView'
import { EurcBankAccountView } from './EurcBankAccountView'

export function MoneriumWithdrawView({
    userId,
    onClose,
    onOperation,
}: {
    userId: string
    onClose: () => void
    onOperation: (id: string) => void
}) {
    const t = useAppTranslations('currencyAccounts.monerium')
    const shared = useAppTranslations('currencyAccounts')
    const { user, fetchUser } = useAuth()
    const { verifyCorridor, modals } = useDepositGateRemediation()
    const { signMoneriumMessage } = useMoneriumSigner()
    const [recovery] = useState(() => readMoneriumWithdrawal(userId))
    const attempt = useRef<MoneriumWithdrawalAttempt | null>(recovery)
    const [amount, setAmount] = useState(recovery?.amount ?? '')
    const [bank, setBank] = useState(recovery?.externalAccountId ?? '')
    const [reviewing, setReviewing] = useState(false)
    const [error, setError] = useState<unknown>(null)
    const [busy, setBusy] = useState(false)
    const [addingBank, setAddingBank] = useState(false)
    const [viewingRecovery, setViewingRecovery] = useState(false)
    const [checkingRecovery, setCheckingRecovery] = useState(!!recovery?.prepared)
    const lock = useRef(false)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    useEffect(() => {
        if (!recovery?.prepared) return
        const controller = new AbortController()
        const version = currencyOperationSession(userId)
        void moneriumApi
            .operation(recovery.prepared.operationId, controller.signal)
            .then((operation) => {
                if (controller.signal.aborted || currencyOperationSession(userId) !== version) return
                if (moneriumOperationFinal(operation.status)) {
                    clearMoneriumWithdrawal(userId, recovery.prepared!.operationId)
                    attempt.current = null
                    setAmount('')
                    setBank('')
                } else if (operation.status !== 'READY') setViewingRecovery(true)
                setCheckingRecovery(false)
            })
            .catch((failure) => {
                if (controller.signal.aborted || currencyOperationSession(userId) !== version) return
                setError(failure)
                setCheckingRecovery(false)
            })
        return () => controller.abort()
    }, [recovery, userId])
    const id = useId()
    const banks = user?.accounts.filter((account) => account.type === AccountType.IBAN) ?? []
    const normalized = moneriumEuroAmount(amount)
    const valid = !!normalized && banks.some((account) => account.id === bank)
    const guard = (version: number) => {
        assertCurrencyOperationSession(userId, version)
        if (!mounted.current) throw new Error('Account view closed')
    }
    const confirm = async () => {
        if (!valid || !normalized || lock.current) return
        lock.current = true
        setBusy(true)
        setError(null)
        const version = currencyOperationSession(userId)
        const retryingPrepare = !!attempt.current
        try {
            let current = attempt.current
            if (!current) current = { requestKey: crypto.randomUUID(), amount: normalized, externalAccountId: bank }
            attempt.current = current
            storeMoneriumWithdrawal(userId, current)
            if (!current.prepared) {
                const prepared = await moneriumApi.prepareWithdraw({
                    requestKey: current.requestKey,
                    amount: current.amount,
                    externalAccountId: current.externalAccountId,
                })
                assertCurrencyOperationSession(userId, version)
                if (current.operationId && prepared.operationId !== current.operationId)
                    throw new Error('Withdrawal operation changed')
                if (prepared.status !== 'READY') {
                    current = { ...current, operationId: prepared.operationId }
                    attempt.current = current
                    storeMoneriumWithdrawal(userId, current)
                    guard(version)
                    onOperation(prepared.operationId)
                    return
                }
                current = { ...current, prepared }
                attempt.current = current
                storeMoneriumWithdrawal(userId, current)
            } else {
                const state = await moneriumApi.operation(current.prepared.operationId)
                guard(version)
                if (state.status !== 'READY') {
                    onOperation(current.prepared.operationId)
                    return
                }
            }
            guard(version)
            const prepared = current.prepared!
            if (!current.signature) {
                const signature = await signMoneriumMessage(prepared.message)
                assertCurrencyOperationSession(userId, version)
                current = { ...current, signature }
                attempt.current = current
                storeMoneriumWithdrawal(userId, current)
            }
            guard(version)
            current = { ...current, submitAttempted: true }
            attempt.current = current
            storeMoneriumWithdrawal(userId, current)
            await moneriumApi.submitWithdraw(prepared.operationId, current.signature!)
            guard(version)
            onOperation(prepared.operationId)
        } catch (failure) {
            if (!mounted.current || currencyOperationSession(userId) !== version) return
            const code = wireErrorCode(failure)
            if (code === 'invalid_signature' && apiErrorStatus(failure) === 400 && attempt.current?.prepared) {
                const { signature: _rejected, submitAttempted: _submitted, ...unsigned } = attempt.current
                attempt.current = unsigned
                storeMoneriumWithdrawal(userId, unsigned)
            }
            // These prepare refusals are definitive and created no operation.
            // Let the user correct the form; network failures retain the UUID.
            if (
                !attempt.current?.prepared &&
                code &&
                [
                    'invalid_amount',
                    'amount_below_minimum',
                    'supporting_document_required',
                    'invalid_bank_account',
                    'insufficient_balance',
                    'onboarding_incomplete',
                    'operation_in_flight',
                ].includes(code)
            ) {
                clearMoneriumWithdrawal(userId)
                attempt.current = null
                setReviewing(false)
            }
            setError(failure)
            if (code === 'verification_required') verifyCorridor('SEPA_EU')
            if (
                !retryingPrepare &&
                !attempt.current?.prepared &&
                code &&
                [
                    'verification_required',
                    'residence_prohibited',
                    'residence_unknown',
                    'not_allowlisted',
                    'disabled',
                    'eurc_enrolled',
                    'eurc_unknown',
                ].includes(code)
            ) {
                clearMoneriumWithdrawal(userId)
                attempt.current = null
                setReviewing(false)
            }
        } finally {
            lock.current = false
            if (mounted.current) setBusy(false)
        }
    }
    const viewPending = async () => {
        if (lock.current) return
        lock.current = true
        setBusy(true)
        const version = currencyOperationSession(userId)
        try {
            if (attempt.current?.prepared) {
                onOperation(attempt.current.prepared.operationId)
                return
            }
            let cursor: string | undefined
            const seen = new Set<string>()
            do {
                const history = await moneriumApi.history(cursor)
                guard(version)
                const pending = history.operations.find(
                    (op) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(op.status)
                )
                if (pending) {
                    restoreMoneriumWithdrawal(userId, pending)
                    onOperation(pending.id)
                    return
                }
                cursor = history.hasMore ? (history.cursor ?? undefined) : undefined
                if (cursor && seen.has(cursor)) throw new Error('History cursor did not advance')
                if (cursor) seen.add(cursor)
            } while (cursor)
            throw new Error('Pending operation not found')
        } catch (failure) {
            if (mounted.current && currencyOperationSession(userId) === version) setError(failure)
        } finally {
            lock.current = false
            if (mounted.current) setBusy(false)
        }
    }
    if (viewingRecovery && attempt.current?.prepared)
        return (
            <MoneriumProgressView
                userId={userId}
                operationId={attempt.current.prepared.operationId}
                onClose={onClose}
                onResume={() => setViewingRecovery(false)}
            />
        )
    if (checkingRecovery)
        return (
            <Card className="p-4" aria-busy="true">
                <p>{t('withdraw.checkingRecovery')}</p>
            </Card>
        )
    if (addingBank)
        return (
            <EurcBankAccountView
                onClose={() => setAddingBank(false)}
                onSaved={async () => {
                    await fetchUser()
                    if (mounted.current) setAddingBank(false)
                }}
            />
        )
    return (
        <>
            <Card className="flex flex-col gap-4 p-4">
                <h2 className="text-heading-card">{t('withdrawEuros')}</h2>
                {reviewing ? (
                    <>
                        <p>{`€${normalized}`}</p>
                        <p className="break-all">{banks.find((account) => account.id === bank)?.identifier}</p>
                        <Button disabled={busy || !valid} loading={busy} onClick={() => void confirm()}>
                            {shared('confirm')}
                        </Button>
                        {!attempt.current && (
                            <LinkButton className="my-3" onClick={() => setReviewing(false)}>
                                {shared('back')}
                            </LinkButton>
                        )}
                    </>
                ) : (
                    <>
                        <label className="flex flex-col gap-2" htmlFor={`${id}-account`}>
                            {t('withdraw.account')}
                            <select
                                id={`${id}-account`}
                                className="input h-12 px-4"
                                value={bank}
                                disabled={busy || !!attempt.current}
                                onChange={(event) => {
                                    setBank(event.target.value)
                                    setError(null)
                                }}
                            >
                                <option value="">{t('withdraw.chooseBank')}</option>
                                {banks.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.label || account.identifier} · {account.identifier}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button variant="secondary" onClick={() => setAddingBank(true)}>
                            {t('withdraw.addBank')}
                        </Button>
                        <label className="flex flex-col gap-2" htmlFor={`${id}-amount`}>
                            {t('withdraw.amount')}
                            <BaseInput
                                id={`${id}-amount`}
                                inputMode="decimal"
                                maxLength={21}
                                value={amount}
                                disabled={busy || !!attempt.current}
                                state={amount && !normalized ? 'error' : 'default'}
                                onChange={(event) => {
                                    setAmount(event.target.value)
                                    setError(null)
                                }}
                            />
                        </label>
                        {amount && !normalized && <Callout priority="error">{t('withdraw.invalidAmount')}</Callout>}
                        <Button disabled={!valid || busy} onClick={() => setReviewing(true)}>
                            {shared('review')}
                        </Button>
                    </>
                )}
                {error ? <MoneriumActionError withdraw error={error} /> : null}
                {(wireErrorCode(error) === 'operation_in_flight' || attempt.current?.submitAttempted) && (
                    <Button disabled={busy} variant="secondary" onClick={() => void viewPending()}>
                        {t('withdraw.viewPending')}
                    </Button>
                )}
                <LinkButton className="my-3" onClick={onClose}>
                    {shared('back')}
                </LinkButton>
            </Card>
            {modals}
        </>
    )
}
