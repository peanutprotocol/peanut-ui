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
import { toApiDecimal } from '@/features/pix/pixFlow.utils'
import { pixDepositQueryKey } from '@/features/pix/pixDepositCode'
import { PixQrDeposit } from '@/features/pix/components/PixQrDeposit'
import { PixSetup } from '@/features/pix/components/PixSetup'
import { usePixQuoteCurrency } from '@/features/pix/usePixQuoteCurrency'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { pixApi } from '@/services/pix'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { formatBankAmount } from '@/utils/currency'
import { pixProviderId } from '@/utils/provider.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'

type PixDepositStep = 'inputAmount' | 'showQR'
type Denomination = 'USD' | 'BRL'

/**
 * Add money by Pix, for whichever provider the deposit route names: the
 * first-use setup while the route is not ready, the amount in reais, then the
 * dynamic Pix code. The URL holds the step, the amount and its currency
 * (`?step=`, `?amount=`, `?currency=`), plus `?intentId=` once the code
 * exists. While a code can still be paid (the route's
 * `payableDepositIntentId`), the flow opens that code instead of the amount
 * step; a new deposit is offered once the code has lapsed or come back.
 */
export function PixDepositFlow({ route }: { route: CapabilityRoute }) {
    const t = useTranslations('addMoney')
    const tDeposit = useTranslations('pix.deposit')
    const tShared = useTranslations('pix')
    const tErrors = useTranslations('errors')
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    // nuqs default history (replace): the amount is rewritten on every keystroke
    const [urlState, setUrlState] = useQueryStates({
        step: parseAsStringEnum<PixDepositStep>(['inputAmount', 'showQR']),
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
    const step: PixDepositStep = urlState.step ?? 'inputAmount'
    const ready = route.state === 'ready'
    const providerId = pixProviderId(route.provider)
    // The deposit the user left for a new one; the capabilities may still name it payable for a moment.
    const [leftIntentId, setLeftIntentId] = useState<string | null>(null)
    const payableIntentId = route.payableDepositIntentId
    const resumeIntentId =
        !urlState.intentId && step === 'inputAmount' && payableIntentId && payableIntentId !== leftIntentId
            ? payableIntentId
            : null
    const intentId = urlState.intentId ?? resumeIntentId

    const [usdAmount, setUsdAmount] = useState('')
    const [brlAmount, setBrlAmount] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const eligibility = useQuery({
        queryKey: ['pix-deposit-rules'],
        queryFn: pixApi.depositRules,
        enabled: ready,
        staleTime: 5 * 60_000,
    })
    // The amount step's estimate is the provider's quote for the reais on screen, not the /fx rate.
    // It opens on the eligible minimum, and the quote names the provider's minimum from then on.
    // Only the amount step quotes: the setup and the code screen do not.
    const opening = eligibility.data ? { amountBrl: eligibility.data.minAmountBrl } : null
    const currencyData = usePixQuoteCurrency('deposit', brlAmount, opening, ready && !intentId)
    const minimumLine = currencyData.minimumBrl
        ? tDeposit('minimum', { amount: formatBankAmount(currencyData.minimumBrl, 'BRL') })
        : null
    const brlNumber = Number(brlAmount)
    const validationError =
        brlAmount && brlNumber > 0 && brlNumber < Number(currencyData.minimumBrl ?? 0) ? minimumLine : null

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
            method_type: route.provider,
            country: 'brazil',
        })
        try {
            const created = await pixApi.createDeposit(amountBrl)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_CONFIRMED, {
                amount_usd: usdAmount,
                method_type: route.provider,
                country: 'brazil',
            })
            // the code screen reads this deposit's query; seeding it shows the code at once
            queryClient.setQueryData(pixDepositQueryKey(created.intentId), created)
            void setUrlState({ step: 'showQR', intentId: created.intentId })
            // the route names this code payable from now on, so a re-entry opens it, not a second code
            void fetchUser().catch(() => undefined)
        } catch (caught) {
            const code = wireErrorCode(caught)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                method_type: route.provider,
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
                    ? (minimumLine ?? tShared('unavailable'))
                    : code === API_ERROR_CODES.PIX_LIMIT_EXCEEDED
                      ? tDeposit('limitExceeded')
                      : code === API_ERROR_CODES.PROVIDER_REJECTED
                        ? tErrors('providerRejected')
                        : tShared('unavailable')
            )
        } finally {
            setIsCreating(false)
        }
    }, [isCreating, brlAmount, usdAmount, setUrlState, queryClient, fetchUser, tDeposit, tShared, tErrors, minimumLine])

    if (intentId && (step === 'showQR' || resumeIntentId)) {
        return (
            <PixQrDeposit
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

    if (!ready) return <PixSetup title={t('title')} onBack={onBack} route={route} />

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
            providerFinePrint={providerId ? <ProviderFinePrint providerId={providerId} /> : undefined}
        />
    )
}
