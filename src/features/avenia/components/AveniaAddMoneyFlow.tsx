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
import { aveniaDepositQueryKey, depositReadFromCreated } from '@/features/avenia/aveniaDepositCode'
import { AveniaPixQrDeposit } from '@/features/avenia/components/AveniaPixQrDeposit'
import { AveniaPixSetup } from '@/features/avenia/components/AveniaPixSetup'
import { useCurrency } from '@/hooks/useCurrency'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { aveniaApi } from '@/services/avenia'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { formatBankAmount } from '@/utils/currency'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'

type AveniaDepositStep = 'inputAmount' | 'showQR'
type Denomination = 'USD' | 'BRL'

/**
 * Add money by Pix for a Brazilian resident on Avenia: the first-use setup
 * while the route is not ready, the amount in reais (R$20 minimum), then the
 * dynamic Pix code. Same URL contract as the Manteca flow it replaces for
 * these users (`?step=`, `?amount=`, `?currency=`), plus `?intentId=` once
 * the code exists. While a code can still be paid (the route's
 * `payableDepositIntentId`), the flow opens that code instead of the amount
 * step; a new deposit is offered once the code has lapsed or come back.
 */
export function AveniaAddMoneyFlow({ route }: { route: CapabilityRoute }) {
    const t = useTranslations('addMoney')
    const tAvenia = useTranslations('avenia.deposit')
    const tShared = useTranslations('avenia')
    const tErrors = useTranslations('errors')
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    // nuqs default history (replace): the amount is rewritten on every keystroke
    const [urlState, setUrlState] = useQueryStates({
        step: parseAsStringEnum<AveniaDepositStep>(['inputAmount', 'showQR']),
        amount: parseAsString,
        currency: parseAsStringEnum<Denomination>(['USD', 'BRL']),
        // the deposit the code belongs to: a reload shows its status, not a new amount form
        intentId: parseAsString,
        [RETURN_TO_PARAM]: parseAsString,
    })
    const returnTo = readReturnTo(
        new URLSearchParams(urlState.returnTo ? { [RETURN_TO_PARAM]: urlState.returnTo } : {})
    )
    const leaveToHome = useReturnTo(returnTo ?? '/home')
    const onBack = useSafeBack(returnTo ?? '/add-money?method=bank')
    const step: AveniaDepositStep = urlState.step ?? 'inputAmount'
    const ready = aveniaSetupState(route) === 'ready'
    // The deposit the user left for a new one; the capabilities may still name it payable for a moment.
    const [leftIntentId, setLeftIntentId] = useState<string | null>(null)
    const payableIntentId = route.payableDepositIntentId
    const resumeIntentId =
        !urlState.intentId && step === 'inputAmount' && payableIntentId && payableIntentId !== leftIntentId
            ? payableIntentId
            : null
    const intentId = urlState.intentId ?? resumeIntentId

    const currencyData = useCurrency('BRL')
    const [usdAmount, setUsdAmount] = useState('')
    const [brlAmount, setBrlAmount] = useState('')
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

    // the code step belongs to one deposit; without its id there is nothing to show
    useEffect(() => {
        if (step === 'showQR' && !urlState.intentId) void setUrlState({ step: 'inputAmount' })
    }, [step, urlState.intentId, setUrlState])

    // a code that can still be paid opens on its own; the URL names it, so a reload keeps it
    useEffect(() => {
        if (resumeIntentId) void setUrlState({ step: 'showQR', intentId: resumeIntentId })
    }, [resumeIntentId, setUrlState])

    const startNewDeposit = useCallback(() => {
        setLeftIntentId(urlState.intentId)
        void setUrlState({ step: 'inputAmount', intentId: null })
        // the route's payable deposit is read again
        void fetchUser().catch(() => undefined)
    }, [urlState.intentId, setUrlState, fetchUser])

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
            // the code screen reads this deposit's query; seeding it shows the code at once
            queryClient.setQueryData(aveniaDepositQueryKey(created.intentId), depositReadFromCreated(created))
            void setUrlState({ step: 'showQR', intentId: created.intentId })
        } catch (caught) {
            const code = wireErrorCode(caught)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                method_type: 'avenia',
                country: 'brazil',
                error_code: code ?? 'unknown',
            })
            if (code === API_ERROR_CODES.ROUTE_NOT_AVAILABLE) {
                // the route moved since the screen loaded: the capabilities say where the user stands now
                await fetchUser().catch(() => undefined)
                return
            }
            setError(
                code === API_ERROR_CODES.PIX_MIN_AMOUNT
                    ? tAvenia('minimum', { amount: formatBankAmount(minBrl, 'BRL') })
                    : code === API_ERROR_CODES.PIX_LIMIT_EXCEEDED
                      ? tAvenia('limitExceeded')
                      : code === API_ERROR_CODES.PROVIDER_REJECTED
                        ? tErrors('providerRejected')
                        : tShared('unavailable')
            )
        } finally {
            setIsCreating(false)
        }
    }, [isCreating, brlAmount, usdAmount, setUrlState, queryClient, fetchUser, tAvenia, tShared, tErrors, minBrl])

    if (intentId && (step === 'showQR' || resumeIntentId)) {
        return (
            <AveniaPixQrDeposit
                intentId={intentId}
                blockedBankNames={
                    eligibility.data?.blockedBanks.flatMap((bank) => (bank.name ? [bank.name] : [])) ?? []
                }
                // the code is made; back leaves the flow rather than offering a second code
                onBack={onBack}
                onDone={leaveToHome}
                onNewDeposit={startNewDeposit}
                onComplete={() => void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })}
            />
        )
    }

    if (!ready) return <AveniaPixSetup title={t('title')} onBack={onBack} route={route} />

    // the code is being made: title only, nothing has moved yet
    if (isCreating) {
        return (
            <div className="my-auto flex min-h-inherit flex-col justify-center">
                <ProcessingScreen title={t('processingDepositTitle')} />
            </div>
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
            // the code carries the amount and the bank app cannot change it
            amountFixedByCode
            providerFinePrint={<ProviderFinePrint providerId="avenia-br" />}
        />
    )
}
