'use client'

import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getCountryFromAccount, getCountryFromPath } from '@/utils/bridge.utils'
import { bankWithdrawMinUsd } from './amount-validation'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { AccountType } from '@/interfaces/interfaces'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { withdrawBankUrl, withdrawCountryUrl } from '@/utils/native-routes'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { parseAsString, useQueryState } from 'nuqs'
import { useTranslations } from 'next-intl'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useWithdrawFlow } from './WithdrawFlowContext'
import { useWithdrawAmount } from './useWithdrawAmount'
import { WITHDRAW_ROOT_STEPS } from './types'

/**
 * Flow hook for the root /withdraw page: the method → amount stepper (step in
 * the URL as a named screen id), the USD amount (also in the URL), amount
 * validation, and the per-method continue routing. Views stay dumb.
 */
export function useWithdrawRootFlow() {
    const router = useRouter()
    const t = useTranslations('withdraw')
    const tErrors = useTranslations('errors')

    const [methodParam] = useQueryState('method', parseAsString)
    const [returnToParam] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const { isFromSendFlow, isCryptoFromSend, isBankFromSend } = useSendFlowOrigin()

    const { error, setError, selectedMethod, selectedBankAccount, setSelectedBankAccount, setSelectedMethod } =
        useWithdrawFlow()

    const [urlAmount, setUrlAmount] = useWithdrawAmount()
    // raw amount currently typed in the input; the URL is the commit point
    const [rawTokenAmount, setRawTokenAmount] = useState<string>(urlAmount)

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
                router.push('/send')
                return
            }
            // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA)
            // wins over the /home reset, which only fits tab-bar entries
            const returnTo = readReturnTo(
                { get: (key: string) => (key === RETURN_TO_PARAM ? returnToParam : null) },
                '/withdraw'
            )
            router.push(returnTo ?? '/home')
        },
    })

    // Send → Exchange or Wallet enters as /withdraw?method=crypto: the method
    // is implied, so commit it and land straight on the amount step.
    useEffect(() => {
        if (!isCryptoFromSend) return
        if (!selectedMethod) {
            setSelectedMethod({ type: 'crypto', title: 'Crypto', countryPath: undefined })
        }
        if (stepper.step === 'method') void stepper.goTo('amount')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCryptoFromSend, selectedMethod, stepper.step])

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

    // derive country and account type for minimum amount validation
    const { countryIso2, rateAccountType } = useMemo(() => {
        if (selectedBankAccount) {
            const country = getCountryFromAccount(selectedBankAccount)
            return { countryIso2: country?.iso2 || '', rateAccountType: selectedBankAccount.type as AccountType }
        }
        if (selectedMethod?.countryPath) {
            const country = getCountryFromPath(selectedMethod.countryPath)
            const iso2 = country?.iso2 || ''
            let accountType: AccountType = AccountType.IBAN
            if (iso2 === 'US') accountType = AccountType.US
            else if (iso2 === 'GB') accountType = AccountType.GB
            else if (iso2 === 'MX') accountType = AccountType.CLABE
            return { countryIso2: iso2, rateAccountType: accountType }
        }
        return { countryIso2: '', rateAccountType: AccountType.US }
    }, [selectedBankAccount, selectedMethod])

    // crypto withdrawals are plain on-chain transfers — fiat-rail minimums don't
    // apply. selectedMethod is the routing source of truth; the URL param only
    // covers the first render before the mount effect commits the crypto method.
    const isCryptoWithdraw = selectedMethod ? selectedMethod.type === 'crypto' : isCryptoFromSend

    // fetch exchange rate for non-USD countries to convert local minimum to USD
    const { exchangeRate } = useGetExchangeRate({
        accountType: rateAccountType,
        enabled: !isCryptoWithdraw && rateAccountType !== AccountType.US && countryIso2 !== '',
    })

    // compute minimum withdrawal in USD using the exchange rate
    const minUsdAmount = useMemo(() => {
        // no amount-step minimum for crypto: same-chain (Arbitrum) withdrawals
        // are direct transfers with no floor, matching send-via-link. Rhino's
        // per-network bridge minimums are enforced chain-aware at review time
        // (see withdraw/crypto), once the destination is known.
        if (isCryptoWithdraw) return 0
        // shared with the submit-side re-check in useBridgeOfframpFlow (Chip
        // round 5) — one conversion, two enforcement points
        return bankWithdrawMinUsd(countryIso2, exchangeRate)
    }, [isCryptoWithdraw, countryIso2, exchangeRate])

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
            if (usdEquivalent >= minUsdAmount && (!balanceLoaded || amount <= maxDecimalAmount)) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            // determine message
            let message = ''
            if (usdEquivalent < minUsdAmount) {
                const minDisplay = minUsdAmount % 1 === 0 ? `$${minUsdAmount}` : `$${minUsdAmount.toFixed(2)}`
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
        [balance, maxDecimalAmount, setError, isFromSendFlow, minUsdAmount, t, tErrors]
    )

    const handleAmountChange = useCallback(
        (value: string | undefined) => {
            let newValue = value || ''
            // treat leading "0" from initial AmountInput mount as empty
            if (newValue === '0') {
                newValue = ''
            }
            setRawTokenAmount(newValue)

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
            // shareable mid-flow) — nuqs throttles the actual history writes
            void setUrlAmount(newValue === '' ? null : newValue)

            // clear any existing errors when user starts typing
            if (error.showError) {
                setError({ showError: false, errorMessage: '' })
            }
        },
        [setUrlAmount, error.showError, setError]
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
            if (rawTokenAmount) params.set('amount', rawTokenAmount)
            const qs = params.toString()
            return qs ? `?${qs}` : ''
        },
        [isFromSendFlow, methodParam, rawTokenAmount]
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
            // Bridge (and any other) countries go to the country page for the
            // bank-account form
            router.push(withdrawCountryUrl(selectedMethod.countryPath, downstreamQuery()))
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
            router.push('/send')
            return
        }
        // back to method selection — clear the amount so it doesn't carry over
        // to a different method
        setRawTokenAmount('')
        void setUrlAmount(null)
        setSelectedMethod(null)
        setSelectedBankAccount(null)
        void stepper.back()
    }, [isCryptoFromSend, router, setSelectedMethod, setSelectedBankAccount, setUrlAmount, stepper])

    // check if continue button should be disabled
    const continueDisabled = useMemo(() => {
        if (!rawTokenAmount) return true

        const numericAmount = parseFloat(rawTokenAmount)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) return true

        if (numericAmount < minUsdAmount) return true // below the method's USD minimum

        // only apply the balance ceiling once it has loaded (maxDecimalAmount is 0
        // while spendableBalance is undefined) — else Continue is disabled during load
        if ((balance !== undefined && numericAmount > maxDecimalAmount) || error.showError) return true

        // fiat limits gate — crypto has no fiat limits
        return !isCryptoWithdraw && (limitsValidation.isLoading || limitsValidation.isBlocking)
    }, [
        rawTokenAmount,
        balance,
        maxDecimalAmount,
        error.showError,
        minUsdAmount,
        isCryptoWithdraw,
        limitsValidation.isLoading,
        limitsValidation.isBlocking,
    ])

    return {
        stepper,
        rawTokenAmount,
        walletBalance,
        error,
        isCryptoWithdraw,
        limitsValidation,
        continueDisabled,
        isFromSendFlow,
        isCryptoFromSend,
        isBankFromSend,
        selectedMethod,
        handleAmountChange,
        handleAmountContinue,
        handleAmountBack,
    }
}
