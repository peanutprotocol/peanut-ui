'use client'

import { tokenSelectorContext } from '@/context'
import { formatTokenAmount, formatCurrency } from '@/utils/general.utils'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '../Icon'
import { twMerge } from 'tailwind-merge'
import { Icon as IconComponent } from '@/components/Global/Icons/Icon'
import { Slider } from '../Slider'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { STABLE_COINS } from '@/constants/general.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'

interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
    setUsdValue?: (usdvalue: string) => void
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
    onSubmit?: () => void
    onBlur?: () => void
    disabled?: boolean
    walletBalance?: string
    currency?: {
        code: string
        symbol: string
        price: number
    }
    hideCurrencyToggle?: boolean
    hideBalance?: boolean
    showInfoText?: boolean
    infoText?: string
    showSlider?: boolean
    maxAmount?: number
    amountCollected?: number
    isInitialInputUsd?: boolean
    defaultSliderValue?: number
    defaultSliderSuggestedAmount?: number
}

const TokenAmountInput = ({
    className,
    tokenValue,
    setTokenValue,
    setCurrencyAmount,
    onSubmit,
    onBlur,
    disabled,
    walletBalance,
    currency,
    setUsdValue,
    hideCurrencyToggle = false,
    hideBalance = false,
    infoText,
    showInfoText,
    showSlider = false,
    maxAmount,
    amountCollected = 0,
    isInitialInputUsd = false,
    defaultSliderValue,
    defaultSliderSuggestedAmount,
}: TokenAmountInputProps) => {
    const { selectedTokenData } = useContext(tokenSelectorContext)
    const router = useRouter()
    const searchParams = useSearchParams()
    const inputRef = useRef<HTMLInputElement>(null)
    const inputType = useMemo(() => (window.innerWidth < 640 ? 'text' : 'number'), [])
    const [isFocused, setIsFocused] = useState(false)
    const { deviceType } = useDeviceType()
    // Only autofocus on desktop (WEB), not on mobile devices (IOS/ANDROID)
    const shouldAutoFocus = deviceType === DeviceType.WEB

    // Store display value for input field (what user sees when typing)
    const [displayValue, setDisplayValue] = useState<string>(tokenValue || '')
    const [isInputUsd, setIsInputUsd] = useState<boolean>(!currency || isInitialInputUsd)
    const [displaySymbol, setDisplaySymbol] = useState<string>('')
    const [alternativeDisplayValue, setAlternativeDisplayValue] = useState<string>('0.00')
    const [alternativeDisplaySymbol, setAlternativeDisplaySymbol] = useState<string>('')

    const displayMode = useMemo<'TOKEN' | 'STABLE' | 'FIAT'>(() => {
        if (currency) return 'FIAT'
        if (selectedTokenData?.symbol && STABLE_COINS.includes(selectedTokenData?.symbol)) {
            return 'STABLE'
        } else {
            return 'TOKEN'
        }
    }, [currency, selectedTokenData?.symbol])

    const decimals = useMemo<number>(() => {
        let _decimals: number
        if (displayMode === 'TOKEN' && isInputUsd && selectedTokenData?.decimals) {
            _decimals = selectedTokenData.decimals
        } else {
            _decimals = PEANUT_WALLET_TOKEN_DECIMALS
        }
        // For displaying the token amount, anything more breaks the UI
        return 6 < _decimals ? 6 : _decimals
    }, [displayMode, selectedTokenData?.decimals, isInputUsd])

    const calculateAlternativeValue = useCallback(
        (value: string) => {
            // There is no alternative display when dealing with stables
            if (displayMode === 'STABLE') return ''

            let price: number
            if (displayMode === 'TOKEN') {
                if (!selectedTokenData?.price) return ''
                price = selectedTokenData.price
            } else if (displayMode === 'FIAT') {
                if (!currency?.price) return ''
                price = 1 / currency.price
            } else {
                throw new Error('Invalid display mode')
            }

            if (isInputUsd) {
                return formatTokenAmount(Number(value) / price, decimals)!
            } else {
                return formatTokenAmount(Number(value) * price, decimals)!
            }
        },
        [displayMode, currency?.price, selectedTokenData?.price, isInputUsd, decimals]
    )

    const onChange = useCallback(
        (value: string, _isInputUsd: boolean) => {
            setDisplayValue(value)
            setAlternativeDisplayValue(calculateAlternativeValue(value))
            let tokenValue: string
            switch (displayMode) {
                case 'STABLE': {
                    tokenValue = value
                    break
                }
                case 'TOKEN': {
                    tokenValue = _isInputUsd ? (Number(value) / (selectedTokenData?.price ?? 1)).toString() : value
                    break
                }
                case 'FIAT': {
                    if (!currency?.price) throw new Error('Invalid currency')
                    const usdValue = _isInputUsd ? Number(value) : Number(value) / currency.price
                    // For when we have a non stablecoin request in currency mode
                    tokenValue = formatTokenAmount(usdValue / (selectedTokenData?.price ?? 1), decimals)!
                    const currencyValue = _isInputUsd ? (Number(value) * currency.price).toString() : value
                    setCurrencyAmount?.(currencyValue)
                    break
                }
                default: {
                    throw new Error('Invalid display mode')
                }
            }
            setTokenValue(tokenValue)
        },
        [displayMode, currency?.price, selectedTokenData?.price, calculateAlternativeValue]
    )

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
                const maxDecimals = displayMode === 'FIAT' || displayMode === 'STABLE' || isInputUsd ? 2 : decimals
                const formattedAmount = formatTokenAmount(selectedAmountStr, maxDecimals, true)
                if (formattedAmount) {
                    onChange(formattedAmount, isInputUsd)
                }
            }
        },
        [maxAmount, amountCollected, onChange, displayMode, isInputUsd, decimals]
    )

    const showConversion = useMemo(() => {
        return !hideCurrencyToggle && (displayMode === 'TOKEN' || displayMode === 'FIAT')
    }, [hideCurrencyToggle, displayMode])

    // This is needed because if we change the token we selected the value
    // should change. This only depends on the price on purpose!! we don't want
    // to change when we change the display mode or the value (we already call
    // onchange on the input change so dont add those dependencies here!)
    useEffect(() => {
        // early return if tokenValue is empty.
        if (!tokenValue) return

        if (!isInitialInputUsd) {
            const value = tokenValue ? Number(tokenValue) : 0
            const formattedValue = (value * (currency?.price ?? 1)).toFixed(2)
            onChange(formattedValue, isInputUsd)
        } else {
            onChange(displayValue, isInputUsd)
        }
    }, [selectedTokenData?.price])

    useEffect(() => {
        switch (displayMode) {
            case 'STABLE': {
                setDisplaySymbol('$')
                setAlternativeDisplaySymbol('')
                break
            }
            case 'TOKEN': {
                if (isInputUsd) {
                    setDisplaySymbol('$')
                    setAlternativeDisplaySymbol(selectedTokenData?.symbol || '')
                } else {
                    setDisplaySymbol(selectedTokenData?.symbol || '')
                    setAlternativeDisplaySymbol('$')
                }
                break
            }
            case 'FIAT': {
                if (isInputUsd) {
                    setDisplaySymbol('USD')
                    setAlternativeDisplaySymbol(currency?.symbol || '')
                } else {
                    setDisplaySymbol(currency?.symbol || '')
                    setAlternativeDisplaySymbol('USD')
                }
                break
            }
            default: {
                throw new Error('Invalid display mode')
            }
        }
    }, [displayMode, selectedTokenData?.symbol, currency?.symbol, isInputUsd])

    useEffect(() => {
        if (inputRef.current) {
            if (displayValue?.length !== 0) {
                inputRef.current.style.width = `${displayValue?.length ?? 0}ch`
            } else {
                inputRef.current.style.width = `4ch`
            }
        }
    }, [displayValue, currency])

    useEffect(() => {
        if (!setUsdValue) return
        if (displayMode === 'STABLE') {
            setUsdValue(displayValue)
        } else {
            setUsdValue(isInputUsd ? displayValue : alternativeDisplayValue)
        }
    }, [setUsdValue, displayValue, alternativeDisplayValue, isInputUsd, displayMode])

    const formRef = useRef<HTMLFormElement>(null)

    const sliderValue = useMemo(() => {
        if (!maxAmount || !tokenValue) return [0]
        const tokenNum = parseFloat(tokenValue.replace(/,/g, ''))
        const usdValue = tokenNum * (selectedTokenData?.price ?? 1)
        return [(usdValue / maxAmount) * 100]
    }, [maxAmount, tokenValue, selectedTokenData?.price])

    const handleContainerClick = () => {
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }

    // Sync default slider suggested amount to the input
    useEffect(() => {
        if (defaultSliderSuggestedAmount) {
            const formattedAmount = formatTokenAmount(defaultSliderSuggestedAmount.toString(), 2)
            if (formattedAmount) {
                setTokenValue(formattedAmount)
                setDisplayValue(formattedAmount)
            }
        }
    }, [defaultSliderSuggestedAmount])

    console.log(displayValue)

    return (
        <form
            ref={formRef}
            className={`relative cursor-text rounded-sm border border-n-1 bg-white p-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                <div className="flex items-center gap-1 font-bold">
                    <label className={`text-xl ${displayValue ? 'text-black' : 'text-gray-1'}`}>{displaySymbol}</label>

                    {/* Input with fake caret */}
                    <div className="relative">
                        <input
                            autoFocus={shouldAutoFocus}
                            className={`h-12 w-[4ch] max-w-80 bg-transparent text-6xl font-black text-black caret-primary-1 outline-none transition-colors placeholder:text-h1 placeholder:text-gray-1 focus:border-primary-1 disabled:opacity-100 disabled:[-webkit-text-fill-color:black] dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1 dark:disabled:[-webkit-text-fill-color:white]`}
                            placeholder={'0.00'}
                            onChange={(e) => {
                                let value = e.target.value
                                // USD/currency → 2 decimals; token input → allow `decimals` (<= 6)
                                const maxDecimals =
                                    displayMode === 'FIAT' || displayMode === 'STABLE' || isInputUsd ? 2 : decimals
                                const formattedAmount = formatTokenAmount(value, maxDecimals, true)
                                if (formattedAmount !== undefined) {
                                    value = formattedAmount
                                }
                                onChange(value, isInputUsd)
                            }}
                            ref={inputRef}
                            inputMode="decimal"
                            type={inputType}
                            value={displayValue.replace(/,/g, '')}
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
                    <label className={twMerge('text-lg font-bold', !Number(alternativeDisplayValue) && 'text-gray-1')}>
                        ≈{' '}
                        {displayMode === 'TOKEN'
                            ? alternativeDisplayValue
                            : alternativeDisplayValue
                              ? formatCurrency(alternativeDisplayValue.replace(',', ''))
                              : '0.00'}{' '}
                        {alternativeDisplaySymbol}
                    </label>
                )}

                {/* Balance */}
                {walletBalance && !hideBalance && (
                    <div className="text-center text-grey-1">
                        Balance: {displayMode === 'FIAT' && currency ? 'USD ' : '$ '}
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
                        const currentValue = displayValue
                        if (!alternativeDisplayValue || alternativeDisplayValue === '0.00') {
                            setDisplayValue('')
                        } else {
                            setDisplayValue(alternativeDisplayValue)
                        }
                        if (!currentValue) {
                            setAlternativeDisplayValue('0.00')
                        } else {
                            setAlternativeDisplayValue(currentValue)
                        }
                        setIsInputUsd(!isInputUsd)

                        // Toggle swap-currency parameter in URL
                        const params = new URLSearchParams(searchParams.toString())
                        const currentSwapValue = params.get('swap-currency')
                        if (currentSwapValue === 'true') {
                            params.set('swap-currency', 'false')
                        } else {
                            params.set('swap-currency', 'true')
                        }
                        router.replace(`?${params.toString()}`, { scroll: false })
                    }}
                >
                    <Icon name={'switch'} className="ml-5 rotate-90 cursor-pointer" width={32} height={32} />
                </div>
            )}
            {showInfoText && infoText && (
                <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-grey-2 p-1.5">
                    <IconComponent name="info" size={12} className="text-grey-1" />
                    <p className="text-[10px] font-bold text-grey-1">{infoText}</p>
                </div>
            )}
            {showSlider && maxAmount && (
                <div className="mt-2 h-14">
                    <Slider
                        onValueChange={onSliderValueChange}
                        value={sliderValue}
                        defaultValue={[defaultSliderValue ? defaultSliderValue : 100]}
                    />
                </div>
            )}
        </form>
    )
}

export default TokenAmountInput
