'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PEANUT_WALLET_TOKEN } from '@/constants'
import { DaimoPayButton as DaimoPayButtonSDK, useDaimoPayUI } from '@daimo/pay'
import { useCallback, useEffect } from 'react'
import { getAddress } from 'viem'
import { arbitrum } from 'viem/chains'

export interface DaimoPayButtonProps {
    /** The amount to deposit in USD (will be converted to token units) */
    amount: string
    /** The recipient address */
    toAddress: string
    /** Target chain ID (defaults to Arbitrum if not specified) */
    toChainId?: number
    /** Target token address (defaults to USDC on Arbitrum if not specified) */
    toTokenAddress?: string
    /**
     * Render function that receives click handler and other props
     * OR React node for backwards compatibility
     */
    children:
        | React.ReactNode
        | ((props: { onClick: () => Promise<void>; disabled: boolean; loading: boolean }) => React.ReactElement | null)
    /** Button variant (only used with default button) */
    variant?: 'purple' | 'primary-soft' | 'stroke'
    /** Button icon (only used with default button) */
    icon?: IconName
    /** Icon size (only used with default button) */
    iconSize?: number
    /** Whether the button is disabled */
    disabled?: boolean
    /** Whether the button is loading */
    loading?: boolean
    /** Additional button className (only used with default button) */
    className?: string
    /** Shadow size for the button (only used with default button) */
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
    toChainId,
    toTokenAddress,
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
            onValidationError?.(`Minimum deposit using crypto is $${minAmount}.`)
            return false
        }

        if (maxAmount !== undefined && formattedAmount > maxAmount) {
            onValidationError?.(`Maximum deposit using crypto is $${maxAmount}.`)
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
            toUnits: formattedAmount.toString(),
        })

        return true
    }, [amount, minAmount, maxAmount, onValidationError, onBeforeShow, resetPayment])

    // Get the Daimo App ID from environment
    const daimoAppId = process.env.NEXT_PUBLIC_DAIMO_APP_ID
    if (!daimoAppId) {
        throw new Error('Daimo APP ID is required')
    }

    useEffect(() => {
        if (typeof document === 'undefined') return

        const hideIfWalletBtn = (el: Element) => {
            if (el instanceof HTMLButtonElement && /pay with wallet/i.test(el.textContent ?? '')) {
                if (el.style.display !== 'none') el.style.display = 'none'
            }
        }

        // Initial pass (keep broad but cheap)
        document.querySelectorAll('button').forEach(hideIfWalletBtn)

        // Observe only added nodes; scan their subtree
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type !== 'childList') continue
                m.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return
                    if (node.matches('button')) hideIfWalletBtn(node)
                    node.querySelectorAll('button').forEach(hideIfWalletBtn)
                })
            }
        })
        observer.observe(document.body, { childList: true, subtree: true })

        return () => observer.disconnect()
    }, [])

    return (
        <DaimoPayButtonSDK.Custom
            resetOnSuccess // resets the daimo payment state after payment is successfully completed
            appId={daimoAppId}
            intent="Deposit"
            toChain={toChainId ?? arbitrum.id} // use provided chain or default to arbitrum
            toUnits={amount.replace(/,/g, '')}
            toAddress={getAddress(toAddress)}
            toToken={getAddress(toTokenAddress ?? PEANUT_WALLET_TOKEN)} // use provided token or default to usdc on arbitrum
            onPaymentCompleted={onPaymentCompleted}
            closeOnSuccess
            onClose={onClose}
        >
            {({ show }) => {
                // Compute robust disabled state once
                const isDisabled = disabled || amount.length === 0

                const handleButtonClick = async () => {
                    // Short-circuit if disabled to prevent opening modal with invalid input
                    if (isDisabled) {
                        return
                    }

                    const canShow = await handleClick()
                    if (canShow) {
                        show()
                    }
                }

                // If children is a function, call it with the necessary props
                if (typeof children === 'function') {
                    const customElement = children({
                        onClick: handleButtonClick,
                        disabled: isDisabled,
                        loading,
                    })

                    // Ensure we return a valid React element
                    if (!customElement) {
                        return <div />
                    }

                    return customElement as React.ReactElement
                }

                // Otherwise, render the default Button (backwards compatibility)
                return (
                    <Button
                        onClick={handleButtonClick}
                        variant={variant}
                        shadowSize={shadowSize}
                        disabled={isDisabled}
                        loading={loading}
                        className={className}
                        icon={icon}
                        iconSize={iconSize}
                    >
                        {children}
                    </Button>
                )
            }}
        </DaimoPayButtonSDK.Custom>
    )
}

export default DaimoPayButton
