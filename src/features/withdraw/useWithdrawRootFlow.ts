'use client'

import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'

import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getCountryFromAccount } from '@/utils/bridge.utils'
import { BRIDGE_OFFRAMP_MIN_USD, bankPayoutMinimum, meetsBankPayoutMinimum } from './amount-validation'
import { formatBankAmount } from '@/utils/currency'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { withdrawBankUrl, withdrawCountryUrl } from '@/utils/native-routes'
import { SCAN_ID_PARAM, takeScannedDestination, withdrawTokenForChain } from './destination'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { parseAsString, parseAsBoolean, useQueryState } from 'nuqs'
import { useTranslations } from 'next-intl'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useWithdrawFlow } from './WithdrawFlowContext'
import { useWithdrawAmount, useWithdrawDestinationAmount } from './useWithdrawAmount'
import { bankAmountCurrency, normalizeBankAmount } from './bank-amount'
import { useBridgeOfframpQuote } from '@/hooks/useBridgeOfframpQuote'
import { WITHDRAW_ROOT_STEPS } from './types'

/**
 * Flow hook for the root /withdraw page: the method → amount stepper (step in
 * the URL as a named screen id), the USD amount (also in the URL), amount
 * validation, and the per-method continue routing. Views stay dumb.
 */
export function useWithdrawRootFlow() {
    const router = useRouter()
    const goBackToSend = useSafeBack('/send', { replace: true })
    const t = useTranslations('withdraw')
    const tErrors = useTranslations('errors')

    const [, setShowAll] = useQueryState('showAll', parseAsBoolean.withDefault(false))
    const [methodParam] = useQueryState('method', parseAsString)
    const [scanIdParam] = useQueryState(SCAN_ID_PARAM, parseAsString)
    const [returnToParam] = useQueryState(RETURN_TO_PARAM, parseAsString)
    // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA) wins
    // over /home, which only fits tab-bar entries. Rewinds rather than pushes:
    // a pushed /home kept the withdraw flow under it, so back from home
    // reopened it.
    const leaveFlow = useReturnTo(
        readReturnTo({ get: (key: string) => (key === RETURN_TO_PARAM ? returnToParam : null) }, '/withdraw') ?? '/home'
    )
    const { isFromSendFlow, isCryptoFromSend, isBankFromSend } = useSendFlowOrigin()

    const {
        error,
        setError,
        selectedMethod,
        selectedBankAccount,
        setSelectedBankAccount,
        setSelectedMethod,
        setIsMaxWithdrawal,
        setRecipient,
        setIsValidRecipient,
    } = useWithdrawFlow()

    const { supportedChainsAndTokens, setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)

    const [urlAmount, setUrlAmount] = useWithdrawAmount()
    // raw amount currently typed in the input; the URL is the commit point
    const [rawTokenAmount, setRawTokenAmount] = useState<string>(urlAmount)
    const [destinationAmount, setDestinationAmount] = useWithdrawDestinationAmount()

    const stepper = useFlowStepper({
        steps: WITHDRAW_ROOT_STEPS,
        guards: {
            // refresh/deep-link into the amount step with no method in flow
            // memory falls back to method selection instead of a dead screen
            amount: { ok: !!selectedMethod || isCryptoFromSend },
        },
        onExit: () => {
            // back on the method step leaves the flow
            if (isBankFromSend) {
                goBackToSend()
                return
            }
            leaveFlow()
        },
    })

    // A scanned address, old Send → Crypto links (/withdraw?method=crypto) and
    // old crypto amount-step links arrive here but belong to /withdraw/crypto. Decided from the URL on the first render, so the page
    // renders nothing while the effect below forwards: the Withdraw method list
    // must never show on the way (TASK-23054).
    const forwardsToCrypto = isCryptoFromSend || (stepper.step === 'amount' && selectedMethod?.type === 'crypto')
    useEffect(() => {
        if (!forwardsToCrypto) return
        if (scanIdParam && !supportedChainsAndTokens) return
        const scanned = takeScannedDestination(scanIdParam)
        const token = scanned ? withdrawTokenForChain(supportedChainsAndTokens?.[scanned.chainId]?.tokens) : undefined
        if (scanned && token) {
            setSelectedChainID(scanned.chainId)
            setSelectedTokenAddress(token.address)
            setRecipient({ name: undefined, address: scanned.address })
            setIsValidRecipient(true)
        }
        if (selectedMethod?.type !== 'crypto') {
            setSelectedMethod({ type: 'crypto', title: 'Crypto', countryPath: undefined })
        }
        setSelectedBankAccount(null)
        const params = new URLSearchParams()
        if (methodParam) params.set('method', methodParam)
        if (urlAmount) params.set('amount', urlAmount)
        // toString, not `params.size`: Safari before 17 has no `size`, which
        // dropped the send marker and the amount from the forward
        const query = params.toString()
        router.replace(`/withdraw/crypto${query ? `?${query}` : ''}`)
    }, [
        forwardsToCrypto,
        selectedMethod,
        scanIdParam,
        supportedChainsAndTokens,
        methodParam,
        urlAmount,
        setSelectedChainID,
        setSelectedTokenAddress,
        setRecipient,
        setIsValidRecipient,
        setSelectedBankAccount,
        setSelectedMethod,
        router,
    ])

    // flag to know if the user has manually entered something
    const userTypedRef = useRef<boolean>(false)

    const { spendableBalance: balance, formattedSpendableBalance } = useWallet()

    // Spend ceiling = the displayed total spendable. We gate on display (not an
    // available-now subset) so we never block funds the live withdraw could route;
    // an in-transit shortfall fails late with a settling message. See useWallet.
    const maxDecimalAmount = useMemo(() => {
        return balance !== undefined ? Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : 0
    }, [balance])

    // Displayed total spendable (smart + collateral), single-sourced + formatted
    // by the hook. Empty while loading so we don't flash "$0.00".
    const walletBalance = balance === undefined ? '' : formattedSpendableBalance

    // crypto withdrawals are plain on-chain transfers — fiat-rail minimums don't
    // apply. selectedMethod is the routing source of truth; the URL param only
    // covers the first render before the mount effect commits the crypto method.
    const isCryptoWithdraw = selectedMethod ? selectedMethod.type === 'crypto' : isCryptoFromSend

    // A bank account paid in EUR, GBP, MXN or COP takes the amount in that
    // currency (TASK-23054): the user types the bank amount, and the USD
    // under it converts at the quote rate, fees included — so the min,
    // balance and limit checks below run on what will actually leave.
    const bankCurrency = selectedMethod?.type === 'bridge' ? bankAmountCurrency(selectedBankAccount) : null
    const bankRate = useBridgeOfframpQuote({ currency: bankCurrency, enabled: stepper.step === 'amount' })
    // The field can toggle to USD. A USD amount the user typed is handed on as
    // USD, exact, and the review leads with it; only a bank amount is re-quoted.
    // The URL keeps the toggle and the USD, so back and refresh restore both.
    const [amountCurrencyParam, setAmountCurrencyParam] = useQueryState('amountCurrency', parseAsString)
    const isBankFieldInUsd = !!bankCurrency && amountCurrencyParam === 'usd'

    // The USD floor under every bank payout. No amount-step minimum for crypto:
    // same-chain (Arbitrum) withdrawals are direct transfers with no floor,
    // matching send-via-link. Rhino's per-network bridge minimums are enforced
    // chain-aware at review time (see withdraw/crypto), once the destination is
    // known.
    const minUsdAmount = isCryptoWithdraw ? 0 : BRIDGE_OFFRAMP_MIN_USD

    // A bank amount typed in its currency meets the payout minimum in that
    // currency: exactly 50 MXN passes (TASK-23054). The USD floor above still
    // applies to what it converts to. Shared with the submit-side re-check in
    // useBridgeOfframpFlow.
    const belowBankMinimum =
        !!bankCurrency && !!destinationAmount && !meetsBankPayoutMinimum(Number(destinationAmount), bankCurrency)

    // validate against user's limits for bank withdrawals
    // note: crypto withdrawals don't have fiat limits
    const limitsValidation = useLimitsValidation({
        flowType: 'offramp',
        amount: rawTokenAmount,
        currency: 'USD',
    })

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            const amount = Number(amountStr)
            if (!Number.isFinite(amount) || amount <= 0) {
                setError({ showError: true, errorMessage: t('errors.invalidNumber') })
                return false
            }

            // AmountInput is USD-pinned on this page (price: 1), so the typed
            // value IS the USD value.
            const usdEquivalent = amount

            // While the balance is still loading, maxDecimalAmount is 0 — skip the
            // balance check so a pre-filled amount isn't false-blocked; the effect
            // re-validates once it lands (validateAmount is in its deps).
            const balanceLoaded = balance !== undefined
            if (!belowBankMinimum && usdEquivalent >= minUsdAmount && (!balanceLoaded || amount <= maxDecimalAmount)) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            // determine message
            let message = ''
            if (belowBankMinimum || usdEquivalent < minUsdAmount) {
                // the minimum in the currency the user typed
                const minDisplay =
                    belowBankMinimum && bankCurrency
                        ? formatBankAmount(bankPayoutMinimum(bankCurrency), bankCurrency)
                        : formatBankAmount(minUsdAmount, 'USD')
                message = isFromSendFlow
                    ? t('errors.minimumSend', { amount: minDisplay })
                    : t('errors.minimumWithdrawal', { amount: minDisplay })
            } else if (balanceLoaded && amount > maxDecimalAmount) {
                message = tErrors('notEnoughBalanceAddFunds')
            } else {
                message = t('errors.invalidAmount')
            }
            setError({ showError: true, errorMessage: message })
            return false
        },
        [balance, maxDecimalAmount, setError, isFromSendFlow, minUsdAmount, belowBankMinimum, bankCurrency, t, tErrors]
    )

    // The exact string the balance tap last filled. Any other value reaching
    // handleAmountChange is the user typing, which retires the max intent.
    const filledFromBalanceRef = useRef<string | null>(null)

    const handleBalanceFilled = useCallback(
        (value: string) => {
            filledFromBalanceRef.current = value
            setIsMaxWithdrawal(true)
        },
        [setIsMaxWithdrawal]
    )

    const handleAmountChange = useCallback(
        (value: string | undefined) => {
            let newValue = value || ''
            // treat leading "0" from initial AmountInput mount as empty
            if (newValue === '0') {
                newValue = ''
            }
            setRawTokenAmount(newValue)

            if (newValue !== filledFromBalanceRef.current) {
                filledFromBalanceRef.current = null
                setIsMaxWithdrawal(false)
            }

            // ignore programmatically injected tiny residual amounts (<1) before user interaction
            const numericVal = parseFloat(newValue)
            if (!userTypedRef.current && numericVal > 0 && numericVal < 1) {
                return // do not update state at all
            }

            // mark that the user has interacted once they type anything >= 1 or delete everything
            if (newValue === '' || numericVal >= 1) {
                userTypedRef.current = true
            }

            // the URL is the durable copy of the typed amount (survives refresh,
            // shareable mid-flow) — nuqs throttles the actual history writes.
            // For a bank-currency amount the USD is only derived; the bank amount is stored.
            if (!bankCurrency) void setUrlAmount(newValue === '' ? null : newValue)
            // the field re-reports an unchanged USD when the rate refreshes; an
            // unchanged URL write can discard Continue's navigation (see below)
            else if (isBankFieldInUsd && newValue !== urlAmount) void setUrlAmount(newValue === '' ? null : newValue)

            // clear any existing errors when user starts typing
            if (error.showError) {
                setError({ showError: false, errorMessage: '' })
            }
        },
        [setUrlAmount, error.showError, setError, setIsMaxWithdrawal, bankCurrency, isBankFieldInUsd, urlAmount]
    )

    const handleDestinationAmountChange = useCallback(
        (value: string) => {
            // "90." or ".5" mid-typing is stored the way the quote API accepts it
            const next = normalizeBankAmount(value) ?? ''
            // The field re-reports an unchanged amount when the quote rate refreshes.
            // Writing it anyway replaces the URL, and in Next.js that discards a
            // navigation in flight, such as Continue's push to the review.
            if (next === destinationAmount) return
            void setDestinationAmount(next || null)
        },
        [setDestinationAmount, destinationAmount]
    )

    // only validate when rawTokenAmount changes and we're on the amount step
    useEffect(() => {
        if (stepper.step !== 'amount') return undefined
        if (rawTokenAmount === '') {
            setError({ showError: false, errorMessage: '' })
            return undefined
        }
        // a small delay to avoid validating while the user is still typing
        const timeoutId = setTimeout(() => {
            validateAmount(rawTokenAmount)
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [rawTokenAmount, validateAmount, setError, stepper.step])

    /** Build the query string for a downstream route: amount + preserved send marker. */
    const downstreamQuery = useCallback(
        (extra?: Record<string, string>) => {
            const params = new URLSearchParams()
            for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
            if (isFromSendFlow && methodParam && !params.has('method')) params.set('method', methodParam)
            // a bank-currency amount is handed on as typed; the review quotes its USDC
            if (bankCurrency && !isBankFieldInUsd) {
                if (destinationAmount) params.set('destinationAmount', destinationAmount)
            } else if (rawTokenAmount) {
                params.set('amount', rawTokenAmount)
            }
            const qs = params.toString()
            return qs ? `?${qs}` : ''
        },
        [isFromSendFlow, methodParam, rawTokenAmount, bankCurrency, destinationAmount, isBankFieldInUsd]
    )

    const handleAmountContinue = useCallback(() => {
        if (!validateAmount(rawTokenAmount) || !selectedMethod) return

        const usdVal = parseFloat(rawTokenAmount)
        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_AMOUNT_ENTERED, {
            amount_usd: usdVal,
            method_type: selectedMethod.type,
            country: selectedMethod.countryPath,
            from_send_flow: isFromSendFlow,
        })

        // Route based on selected method type (check method type first to avoid
        // a stale bank account taking priority)
        if (selectedMethod.type === 'crypto') {
            router.push(`/withdraw/crypto${downstreamQuery()}`)
        } else if (selectedMethod.type === 'manteca') {
            // Manteca (AR/BR) accounts route to the Manteca flow. Checked BEFORE
            // the generic saved-bank-account branch below — that branch targets
            // the Bridge bank page via getCountryFromAccount and would both
            // mis-route a Manteca account and throw when its country can't be
            // resolved. The manteca flow honors ?amount= and skips its own
            // amount entry (TASK-21664).
            const mantecaMethod = selectedMethod.title?.toLowerCase().replace(/\s+/g, '-') || 'bank-transfer'
            router.push(
                `/withdraw/manteca${downstreamQuery({ method: mantecaMethod, country: selectedMethod.countryPath ?? '' })}`
            )
        } else if (selectedBankAccount) {
            const country = getCountryFromAccount(selectedBankAccount)
            if (country) {
                router.push(withdrawBankUrl(country.path, downstreamQuery()))
            } else {
                // Never throw inside the click handler: a synchronous throw aborts
                // the router transition with no UI feedback, so the button silently
                // dies ("press Continue, nothing happens"). Surface a recoverable
                // error and log for observability instead.
                console.error('[withdraw] could not resolve country from saved bank account', {
                    type: selectedBankAccount.type,
                    countryName: selectedBankAccount.details?.countryName,
                    countryCode: selectedBankAccount.details?.countryCode,
                })
                setError({ showError: true, errorMessage: t('errors.countryUnresolved') })
            }
        } else if (selectedMethod.countryPath) {
            // A bridge method with no account yet — an old `?step=amount` link,
            // or flow memory lost to a refresh. The form comes first now, so
            // send them there with the amount they typed still in the URL.
            router.push(withdrawCountryUrl(selectedMethod.countryPath, downstreamQuery({ step: 'form' })))
        } else {
            // No branch matched the selected method — surface an error rather
            // than leaving the user with a silently-dead Continue button.
            console.error('[withdraw] no route matched for selected method', {
                type: selectedMethod.type,
                countryPath: selectedMethod.countryPath,
                hasBankAccount: !!selectedBankAccount,
            })
            setError({ showError: true, errorMessage: t('errors.setupFailed') })
        }
    }, [
        validateAmount,
        rawTokenAmount,
        selectedMethod,
        selectedBankAccount,
        isFromSendFlow,
        router,
        downstreamQuery,
        setError,
        t,
    ])

    const handleAmountBack = useCallback(() => {
        if (isCryptoFromSend) {
            // crypto from send: back leaves for /send (the method was implied)
            setSelectedMethod(null)
            goBackToSend()
            return
        }
        // back to method selection — clear the amount so it doesn't carry over
        // to a different method
        setRawTokenAmount('')
        void setUrlAmount(null)
        void setDestinationAmount(null)
        void setAmountCurrencyParam(null)
        filledFromBalanceRef.current = null
        setIsMaxWithdrawal(false)
        if (selectedMethod?.type === 'bridge' && !selectedBankAccount) {
            void setShowAll(true)
        }
        setSelectedMethod(null)
        setSelectedBankAccount(null)
        void stepper.back()
    }, [
        selectedMethod,
        selectedBankAccount,
        setShowAll,
        isCryptoFromSend,
        goBackToSend,
        setSelectedMethod,
        setSelectedBankAccount,
        setUrlAmount,
        setDestinationAmount,
        setAmountCurrencyParam,
        setIsMaxWithdrawal,
        stepper,
    ])

    // check if continue button should be disabled
    const continueDisabled = useMemo(() => {
        if (!rawTokenAmount) return true
        if (bankCurrency && !destinationAmount) return true

        const numericAmount = parseFloat(rawTokenAmount)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) return true

        if (numericAmount < minUsdAmount || belowBankMinimum) return true // below a payout minimum

        // only apply the balance ceiling once it has loaded (maxDecimalAmount is 0
        // while spendableBalance is undefined) — else Continue is disabled during load
        if ((balance !== undefined && numericAmount > maxDecimalAmount) || error.showError) return true

        // fiat limits gate — crypto has no fiat limits
        return !isCryptoWithdraw && (limitsValidation.isLoading || limitsValidation.isBlocking)
    }, [
        rawTokenAmount,
        bankCurrency,
        destinationAmount,
        balance,
        maxDecimalAmount,
        error.showError,
        minUsdAmount,
        belowBankMinimum,
        isCryptoWithdraw,
        limitsValidation.isLoading,
        limitsValidation.isBlocking,
    ])

    return {
        forwardsToCrypto,
        stepper,
        rawTokenAmount,
        walletBalance,
        maxDecimalAmount,
        handleBalanceFilled,
        error,
        isCryptoWithdraw,
        limitsValidation,
        continueDisabled,
        isFromSendFlow,
        isCryptoFromSend,
        isBankFromSend,
        selectedMethod,
        // bank amount typed in its currency (TASK-23054): null outside EUR, GBP, MXN and COP accounts
        bankAmount: bankCurrency
            ? {
                  currency: bankCurrency,
                  rate: bankRate.quote?.rate ?? null,
                  rateFailed: bankRate.isError,
                  refetchRate: bankRate.refetch,
                  destinationAmount,
                  onDestinationAmountChange: handleDestinationAmountChange,
                  isInUsd: isBankFieldInUsd,
                  onDenominationChange: (symbol: string) => {
                      const next = symbol.toUpperCase() === 'USD' ? 'usd' : null
                      if (next !== amountCurrencyParam) void setAmountCurrencyParam(next)
                  },
              }
            : null,
        handleAmountChange,
        handleAmountContinue,
        handleAmountBack,
    }
}
