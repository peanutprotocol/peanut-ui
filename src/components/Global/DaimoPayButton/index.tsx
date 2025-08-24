'use client'

import { Button } from '@/components/0_Bruddle'
import { IconName } from '@/components/Global/Icons/Icon'
import { PEANUT_WALLET_TOKEN } from '@/constants'
import { DaimoPayButton as DaimoPayButtonSDK, useDaimoPayUI } from '@daimo/pay'
import { useCallback } from 'react'
import { getAddress } from 'viem'
import { arbitrum } from 'viem/chains'

export interface DaimoPayButtonProps {
    /** The amount to deposit in USD (will be converted to token units) */
    amount: string
    /** The recipient address */
    toAddress: string
    /** Button text */
    children: React.ReactNode
    /** Button variant */
    variant?: 'purple' | 'primary-soft' | 'stroke'
    /** Button icon */
    icon?: IconName
    /** Icon size */
    iconSize?: number
    /** Whether the button is disabled */
    disabled?: boolean
    /** Whether the button is loading */
    loading?: boolean
    /** Additional button className */
    className?: string
    /** Shadow size for the button */
    shadowSize?: '4' | '6' | '8'
    /** Callback when payment is completed */
    onPaymentCompleted: (paymentResponse: any) => void
    /** Callback when modal is closed */
    onClose?: () => void
    /** Custom validation function that runs before showing Daimo modal */
    onBeforeShow?: () => Promise<boolean | undefined> | boolean
    /** Minimum amount validation (in USD) */
    minAmount?: number
    /** Maximum amount validation (in USD) */
    maxAmount?: number
    /** Custom error setter for validation errors */
    onValidationError?: (error: string | null) => void
}

export const DaimoPayButton = ({
    amount,
    toAddress,
    children,
    variant = 'purple',
    icon,
    iconSize,
    disabled = false,
    loading = false,
    className = 'w-full',
    shadowSize = '4',
    onPaymentCompleted,
    onClose,
    onBeforeShow,
    minAmount,
    maxAmount,
    onValidationError,
}: DaimoPayButtonProps) => {
    const { resetPayment } = useDaimoPayUI()

    const handleClick = useCallback(async () => {
        // Parse and validate amount
        const formattedAmount = parseFloat(amount.replace(/,/g, ''))

        // Validate amount range if specified
        if (minAmount !== undefined && formattedAmount < minAmount) {
            onValidationError?.(`Minimum deposit is $${minAmount.toFixed(2)}.`)
            return false
        }

        if (maxAmount !== undefined && formattedAmount > maxAmount) {
            onValidationError?.(`Maximum deposit is $${maxAmount.toFixed(2)}.`)
            return false
        }

        // Clear any previous validation errors
        onValidationError?.(null)

        // Run custom validation if provided
        if (onBeforeShow) {
            const isValid = await onBeforeShow()
            if (!isValid) return false
        }

        // Reset payment amount for Daimo
        await resetPayment({
            toUnits: amount.replace(/,/g, ''),
        })

        return true
    }, [amount, minAmount, maxAmount, onValidationError, onBeforeShow, resetPayment])

    // Get the Daimo App ID from environment
    const daimoAppId = process.env.NEXT_PUBLIC_DAIMO_APP_ID
    if (!daimoAppId) {
        throw new Error('Daimo APP ID is required')
    }

    return (
        <DaimoPayButtonSDK.Custom
            appId={daimoAppId}
            intent="Deposit"
            toChain={arbitrum.id}
            toUnits={amount.replace(/,/g, '')}
            toAddress={getAddress(toAddress)}
            toToken={getAddress(PEANUT_WALLET_TOKEN)} // USDC on arbitrum
            onPaymentCompleted={onPaymentCompleted}
            closeOnSuccess
            onClose={onClose}
        >
            {({ show }) => (
                <Button
                    onClick={async () => {
                        const canShow = await handleClick()
                        if (canShow) {
                            show()
                        }
                    }}
                    variant={variant}
                    shadowSize={shadowSize}
                    disabled={disabled || amount.length === 0}
                    loading={loading}
                    className={className}
                    icon={icon}
                    iconSize={iconSize}
                >
                    {children}
                </Button>
            )}
        </DaimoPayButtonSDK.Custom>
    )
}

export default DaimoPayButton
