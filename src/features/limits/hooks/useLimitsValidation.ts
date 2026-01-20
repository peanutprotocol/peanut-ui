'use client'

import { useMemo } from 'react'
import { useLimits } from '@/hooks/useLimits'
import useKycStatus from '@/hooks/useKycStatus'
import type { MantecaLimit } from '@/interfaces'
import {
    MAX_QR_PAYMENT_AMOUNT_FOREIGN,
    MAX_MANTECA_DEPOSIT_AMOUNT,
    MAX_MANTECA_WITHDRAW_AMOUNT,
} from '@/constants/payment.consts'
import { formatExtendedNumber } from '@/utils/general.utils'
import { mapToLimitCurrency, type LimitCurrency } from '../utils'

// threshold for showing warning (percentage of limit remaining after transaction)
const WARNING_THRESHOLD_PERCENT = 30

export type LimitValidationResult = {
    isBlocking: boolean
    isWarning: boolean
    remainingLimit: number | null
    totalLimit: number | null
    message: string | null
    daysUntilReset: number | null
}

export type LimitFlowType = 'onramp' | 'offramp' | 'qr-payment'
export { type LimitCurrency } from '../utils'

interface UseLimitsValidationOptions {
    flowType: LimitFlowType
    amount: number | string | null | undefined
    /**
     * currency code for the transaction (ARS, BRL, USD)
     * for qr payments this determines which manteca limit to check
     * defaults to USD
     */
    currency?: LimitCurrency | string
}

/**
 * hook to validate amounts against user's transaction limits
 * automatically determines if user is local (manteca) or foreign (bridge) based on their kyc status
 * returns warning/blocking state based on remaining limits
 */
export function useLimitsValidation({ flowType, amount, currency: currencyInput }: UseLimitsValidationOptions) {
    const { mantecaLimits, bridgeLimits, isLoading, hasMantecaLimits, hasBridgeLimits } = useLimits()
    const { isUserMantecaKycApproved, isUserBridgeKycApproved } = useKycStatus()

    // normalize currency to valid LimitCurrency type
    const currency = mapToLimitCurrency(currencyInput)

    // determine if user is "local" (has manteca kyc for latam operations)
    // this replaces the external isLocalUser parameter
    const isLocalUser = isUserMantecaKycApproved

    // parse amount to number
    const numericAmount = useMemo(() => {
        if (!amount) return 0
        const parsed = typeof amount === 'string' ? parseFloat(amount) : amount
        return isNaN(parsed) ? 0 : parsed
    }, [amount])

    // get relevant manteca limit based on currency
    const relevantMantecaLimit = useMemo<MantecaLimit | null>(() => {
        if (!mantecaLimits || mantecaLimits.length === 0) return null
        return mantecaLimits.find((limit) => limit.asset === currency) ?? null
    }, [mantecaLimits, currency])

    // calculate days until monthly reset (first of next month)
    const daysUntilMonthlyReset = useMemo(() => {
        const now = new Date()
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const diffTime = nextMonth.getTime() - now.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }, [])

    // validate for manteca users (argentina/brazil)
    const mantecaValidation = useMemo<LimitValidationResult>(() => {
        if (!isUserMantecaKycApproved || !relevantMantecaLimit) {
            return {
                isBlocking: false,
                isWarning: false,
                remainingLimit: null,
                totalLimit: null,
                message: null,
                daysUntilReset: null,
            }
        }

        const monthlyLimit = parseFloat(relevantMantecaLimit.monthlyLimit)
        const availableMonthly = parseFloat(relevantMantecaLimit.availableMonthlyLimit)

        // per-transaction max for manteca (different for onramp vs offramp)
        const perTxMax = flowType === 'onramp' ? MAX_MANTECA_DEPOSIT_AMOUNT : MAX_MANTECA_WITHDRAW_AMOUNT

        // effective limit is the lower of per-tx max and available monthly
        const effectiveLimit = Math.min(perTxMax, availableMonthly)

        // check if amount exceeds per-transaction max first (more restrictive)
        if (numericAmount > perTxMax) {
            return {
                isBlocking: true,
                isWarning: false,
                remainingLimit: perTxMax,
                totalLimit: perTxMax,
                message: `Maximum ${flowType === 'onramp' ? 'deposit' : 'withdrawal'} is $${formatExtendedNumber(perTxMax)} per transaction`,
                daysUntilReset: null, // per-tx limit doesn't reset
            }
        }

        // check if amount exceeds remaining monthly limit
        if (numericAmount > availableMonthly) {
            return {
                isBlocking: true,
                isWarning: false,
                remainingLimit: availableMonthly,
                totalLimit: monthlyLimit,
                message: `Amount exceeds your remaining limit of ${formatExtendedNumber(availableMonthly)} ${currency}`,
                daysUntilReset: daysUntilMonthlyReset,
            }
        }

        // check if amount is close to limit (warning)
        const afterTransaction = availableMonthly - numericAmount
        const afterPercent = monthlyLimit > 0 ? (afterTransaction / monthlyLimit) * 100 : 0

        if (afterPercent < WARNING_THRESHOLD_PERCENT && numericAmount > 0) {
            return {
                isBlocking: false,
                isWarning: true,
                remainingLimit: effectiveLimit,
                totalLimit: monthlyLimit,
                message: `This transaction will use most of your remaining limit`,
                daysUntilReset: daysUntilMonthlyReset,
            }
        }

        return {
            isBlocking: false,
            isWarning: false,
            remainingLimit: effectiveLimit,
            totalLimit: monthlyLimit,
            message: null,
            daysUntilReset: daysUntilMonthlyReset,
        }
    }, [isUserMantecaKycApproved, relevantMantecaLimit, numericAmount, currency, daysUntilMonthlyReset, flowType])

    // validate for bridge users (us/europe/mexico) - per transaction limits
    const bridgeValidation = useMemo<LimitValidationResult>(() => {
        if (!isUserBridgeKycApproved || !bridgeLimits) {
            return {
                isBlocking: false,
                isWarning: false,
                remainingLimit: null,
                totalLimit: null,
                message: null,
                daysUntilReset: null,
            }
        }

        // bridge has per-transaction limits, not cumulative
        const perTxLimit =
            flowType === 'onramp'
                ? parseFloat(bridgeLimits.onRampPerTransaction)
                : parseFloat(bridgeLimits.offRampPerTransaction)

        if (numericAmount > perTxLimit) {
            return {
                isBlocking: true,
                isWarning: false,
                remainingLimit: perTxLimit,
                totalLimit: perTxLimit,
                message: `Amount exceeds per-transaction limit of $${formatExtendedNumber(perTxLimit)}`,
                daysUntilReset: null,
            }
        }

        // warning when close to per-tx limit
        const usagePercent = perTxLimit > 0 ? (numericAmount / perTxLimit) * 100 : 0
        if (usagePercent > 80 && numericAmount > 0) {
            return {
                isBlocking: false,
                isWarning: true,
                remainingLimit: perTxLimit,
                totalLimit: perTxLimit,
                message: `This amount is close to your per-transaction limit`,
                daysUntilReset: null,
            }
        }

        return {
            isBlocking: false,
            isWarning: false,
            remainingLimit: perTxLimit,
            totalLimit: perTxLimit,
            message: null,
            daysUntilReset: null,
        }
    }, [isUserBridgeKycApproved, bridgeLimits, flowType, numericAmount])

    // qr payment validation for foreign users (non-manteca kyc)
    const foreignQrValidation = useMemo<LimitValidationResult>(() => {
        if (flowType !== 'qr-payment' || isLocalUser) {
            return {
                isBlocking: false,
                isWarning: false,
                remainingLimit: null,
                totalLimit: null,
                message: null,
                daysUntilReset: null,
            }
        }

        // foreign users have a per-transaction limit for qr payments
        if (numericAmount > MAX_QR_PAYMENT_AMOUNT_FOREIGN) {
            return {
                isBlocking: true,
                isWarning: false,
                remainingLimit: MAX_QR_PAYMENT_AMOUNT_FOREIGN,
                totalLimit: MAX_QR_PAYMENT_AMOUNT_FOREIGN,
                message: `QR payment limit is $${MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()} per transaction`,
                daysUntilReset: null,
            }
        }

        return {
            isBlocking: false,
            isWarning: false,
            remainingLimit: MAX_QR_PAYMENT_AMOUNT_FOREIGN,
            totalLimit: MAX_QR_PAYMENT_AMOUNT_FOREIGN,
            message: null,
            daysUntilReset: null,
        }
    }, [flowType, isLocalUser, numericAmount])

    // combined result - prioritize manteca for local users, bridge for others
    const validation = useMemo<LimitValidationResult>(() => {
        // for qr payments
        if (flowType === 'qr-payment') {
            // local users (manteca kyc) use manteca limits
            if (isLocalUser && isUserMantecaKycApproved) {
                return mantecaValidation
            }
            // foreign users have fixed per-tx limit
            return foreignQrValidation
        }

        // for onramp/offramp - check which provider applies
        // only use manteca if there's a relevant limit for the currency (prevents skipping bridge validation)
        if (isUserMantecaKycApproved && hasMantecaLimits && relevantMantecaLimit) {
            return mantecaValidation
        }
        if (isUserBridgeKycApproved && hasBridgeLimits) {
            return bridgeValidation
        }

        // no kyc - no limits to validate
        return {
            isBlocking: false,
            isWarning: false,
            remainingLimit: null,
            totalLimit: null,
            message: null,
            daysUntilReset: null,
        }
    }, [
        flowType,
        isLocalUser,
        isUserMantecaKycApproved,
        isUserBridgeKycApproved,
        hasMantecaLimits,
        hasBridgeLimits,
        relevantMantecaLimit,
        mantecaValidation,
        bridgeValidation,
        foreignQrValidation,
    ])

    return {
        ...validation,
        isLoading,
        // the effective currency being used for validation
        currency,
        // convenience getters
        hasLimits: hasMantecaLimits || hasBridgeLimits,
        isMantecaUser: isUserMantecaKycApproved,
        isBridgeUser: isUserBridgeKycApproved,
    }
}
