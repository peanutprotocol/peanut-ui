'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import { isUnderPixMinimum } from '@/features/pix/pixQuote.utils'
import { pixMinimumBrl } from '@/features/pix/pixRoute.utils'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { pixApi } from '@/services/pix'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { CapabilityRoute } from '@/types/capabilities'
import { formatBankAmount } from '@/utils/currency'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { usePixProviderId } from '@/features/pix/usePixProviderId'
import { usePixStandingPayerLine } from '@/features/pix/usePixStandingPayerLine'
import { usePixDepositMarketLines } from '@/features/pix/usePixDepositMarketLines'

type PixDepositStep = 'inputAmount' | 'showQR'
type Denomination = 'USD' | 'BRL'

/**
 * Add money by Pix, for whichever provider the deposit route names: the
 * first-use setup while the route is not ready, the amount in reais, then the
 * dynamic Pix code. The URL holds the step, the amount and its currency
 * (`?step=`, `?amount=`, `?currency=`), plus `?intentId=` once the code
 * exists. Add money always starts a new deposit at the amount step (Aleks,
 * 2026-11-12): a user may open as many codes as they like, and each stays
 * payable until its own timer ends. A live code is reached from Activity,
 * whose pending deposit row offers "Show code" and opens this flow with its
 * `?intentId=`, so a reload of the code screen keeps working through the URL.
 * The route's `payableDepositIntentId` is not read here.
 *
 * A route whose code is standing (`route.standingCode`, ruling D7) skips the
 * amount: once ready it opens the same code screen on the user's one code,
 * which the API answers again on every call, so the URL names no deposit.
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
    const standing = ready && route.standingCode === true
    const providerId = usePixProviderId(route.provider)
    const intentId = urlState.intentId

    const [usdAmount, setUsdAmount] = useState('')
    const [brlAmount, setBrlAmount] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // The route states the provider's minimum: an amount under it is refused here, before any quote.
    // The amount step's estimate is the provider's quote for the reais on screen, not the /fx rate.
    // Only the amount step quotes: the setup and the code screen do not.
    const minimumBrl = pixMinimumBrl(route)
    const currencyData = usePixQuoteCurrency('deposit', brlAmount, minimumBrl, ready && !standing && !intentId)
    const payerLine = usePixStandingPayerLine(standing)
    const marketLines = usePixDepositMarketLines(standing)
    const minimumLine = minimumBrl ? tDeposit('minimum', { amount: formatBankAmount(minimumBrl, 'BRL') }) : null
    const validationError = isUnderPixMinimum(brlAmount, minimumBrl) ? minimumLine : null

    // the code step belongs to one deposit; without its id there is nothing to show
    useEffect(() => {
        if (step === 'showQR' && !urlState.intentId) void setUrlState({ step: 'inputAmount' })
    }, [step, urlState.intentId, setUrlState])

    // the returned and the expired screen offer another deposit: the amount step, nothing resumed
    const startNewDeposit = useCallback(() => void setUrlState({ step: 'inputAmount', intentId: null }), [setUrlState])

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
            // a deposit for an amount is an intent of its own; only a standing code has none
            const createdId = created.intentId
            if (!createdId) throw new Error('The Pix deposit came back without its intent')
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_CONFIRMED, {
                amount_usd: usdAmount,
                method_type: route.provider,
                country: 'brazil',
            })
            // the code screen reads this deposit's query; seeding it shows the code at once
            queryClient.setQueryData(pixDepositQueryKey(createdId), created)
            void setUrlState({ step: 'showQR', intentId: createdId })
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
            // a paused or dormant provider (503): the route may say so now; until it does, try again soon
            if (code === API_ERROR_CODES.PROVIDER_UNAVAILABLE) void fetchUser().catch(() => undefined)
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
    }, [
        isCreating,
        brlAmount,
        usdAmount,
        setUrlState,
        queryClient,
        fetchUser,
        tDeposit,
        tShared,
        tErrors,
        minimumLine,
        route.provider,
    ])

    if (intentId && step === 'showQR') {
        return (
            <PixQrDeposit
                intentId={intentId}
                // the code is made; back leaves the flow rather than offering a second code
                onBack={onBack}
                onDone={leaveToHome}
                onNewDeposit={startNewDeposit}
                onComplete={() => void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })}
            />
        )
    }

    if (!ready) return <PixSetup title={t('title')} onBack={onBack} route={route} />

    // any amount, no timer, and nothing to wait on: each Pix shows in Activity once it lands
    if (standing) {
        return (
            <PixQrDeposit
                intentId={null}
                minimumBrl={minimumBrl}
                marketLines={marketLines}
                payerLine={payerLine}
                onBack={onBack}
                onDone={leaveToHome}
                onNewDeposit={startNewDeposit}
                onComplete={() => void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })}
            />
        )
    }

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
