'use client'

import { formatTokenAmount } from '@/utils/general.utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon as IconComponent } from '@/components/Global/Icons/Icon'
import { Slider } from '../Slider'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useTranslations } from 'next-intl'

// Used for internal calculations, not displayed to the user
const DECIMAL_SCALE = 18 // Max expected decimal places for any denomination

interface AmountInputProps {
    className?: string
    initialAmount?: string
    initialDenomination?: string
    onSubmit?: () => void
    setPrimaryAmount: (value: string) => void
    setSecondaryAmount?: (value: string) => void
    setDisplayedAmount?: (value: string) => void
    onBlur?: () => void
    disabled?: boolean
    primaryDenomination?: { symbol: string; price: number; decimals: number }
    secondaryDenomination?: { symbol: string; price: number; decimals: number }
    setCurrentDenomination?: (denomination: string) => void
    walletBalance?: string
    /**
     * Exact amount, in the primary denomination, that tapping the balance row
     * fills in. Omit to keep the balance row plain text.
     */
    balanceFillAmount?: number
    /** Called with the amount actually filled when the balance row is tapped. */
    onBalanceFilled?: (value: string) => void
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
    initialDenomination,
    onSubmit,
    setPrimaryAmount,
    setSecondaryAmount,
    setDisplayedAmount,
    onBlur,
    disabled,
    primaryDenomination = { symbol: '$', price: 1, decimals: 2 },
    secondaryDenomination,
    setCurrentDenomination,
    walletBalance,
    balanceFillAmount,
    onBalanceFilled,
    hideCurrencyToggle,
    hideBalance,
    infoContent,

    showSlider = false,
    maxAmount,
    amountCollected = 0,
    defaultSliderValue,
    defaultSliderSuggestedAmount,
}: AmountInputProps) => {
    const t = useTranslations('global')
    const [isFocused, setIsFocused] = useState(false)
    const { deviceType } = useDeviceType()
    // Only autofocus on desktop (WEB), not on mobile devices (IOS/ANDROID)
    const shouldAutoFocus = deviceType === DeviceType.WEB
    const showConversion = !hideCurrencyToggle && !!secondaryDenomination

    // Store display value for input field (what user sees when typing)
    const [displayValue, setDisplayValue] = useState<string>(initialAmount || '')
    const [exactValue, setExactValue] = useState(Number(initialAmount || '') * 10 ** DECIMAL_SCALE)
    // Use initialDenomination if provided and valid, otherwise default to primaryDenomination
    const [displaySymbol, setDisplaySymbol] = useState<string>(() => {
        if (initialDenomination) {
            // Check if initialDenomination matches primary or secondary
            if (initialDenomination === primaryDenomination.symbol) {
                return primaryDenomination.symbol
            }
            if (secondaryDenomination && initialDenomination === secondaryDenomination.symbol) {
                return secondaryDenomination.symbol
            }
        }
        return primaryDenomination.symbol
    })

    // Track when user is actively editing to prevent feedback loops from initialAmount sync
    const isEditingRef = useRef(false)

    // Check if displayValue has a meaningful numeric value (not empty, "0", "0.00", etc.)
    const hasValue = Boolean(Number(displayValue))

    // Sync displayValue with initialAmount changes (e.g. when charge is fetched)
    // Skip sync if user is actively editing to prevent overwriting their input
    // Deliberately keyed on initialAmount alone: displayValue is what this writes,
    // so depending on it would re-run the sync on every keystroke.
    useEffect(() => {
        if (initialAmount && initialAmount !== displayValue && !isEditingRef.current) {
            setDisplayValue(initialAmount)
            setExactValue(Number(initialAmount) * 10 ** DECIMAL_SCALE)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAmount])

    // Keyed on the fields rather than the objects: primaryDenomination has an
    // object-literal default, so depending on prop identity would rebuild this
    // every render and defeat every memo below that reads a price out of it.
    const denominations = useMemo(() => {
        const map: Record<string, { symbol: string; price: number; decimals: number }> = {
            [primaryDenomination.symbol]: primaryDenomination,
        }
        if (secondaryDenomination) {
            map[secondaryDenomination.symbol] = secondaryDenomination
        }
        return map
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        primaryDenomination.symbol,
        primaryDenomination.price,
        primaryDenomination.decimals,
        secondaryDenomination?.symbol,
        secondaryDenomination?.price,
        secondaryDenomination?.decimals,
    ])

    const alternativeDisplaySymbol = useMemo(() => {
        return Object.keys(denominations).find((key) => key !== displaySymbol) ?? ''
    }, [displaySymbol, denominations])

    // Notifies the parent when the denomination toggles. setCurrentDenomination is an
    // optional prop, so its identity is the parent's to control — including it would
    // re-fire this on every parent render that passes a fresh arrow.
    useEffect(() => {
        if (setCurrentDenomination) {
            setCurrentDenomination(displaySymbol)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, [displaySymbol, alternativeDisplaySymbol, secondaryDenomination, denominations])

    const alternativeValue = useMemo(() => {
        if (!secondaryDenomination || !displayValue) return 0
        return exactValue * exchangeRate
    }, [exactValue, secondaryDenomination, exchangeRate, displayValue])

    const alternativeDisplayValue = useMemo(() => {
        if (!secondaryDenomination || !alternativeValue) return '0.00'
        const scaledDownValue = alternativeValue / 10 ** DECIMAL_SCALE
        return formatTokenAmount(scaledDownValue, denominations[alternativeDisplaySymbol]?.decimals) ?? '0.00'
    }, [alternativeValue, alternativeDisplaySymbol, secondaryDenomination, denominations])

    // primaryDenomination.symbol is included: it decides which consumer gets the
    // display value vs the converted one, so a stale read here reports the amounts
    // the wrong way round. The setPrimary/Secondary/DisplayedAmount props are left
    // out — they are the parent's identity, and including them re-fires this on
    // every parent render.
    useEffect(() => {
        const isPrimaryDenomination = displaySymbol === primaryDenomination.symbol
        // Strip commas before passing to consumers - they expect raw numeric strings
        const rawDisplayValue = displayValue.replace(/,/g, '')
        // Don't output "0.00" when there's no actual value - keep it empty to avoid feedback loops
        const rawAlternativeValue = hasValue ? alternativeDisplayValue.replace(/,/g, '') : ''

        // Always call setDisplayedAmount with the currently displayed value
        setDisplayedAmount?.(rawDisplayValue)

        if (isPrimaryDenomination) {
            setPrimaryAmount(rawDisplayValue)
            setSecondaryAmount?.(rawAlternativeValue)
        } else {
            setPrimaryAmount(rawAlternativeValue)
            setSecondaryAmount?.(rawDisplayValue)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        displayValue,
        alternativeDisplayValue,
        displaySymbol,
        secondaryDenomination,
        hasValue,
        primaryDenomination.symbol,
    ])

    const onSliderValueChange = useCallback(
        (value: number[]) => {
            if (maxAmount) {
                isEditingRef.current = true
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
        [maxAmount, amountCollected, denominations, displaySymbol]
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

    // What tapping the balance row fills in, or undefined when the row stays
    // plain text. Computed from the number the parent validates against, never
    // parsed back out of the label. Floored to the 2 decimals the balance label
    // shows — that label truncates too (formatNumberForDisplay, roundingMode
    // 'trunc'), so the filled amount and the number under the user's thumb
    // always agree, and neither can claim more than the wallet holds. Anything
    // finer than a cent stays behind on purpose (TASK-21899).
    const fillValue = useMemo(() => {
        if (disabled || !balanceFillAmount || balanceFillAmount <= 0) return undefined
        // The amount is denominated in the primary unit, so it must not be
        // filled into a field the user toggled to the secondary one.
        if (displaySymbol !== primaryDenomination.symbol) return undefined
        // A denomination coarser than cents still wins — filling 10.12 into a
        // whole-number field would show an amount it can't hold.
        const decimals = Math.min(2, denominations[displaySymbol]?.decimals ?? 2)
        // forInput slices the fraction instead of rounding it, so this floors.
        const formatted = formatTokenAmount(String(balanceFillAmount), decimals, true)
        // Anything the field can't express — a balance under a cent, or a
        // magnitude String() writes in exponential notation — formats to "0"/"".
        // Leave the row inert rather than offering an amount that can't be used.
        return formatted && Number(formatted) ? formatted : undefined
    }, [disabled, balanceFillAmount, displaySymbol, primaryDenomination.symbol, denominations])

    const fillBalance = useCallback(() => {
        if (!fillValue) return
        isEditingRef.current = true
        setDisplayValue(fillValue)
        setExactValue(Number(fillValue) * 10 ** DECIMAL_SCALE)
        // Reported separately from setPrimaryAmount, which cannot tell a filled
        // amount from a typed one — the withdraw screen needs that distinction
        // to know the user asked for "everything".
        onBalanceFilled?.(fillValue)
    }, [fillValue, onBalanceFilled])

    const inputRef = useRef<HTMLInputElement>(null)
    // set input width based on display value length
    // add extra space for decimal numbers to prevent cutoff
    useEffect(() => {
        if (inputRef.current) {
            const length = displayValue?.length || 0
            // add 0.6ch extra width to prevent cutoff, minimum 4ch
            const width = length ? `${length + 0.6}ch` : '4ch'
            inputRef.current.style.width = width
        }
    }, [displayValue])

    // Autofocus the amount field on mount (desktop only). Done explicitly via the
    // ref instead of React's `autoFocus` prop, which only fires at the exact moment
    // of mount and silently no-ops when the input mounts after a client-side
    // navigation/step transition (the add-money amount screen regressed this way).
    useEffect(() => {
        if (shouldAutoFocus) inputRef.current?.focus()
    }, [shouldAutoFocus])

    return (
        <form
            // usage board 17788:19201 (ruling 20, supersedes the borderless
            // 17360:4451 read): the amount container is a bordered box —
            // 1px border-default, L/16 padding, square corners. The dead
            // dark: variant and disabled-text fixes from the earlier pass stay.
            className={`relative cursor-text border border-border-default bg-background-default p-4 ${className}`}
            action=""
            onClick={() => inputRef.current?.focus()}
        >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                <div className="flex items-center gap-1 font-bold">
                    <label
                        className={`text-heading-xs ${displayValue ? 'text-foreground-primary' : 'text-foreground-secondary'}`}
                    >
                        {displaySymbol}
                    </label>

                    {/* Input with fake caret */}
                    <div className="relative">
                        <input
                            // h-16, not h-12: text-heading-big-input is 52px on a 64px line box, so a
                            // 48px input clipped the digits at the baseline
                            className={`h-16 max-w-80 bg-transparent text-heading-big-input text-foreground-primary caret-action-primary transition-colors outline-none placeholder:text-foreground-secondary disabled:text-foreground-secondary disabled:opacity-100 disabled:[-webkit-text-fill-color:var(--color-foreground-secondary)]`}
                            placeholder={'0.00'}
                            onChange={(e) => {
                                isEditingRef.current = true
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
                            type="text"
                            value={displayValue}
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
                            <div className="pointer-events-none absolute top-1/2 left-0 h-16 w-[1px] -translate-y-1/2 animate-blink bg-action-primary" />
                        )}
                    </div>
                </div>

                {/* Conversion */}
                {showConversion && (
                    <label
                        className={`text-heading-card ${!Number(alternativeValue) ? 'text-foreground-secondary' : ''}`}
                    >
                        ≈ {alternativeDisplaySymbol} {alternativeDisplayValue}{' '}
                    </label>
                )}

                {/* Balance */}
                {walletBalance &&
                    !hideBalance &&
                    (() => {
                        // A symbol sits against the number ($10.12), an ISO code
                        // takes a space (USD 10.12) — the CLDR rule for en-US,
                        // which is how the amount itself is formatted.
                        const balanceAmount = `${secondaryDenomination ? 'USD ' : '$'}${walletBalance}`
                        if (!fillValue) {
                            return (
                                <div className="text-center text-foreground-secondary">
                                    {`${t('amountInput.balance')} ${balanceAmount}`}
                                </div>
                            )
                        }
                        // Only the amount is the action — "Balance:" stays a label,
                        // so the underline marks exactly what the tap fills in.
                        return (
                            <div className="flex items-center justify-center gap-1 text-foreground-secondary">
                                <span>{t('amountInput.balance')}</span>
                                <button
                                    type="button"
                                    // The form wrapper focuses the amount field on any
                                    // click inside it. Let this one bubble and the mobile
                                    // keyboard opens over the CTA the user is heading for.
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        fillBalance()
                                    }}
                                    aria-label={t('amountInput.useFullBalance', { balance: balanceAmount })}
                                    className="min-h-11 min-w-11 px-1 underline underline-offset-4 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                                >
                                    {balanceAmount}
                                </button>
                            </div>
                        )
                    })()}
            </div>
            {/* Conversion toggle */}
            {showConversion && (
                <div
                    className="absolute top-1/2 right-0 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault()
                        // keep editing state true - user is interacting, prevent sync from initialAmount
                        // that could cause feedback loops with async URL state updates
                        isEditingRef.current = true
                        // If no meaningful value entered, just switch symbol and keep empty
                        if (!hasValue) {
                            setDisplayValue('')
                            setExactValue(0)
                            setDisplaySymbol(alternativeDisplaySymbol)
                            return
                        }
                        setExactValue(alternativeValue)
                        setDisplayValue(alternativeDisplayValue.replace(/,/g, ''))
                        setDisplaySymbol(alternativeDisplaySymbol)
                    }}
                >
                    <IconComponent
                        name={'arrow-exchange'}
                        className="ml-5 rotate-90 cursor-pointer"
                        width={32}
                        height={32}
                    />
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
