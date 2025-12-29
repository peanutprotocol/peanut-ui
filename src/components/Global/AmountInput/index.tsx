'use client'

import { formatTokenAmount } from '@/utils/general.utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon as IconComponent } from '@/components/Global/Icons/Icon'
import { Slider } from '../Slider'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

// Used for internal calculations, not displayed to the user
const DECIMAL_SCALE = 18 // Max expected decimal places for any denomination

interface AmountInputProps {
    className?: string
    initialAmount?: string
    onSubmit?: () => void
    setPrimaryAmount: (value: string) => void
    setSecondaryAmount?: (value: string) => void
    onBlur?: () => void
    disabled?: boolean
    primaryDenomination?: { symbol: string; price: number; decimals: number }
    secondaryDenomination?: { symbol: string; price: number; decimals: number }
    setCurrentDenomination?: (denomination: string) => void
    walletBalance?: string
    hideCurrencyToggle?: boolean
    hideBalance?: boolean
    infoContent?: React.ReactNode

    showSlider?: boolean
    maxAmount?: number
    amountCollected?: number
    defaultSliderValue?: number
    defaultSliderSuggestedAmount?: number
}

const AmountInput = ({
    className,
    initialAmount,
    onSubmit,
    setPrimaryAmount,
    setSecondaryAmount,
    onBlur,
    disabled,
    primaryDenomination = { symbol: '$', price: 1, decimals: 2 },
    secondaryDenomination,
    setCurrentDenomination,
    walletBalance,
    hideCurrencyToggle,
    hideBalance,
    infoContent,

    showSlider = false,
    maxAmount,
    amountCollected = 0,
    defaultSliderValue,
    defaultSliderSuggestedAmount,
}: AmountInputProps) => {
    const [isFocused, setIsFocused] = useState(false)
    const { deviceType } = useDeviceType()
    // Only autofocus on desktop (WEB), not on mobile devices (IOS/ANDROID)
    const shouldAutoFocus = deviceType === DeviceType.WEB
    const showConversion = !hideCurrencyToggle && !!secondaryDenomination

    // Store display value for input field (what user sees when typing)
    const [displayValue, setDisplayValue] = useState<string>(initialAmount || '')
    const [exactValue, setExactValue] = useState(Number(initialAmount || '') * 10 ** DECIMAL_SCALE)
    const [displaySymbol, setDisplaySymbol] = useState<string>(primaryDenomination.symbol)

    const denominations = {
        [primaryDenomination.symbol]: primaryDenomination,
    }
    if (secondaryDenomination) {
        denominations[secondaryDenomination.symbol] = secondaryDenomination
    }

    const alternativeDisplaySymbol = useMemo(() => {
        return Object.keys(denominations).find((key) => key !== displaySymbol) ?? ''
    }, [displaySymbol])

    useEffect(() => {
        if (setCurrentDenomination) {
            setCurrentDenomination(displaySymbol)
        }
    }, [displaySymbol])

    /*
     * Rate needed to convert from primary to secondary denomination by
     * multiplying the primary rate by the exchange rate.
     * Expressed as a integer with the scale of the max resolution denomination
     */
    const exchangeRate = useMemo(() => {
        if (!secondaryDenomination) return 1
        const alternativePrice = denominations[alternativeDisplaySymbol]?.price
        const mainPrice = denominations[displaySymbol]?.price
        return alternativePrice / mainPrice
    }, [displaySymbol, alternativeDisplaySymbol, secondaryDenomination])

    const alternativeValue = useMemo(() => {
        if (!secondaryDenomination || !displayValue) return 0
        return exactValue * exchangeRate
    }, [exactValue, secondaryDenomination, exchangeRate, displayValue])

    const alternativeDisplayValue = useMemo(() => {
        if (!secondaryDenomination || !alternativeValue) return '0.00'
        const scaledDownValue = alternativeValue / 10 ** DECIMAL_SCALE
        return formatTokenAmount(scaledDownValue, denominations[alternativeDisplaySymbol]?.decimals) ?? '0.00'
    }, [alternativeValue, alternativeDisplaySymbol, secondaryDenomination])

    useEffect(() => {
        const isPrimaryDenomination = displaySymbol === primaryDenomination.symbol
        // Strip commas before passing to consumers - they expect raw numeric strings
        const rawDisplayValue = displayValue.replace(/,/g, '')
        const rawAlternativeValue = alternativeDisplayValue.replace(/,/g, '')

        if (isPrimaryDenomination) {
            setPrimaryAmount(rawDisplayValue)
            setSecondaryAmount?.(rawAlternativeValue)
        } else {
            setPrimaryAmount(rawAlternativeValue)
            setSecondaryAmount?.(rawDisplayValue)
        }
    }, [displayValue, alternativeDisplayValue, displaySymbol, secondaryDenomination])

    const onSliderValueChange = useCallback(
        (value: number[]) => {
            if (maxAmount) {
                const selectedPercentage = value[0]
                let selectedAmount = (selectedPercentage / 100) * maxAmount

                // Only snap to exact remaining amount when user selects the 33.33% magnetic snap point
                // This ensures equal splits fill the pot exactly to 100%
                const SNAP_POINT_TOLERANCE = 0.5 // percentage points - allows magnetic snapping
                const COMPLETION_THRESHOLD = 0.98 // 98% - if 33.33% would nearly complete pot
                const EQUAL_SPLIT_PERCENTAGE = 100 / 3 // 33.333...%

                const isAt33SnapPoint = Math.abs(selectedPercentage - EQUAL_SPLIT_PERCENTAGE) < SNAP_POINT_TOLERANCE
                if (isAt33SnapPoint && amountCollected > 0) {
                    const remainingAmount = maxAmount - amountCollected
                    // Only snap if there's remaining amount and 33.33% would nearly complete the pot
                    if (remainingAmount > 0 && selectedAmount >= remainingAmount * COMPLETION_THRESHOLD) {
                        selectedAmount = remainingAmount
                    }
                }

                const selectedAmountStr = parseFloat(selectedAmount.toFixed(4)).toString()
                const formattedAmount = formatTokenAmount(
                    selectedAmountStr,
                    denominations[displaySymbol]?.decimals,
                    true
                )
                if (formattedAmount) {
                    setDisplayValue(formattedAmount)
                    setExactValue(Number(formattedAmount) * 10 ** DECIMAL_SCALE)
                }
            }
        },
        [maxAmount, amountCollected]
    )

    // Sync default slider suggested amount to the input
    useEffect(() => {
        if (defaultSliderSuggestedAmount) {
            const formattedAmount = formatTokenAmount(defaultSliderSuggestedAmount.toString(), 2)
            if (formattedAmount) {
                setDisplayValue(formattedAmount)
                setExactValue(Number(formattedAmount) * 10 ** DECIMAL_SCALE)
            }
        }
    }, [defaultSliderSuggestedAmount])

    const inputRef = useRef<HTMLInputElement>(null)
    // Set input width based on display value length
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.width = displayValue?.length ? `${displayValue.length}ch` : '4ch'
        }
    }, [displayValue])

    return (
        <form
            className={`relative cursor-text rounded-sm border border-n-1 bg-white p-4 dark:border-white ${className}`}
            action=""
            onClick={() => inputRef.current?.focus()}
        >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                <div className="flex items-center gap-1 font-bold">
                    <label className={`text-xl ${displayValue ? 'text-black' : 'text-gray-1'}`}>{displaySymbol}</label>

                    {/* Input with fake caret */}
                    <div className="relative">
                        <input
                            autoFocus={shouldAutoFocus}
                            className={`h-12 max-w-80 bg-transparent text-6xl font-black text-black caret-primary-1 outline-none transition-colors placeholder:text-h1 placeholder:text-gray-1 focus:border-primary-1 disabled:opacity-100 disabled:[-webkit-text-fill-color:black] dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1 dark:disabled:[-webkit-text-fill-color:white]`}
                            placeholder={'0.00'}
                            onChange={(e) => {
                                let value = e.target.value
                                const maxDecimals = denominations[displaySymbol].decimals
                                const formattedAmount = formatTokenAmount(value, maxDecimals, true)
                                if (formattedAmount !== undefined) {
                                    value = formattedAmount
                                }
                                setDisplayValue(value)
                                setExactValue(Number(value) * 10 ** DECIMAL_SCALE)
                            }}
                            ref={inputRef}
                            inputMode="decimal"
                            type="number"
                            value={displayValue}
                            step="any"
                            min="0"
                            autoComplete="off"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (onSubmit) onSubmit()
                                }
                            }}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                setIsFocused(false)
                                if (onBlur) onBlur()
                            }}
                            disabled={disabled}
                        />
                        {/* Fake blinking caret shown when not focused and input is empty */}
                        {!isFocused && !displayValue && (
                            <div className="pointer-events-none absolute left-0 top-1/2 h-12 w-[1px] -translate-y-1/2 animate-blink bg-primary-1" />
                        )}
                    </div>
                </div>

                {/* Conversion */}
                {showConversion && (
                    <label className={twMerge('text-lg font-bold', !Number(alternativeValue) && 'text-gray-1')}>
                        ≈ {alternativeDisplaySymbol} {alternativeDisplayValue}{' '}
                    </label>
                )}

                {/* Balance */}
                {walletBalance && !hideBalance && (
                    <div className="text-center text-grey-1">
                        Balance: {secondaryDenomination ? 'USD ' : '$ '}
                        {walletBalance}
                    </div>
                )}
            </div>
            {/* Conversion toggle */}
            {showConversion && (
                <div
                    className="absolute right-0 top-1/2 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault()
                        setExactValue(alternativeValue)
                        setDisplayValue(alternativeDisplayValue.replace(/,/g, ''))
                        setDisplaySymbol(alternativeDisplaySymbol)
                    }}
                >
                    <IconComponent name={'arrow-exchange'} className="ml-5 rotate-90 cursor-pointer" width={32} height={32} />
                </div>
            )}
            {infoContent}
            {showSlider && maxAmount && (
                <div className="mt-2 h-14">
                    <Slider
                        onValueChange={onSliderValueChange}
                        value={[(exactValue / 10 ** DECIMAL_SCALE / maxAmount) * 100]}
                        defaultValue={[defaultSliderValue ? defaultSliderValue : 100]}
                    />
                </div>
            )}
        </form>
    )
}

export default AmountInput
