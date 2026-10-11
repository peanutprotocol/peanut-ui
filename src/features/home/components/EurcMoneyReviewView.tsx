'use client'
import { EurcActionError } from './EurcActionError'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'
import { useState, useSyncExternalStore } from 'react'
import { formatUserOperationRequest, type UserOperation } from 'viem/account-abstraction'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { useKernelClient } from '@/context/kernelClient.context'
import { useSignUserOp } from '@/hooks/wallet/useSignUserOp'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyOperation } from '@/services/currency-accounts'
import { EURC_WALLET_CONFIGURED } from '@/constants/currency-accounts.consts'
import { checkedCurrencyCall, isFinalCurrencyOperation } from '@/utils/currency-operation'
import { wireErrorCode } from '@/services/api-error'
import {
    assertCurrencyOperationSession,
    clearSignedCurrencyOperation,
    currencyOperationInFlight,
    currencyOperationSession,
    guardCurrencyOperation,
    readSignedCurrencyOperation,
    storeSignedCurrencyOperation,
    subscribeCurrencyOperation,
} from '@/utils/currency-operation-recovery'

export function EurcMoneyReviewView({
    userId,
    operation,
    destinationLabel,
    onSubmitted,
    onClose,
}: {
    userId: string
    operation: CurrencyOperation
    destinationLabel?: string
    onSubmitted: (operation: CurrencyOperation) => void
    onClose: () => void
}) {
    const t = useAppTranslations('currencyAccounts')
    const { ensureClientForChain } = useKernelClient()
    const { signCallsUserOp } = useSignUserOp()
    const pending = useSyncExternalStore(
        subscribeCurrencyOperation,
        () => currencyOperationInFlight(userId, operation.id),
        () => false
    )
    const [recovery] = useState(() => {
        try {
            return { signed: !!readSignedCurrencyOperation(userId, operation.id), error: null as unknown }
        } catch (reason) {
            return { signed: true, error: reason }
        }
    })
    const [hasSigned, setHasSigned] = useState(recovery.signed)
    const [error, setError] = useState<unknown>(recovery.error)
    const walletConfigured = EURC_WALLET_CONFIGURED || isDemoMode() || !!peekActiveFixture()
    const submit = async () => {
        if (!walletConfigured) return
        await guardCurrencyOperation(userId, operation.id, async () => {
            const version = currencyOperationSession(userId)
            setError(null)
            try {
                const existing = await currencyAccountsApi.operation(operation.id)
                assertCurrencyOperationSession(userId, version)
                if (existing.status !== 'READY' || existing.userOpHash) {
                    if (isFinalCurrencyOperation(existing.status)) clearSignedCurrencyOperation(userId, operation.id)
                    onSubmitted(existing)
                    return
                }
                if (isDemoMode() || peekActiveFixture()) {
                    const next = await currencyAccountsApi.submit(operation.id, {})
                    assertCurrencyOperationSession(userId, version)
                    onSubmitted(next)
                    return
                }
                let signed = readSignedCurrencyOperation(userId, operation.id)
                if (!signed) {
                    const call = checkedCurrencyCall(existing)
                    await ensureClientForChain(call.chainId)
                    assertCurrencyOperationSession(userId, version)
                    const result = await signCallsUserOp([{ to: call.to, data: call.data, value: 0n }], call.chainId)
                    assertCurrencyOperationSession(userId, version)
                    signed = formatUserOperationRequest(result.signedUserOp as UserOperation<'0.7'>)
                    setHasSigned(true)
                }
                storeSignedCurrencyOperation(userId, operation.id, signed)
                const next = await currencyAccountsApi.submit(operation.id, signed)
                assertCurrencyOperationSession(userId, version)
                if (isFinalCurrencyOperation(next.status)) clearSignedCurrencyOperation(userId, operation.id)
                onSubmitted(next)
            } catch (reason) {
                if (currencyOperationSession(userId) !== version) return
                setError(reason)
                if (wireErrorCode(reason) === 'operation_expired') {
                    try {
                        const next = await currencyAccountsApi.operation(operation.id)
                        assertCurrencyOperationSession(userId, version)
                        if (next.status === 'READY' && !next.userOpHash) {
                            clearSignedCurrencyOperation(userId, operation.id)
                            setHasSigned(false)
                        } else {
                            if (isFinalCurrencyOperation(next.status))
                                clearSignedCurrencyOperation(userId, operation.id)
                            onSubmitted(next)
                        }
                    } catch (probeError) {
                        setError(probeError)
                    }
                }
            }
        })
    }
    const cancel = async () => {
        if (hasSigned) return
        await guardCurrencyOperation(userId, operation.id, async () => {
            const version = currencyOperationSession(userId)
            setError(null)
            try {
                if (readSignedCurrencyOperation(userId, operation.id)) return
                await currencyAccountsApi.cancel(operation.id)
                assertCurrencyOperationSession(userId, version)
                clearSignedCurrencyOperation(userId, operation.id)
                onClose()
            } catch (reason) {
                setError(reason)
            }
        })
    }
    let recipient: string | undefined
    let callError: unknown
    if (operation.call) {
        try {
            recipient = checkedCurrencyCall(operation).recipient
        } catch (reason) {
            callError = reason
        }
    }
    return (
        <Card className="gap-3 p-4">
            <h2 className="text-heading-card">{t('review')}</h2>
            <p>
                {operation.amount} {operation.kind === 'BANK_DEPOSIT' ? 'EUR' : operation.sourceAsset}
            </p>
            {operation.kind === 'BANK_WITHDRAW' && (
                <p>
                    {t('bankAccount')}: {destinationLabel ?? operation.externalAccountId}
                </p>
            )}
            {operation.kind === 'EXCHANGE' && <p>{operation.sourceAsset === 'EURC' ? 'EUR → USD' : 'USD → EUR'}</p>}
            {recipient && (
                <p className="text-body-s break-all">
                    {t('recipient')}: {recipient}
                </p>
            )}
            {operation.kind === 'BANK_DEPOSIT' ? (
                <>
                    <p>{t('bankInstructionsWarning')}</p>
                    <dl className="flex flex-col gap-2">
                        {Object.entries(operation.bankInstructions ?? {})
                            .filter(([key]) =>
                                [
                                    'iban',
                                    'bic',
                                    'bank_beneficiary_name',
                                    'account_holder_name',
                                    'deposit_message',
                                    'reference',
                                    'amount',
                                    'currency',
                                    'bank_name',
                                ].includes(key)
                            )
                            .map(([key, value]) => (
                                <div key={key}>
                                    <dt className="text-body-s">
                                        {t(
                                            (
                                                {
                                                    iban: 'ibanLabel',
                                                    bic: 'bicLabel',
                                                    bank_beneficiary_name: 'holderLabel',
                                                    account_holder_name: 'holderLabel',
                                                    deposit_message: 'referenceLabel',
                                                    reference: 'referenceLabel',
                                                    amount: 'amount',
                                                    currency: 'currencyLabel',
                                                    bank_name: 'bankLabel',
                                                } as const
                                            )[key as 'iban']
                                        )}
                                    </dt>
                                    <dd className="text-body-m break-all">{value}</dd>
                                </div>
                            ))}
                    </dl>
                    <Button onClick={() => onSubmitted(operation)}>{t('trackPayment')}</Button>
                </>
            ) : (
                <>
                    {operation.kind !== 'SEND' && <p className="text-body-s">{t('rateWarning')}</p>}
                    {walletConfigured && !callError && (
                        <Button onClick={submit} disabled={pending} loading={pending}>
                            {t('confirm')}
                        </Button>
                    )}
                </>
            )}
            <EurcActionError
                error={
                    error ??
                    callError ??
                    (!walletConfigured && operation.kind !== 'BANK_DEPOSIT'
                        ? new Error('Currency wallet unavailable')
                        : null)
                }
                minimumCurrency={operation.kind === 'BANK_DEPOSIT' || operation.sourceAsset === 'EURC' ? 'EUR' : 'USD'}
            />
            <LinkButton className="mt-3 mb-3" onClick={cancel} disabled={pending || hasSigned}>
                {t('cancel')}
            </LinkButton>
        </Card>
    )
}
