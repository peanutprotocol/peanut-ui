'use client'
import { EurcActionError } from './EurcActionError'
import { isDemoMode } from '@/utils/demo'
import { peekActiveFixture } from '@/dev/fixtures/active'
import { useRef, useState } from 'react'
import { decodeFunctionData, erc20Abi, parseUnits } from 'viem'
import { formatUserOperationRequest, type UserOperation } from 'viem/account-abstraction'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { useKernelClient } from '@/context/kernelClient.context'
import { useSignUserOp } from '@/hooks/wallet/useSignUserOp'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { currencyAccountsApi, type CurrencyOperation } from '@/services/currency-accounts'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'

export function checkedCurrencyCall(operation: CurrencyOperation) {
    const call = operation.call
    const asset =
        operation.sourceAsset === 'EURC'
            ? EURC_ASSET
            : { chainId: '42161', tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' }
    if (
        !call ||
        call.chainId !== asset.chainId ||
        call.to.toLowerCase() !== asset.tokenAddress ||
        BigInt(call.value) !== 0n
    )
        throw new Error('Currency call mismatch')
    const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data })
    if (decoded.functionName !== 'transfer' || decoded.args[1] !== parseUnits(operation.amount, 6))
        throw new Error('Currency amount mismatch')
    return { ...call, value: 0n, recipient: decoded.args[0] }
}
export function EurcMoneyReviewView({
    operation,
    destinationLabel,
    onSubmitted,
    onClose,
}: {
    operation: CurrencyOperation
    destinationLabel?: string
    onSubmitted: (operation: CurrencyOperation) => void
    onClose: () => void
}) {
    const t = useAppTranslations('currencyAccounts')
    const { ensureClientForChain } = useKernelClient()
    const { signCallsUserOp } = useSignUserOp()
    const [pending, setPending] = useState(false),
        [error, setError] = useState<unknown>(null)
    // Retain the signed bytes on an ambiguous HTTP response. Retry probes the
    // server first and reuses them; it never prompts for a second signature.
    const signedRef = useRef<unknown>(null)
    const submit = async () => {
        if (pending) return
        setPending(true)
        setError(null)
        try {
            const existing = await currencyAccountsApi.operation(operation.id)
            if (existing.status !== 'READY') {
                onSubmitted(existing)
                return
            }
            if (isDemoMode() || peekActiveFixture()) {
                onSubmitted(await currencyAccountsApi.submit(operation.id, {}))
                return
            }
            if (!signedRef.current) {
                const call = checkedCurrencyCall(existing)
                await ensureClientForChain(call.chainId)
                const signed = await signCallsUserOp([{ to: call.to, data: call.data, value: 0n }], call.chainId)
                signedRef.current = formatUserOperationRequest(signed.signedUserOp as UserOperation<'0.7'>)
            }
            onSubmitted(await currencyAccountsApi.submit(operation.id, signedRef.current))
        } catch (reason) {
            setError(reason)
        } finally {
            setPending(false)
        }
    }
    const cancel = async () => {
        if (pending || signedRef.current) return
        setPending(true)
        setError(null)
        try {
            await currencyAccountsApi.cancel(operation.id)
            onClose()
        } catch (reason) {
            setError(reason)
        } finally {
            setPending(false)
        }
    }
    let recipient: string | undefined
    try {
        recipient = checkedCurrencyCall(operation).recipient
    } catch {
        /* no call for bank deposits */
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
            {operation.kind === 'EXCHANGE' && <p>{operation.sourceAsset === 'EURC' ? 'EURC → USDC' : 'USDC → EURC'}</p>}
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
                    <Button onClick={submit} disabled={pending} loading={pending}>
                        {t('confirm')}
                    </Button>
                </>
            )}
            <EurcActionError error={error} />
            <Button variant="ghost" onClick={cancel} disabled={pending || !!signedRef.current}>
                {t('cancel')}
            </Button>
        </Card>
    )
}
