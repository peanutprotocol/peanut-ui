'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import InputAmountStep from '@/components/AddMoney/components/InputAmountStep'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { AVENIA_MIN_DEPOSIT_BRL, aveniaSetupState, toApiDecimal } from '@/features/avenia/avenia.utils'
import { AveniaPixQrDeposit } from '@/features/avenia/components/AveniaPixQrDeposit'
import { AveniaPixSetup } from '@/features/avenia/components/AveniaPixSetup'
import { useCurrency } from '@/hooks/useCurrency'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { aveniaApi, type AveniaDeposit } from '@/services/avenia'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { RailCapability } from '@/types/capabilities'
import { formatBankAmount } from '@/utils/currency'
import { readReturnTo } from '@/utils/return-to.utils'

type AveniaDepositStep = 'inputAmount' | 'showQR'
type Denomination = 'USD' | 'BRL'

/**
 * Add money by Pix for a Brazilian resident on Avenia: the first-use setup
 * while the rail is not enabled, the amount in reais (R$20 minimum), then the
 * dynamic Pix code. Same URL contract as the Manteca flow it replaces for
 * these users (`?step=`, `?amount=`, `?currency=`).
 */
export function AveniaAddMoneyFlow({
    searchParams,
    rail,
}: {
    searchParams: Pick<URLSearchParams, 'get'>
    rail: RailCapability | undefined
}) {
    const t = useTranslations('addMoney')
    const tAvenia = useTranslations('avenia.deposit')
    const tShared = useTranslations('avenia')
    const tErrors = useTranslations('errors')
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    const leaveToHome = useReturnTo(readReturnTo(searchParams) ?? '/home')
    const onBack = useSafeBack(readReturnTo(searchParams) ?? '/add-money?method=bank')
    // nuqs default history (replace): the amount is rewritten on every keystroke
    const [urlState, setUrlState] = useQueryStates({
        step: parseAsStringEnum<AveniaDepositStep>(['inputAmount', 'showQR']),
        amount: parseAsString,
        currency: parseAsStringEnum<Denomination>(['USD', 'BRL']),
    })
    const step: AveniaDepositStep = urlState.step ?? 'inputAmount'
    const ready = aveniaSetupState(rail) === 'ready'

    const currencyData = useCurrency('BRL')
    const [usdAmount, setUsdAmount] = useState('')
    const [brlAmount, setBrlAmount] = useState('')
    const [deposit, setDeposit] = useState<AveniaDeposit>()
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const eligibility = useQuery({
        queryKey: ['avenia-deposit-eligibility'],
        queryFn: aveniaApi.depositEligibility,
        enabled: ready,
        staleTime: 5 * 60_000,
    })
    const minBrl = Number(eligibility.data?.minAmountBrl ?? AVENIA_MIN_DEPOSIT_BRL)
    const brlNumber = Number(brlAmount)
    const validationError =
        brlAmount && brlNumber > 0 && brlNumber < minBrl
            ? tAvenia('minimum', { amount: formatBankAmount(minBrl, 'BRL') })
            : null

    // A code lives only in this screen's memory: a refresh on the code step starts over.
    useEffect(() => {
        if (step === 'showQR' && !deposit) void setUrlState({ step: 'inputAmount' })
    }, [step, deposit, setUrlState])

    const handleSubmit = useCallback(async () => {
        if (isCreating) return
        const amountBrl = toApiDecimal(brlAmount, 2)
        if (!amountBrl) return
        setError(null)
        setIsCreating(true)
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_AMOUNT_ENTERED, {
            amount_usd: usdAmount,
            method_type: 'avenia',
            country: 'brazil',
        })
        try {
            const created = await aveniaApi.createDeposit(amountBrl)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_CONFIRMED, {
                amount_usd: usdAmount,
                method_type: 'avenia',
                country: 'brazil',
            })
            setDeposit(created)
            void setUrlState({ step: 'showQR' })
        } catch (caught) {
            const code = wireErrorCode(caught)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                method_type: 'avenia',
                country: 'brazil',
                error_code: code ?? 'unknown',
            })
            if (code === API_ERROR_CODES.AVENIA_KYC_REQUIRED || code === API_ERROR_CODES.AVENIA_NOT_AVAILABLE) {
                // the rail moved since the screen loaded: the capabilities say where the user stands now
                await fetchUser().catch(() => undefined)
                return
            }
            setError(
                code === API_ERROR_CODES.PIX_MIN_AMOUNT
                    ? tAvenia('minimum', { amount: formatBankAmount(minBrl, 'BRL') })
                    : code === API_ERROR_CODES.AVENIA_LIMIT_EXCEEDED
                      ? tAvenia('limitExceeded')
                      : code === API_ERROR_CODES.PROVIDER_REJECTED
                        ? tErrors('providerRejected')
                        : tShared('unavailable')
            )
        } finally {
            setIsCreating(false)
        }
    }, [isCreating, brlAmount, usdAmount, setUrlState, fetchUser, tAvenia, tShared, tErrors, minBrl])

    if (!ready) return <AveniaPixSetup title={t('title')} onBack={onBack} rail={rail} />

    // the code is being made: title only, nothing has moved yet
    if (isCreating) {
        return (
            <div className="my-auto flex min-h-inherit flex-col justify-center">
                <ProcessingScreen title={t('processingDepositTitle')} />
            </div>
        )
    }

    if (step === 'showQR' && deposit) {
        return (
            <AveniaPixQrDeposit
                deposit={deposit}
                blockedBanks={(eligibility.data?.blockedBanks ?? []).flatMap((bank) => (bank.name ? [bank.name] : []))}
                // the code is made; back leaves the flow rather than offering a second code
                onBack={onBack}
                onDone={leaveToHome}
                onComplete={() => void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })}
            />
        )
    }

    return (
        <InputAmountStep
            tokenAmount={urlState.amount ?? ''}
            setTokenAmount={setUsdAmount}
            onSubmit={handleSubmit}
            isLoading={isCreating}
            error={error}
            validationError={validationError}
            currencyData={currencyData}
            setCurrencyAmount={(value) => setBrlAmount(value ?? '')}
            setCurrentDenomination={(value) => void setUrlState({ currency: value === 'USD' ? 'USD' : 'BRL' })}
            initialDenomination={urlState.currency ?? 'BRL'}
            setDisplayedAmount={(value) => void setUrlState({ amount: value || null })}
            limitsCurrency="BRL"
            onBack={onBack}
            providerFinePrint={<ProviderFinePrint providerId="avenia-br" />}
        />
    )
}
