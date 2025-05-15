import { PEANUT_WALLET_TOKEN } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { estimateIfIsStableCoinFromPrice } from '@/utils/general.utils'
import { formatCurrencyWithIntl } from '@/utils/format.utils'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'

interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
    onSubmit?: () => void
    maxValue?: string
    disabled?: boolean
    walletBalance?: string
    currency?: {
        code: string
        symbol: string
        price: number
    }
}

const TokenAmountInput = ({
    className,
    tokenValue,
    setTokenValue,
    setCurrencyAmount,
    onSubmit,
    maxValue,
    disabled,
    walletBalance,
    currency,
}: TokenAmountInputProps) => {
    const { inputDenomination, setInputDenomination, selectedTokenData, selectedTokenAddress } =
        useContext(tokenSelectorContext)
    const inputRef = useRef<HTMLInputElement>(null)
    const { isConnected: isPeanutWallet } = useWallet()

    const [inputValue, setInputValue] = useState<string>('')
    const [currencyMode, setCurrencyMode] = useState<'USD' | 'CUSTOM'>(currency ? 'CUSTOM' : 'USD')
    const [isFocused, setIsFocused] = useState(false)
    const [prevTokenValue, setPrevTokenValue] = useState(tokenValue)
    const [prevInputDenomination, setPrevInputDenomination] = useState(inputDenomination)
    const [prevCurrencyMode, setPrevCurrencyMode] = useState(currencyMode)

    // Helper to clean unnecessary trailing .00 or .0 from strings like "12.00" -> "12", "12.50" -> "12.5"
    const cleanDisplayString = (valStr: string): string => {
        if (!valStr.includes('.')) return valStr
        let cleaned = valStr.replace(/0+$/, '') // "12.50" -> "12.5", "12.00" -> "12."
        if (cleaned.endsWith('.')) {
            cleaned = cleaned.slice(0, -1) // "12." -> "12"
        }
        return cleaned
    }

    useEffect(() => {
        const modeChanged = inputDenomination !== prevInputDenomination || currencyMode !== prevCurrencyMode
        // Consider a change external if tokenValue changed AND the input is not focused, OR if modes changed.
        const externalOrModeChange = modeChanged || (tokenValue !== prevTokenValue && !isFocused)

        // This effect should primarily react to external changes or mode changes to update inputValue.
        // If focused, onChange is the main driver for inputValue.
        if (externalOrModeChange || (!isFocused && tokenValue !== prevTokenValue)) {
            let newInputValueTarget = ''
            if (tokenValue && tokenValue !== '0') {
                const numericTokenValue = parseFloat(tokenValue)
                if (!isNaN(numericTokenValue)) {
                    if (currency) {
                        if (currencyMode === 'CUSTOM') {
                            if (currency.price > 0) {
                                newInputValueTarget = cleanDisplayString(
                                    (numericTokenValue * currency.price).toFixed(2)
                                )
                            }
                        } else {
                            newInputValueTarget = cleanDisplayString(numericTokenValue.toFixed(2))
                        }
                    } else {
                        if (inputDenomination === 'USD') {
                            if (selectedTokenData?.price && selectedTokenData.price > 0) {
                                newInputValueTarget = cleanDisplayString(
                                    (numericTokenValue * selectedTokenData.price).toFixed(2)
                                )
                            } else {
                                newInputValueTarget = tokenValue
                            }
                        } else {
                            const displayDecimals = selectedTokenData?.decimals ?? 6
                            newInputValueTarget = cleanDisplayString(numericTokenValue.toFixed(displayDecimals))
                        }
                    }
                }
            } else if (tokenValue === '0') {
                newInputValueTarget = '0'
            } else {
                // tokenValue is undefined, null, or empty string (but not '0')
                newInputValueTarget = ''
            }

            // Only update if the target is different from current inputValue
            // This prevents disrupting user input if they are focused and typing something that leads to the same canonical tokenValue
            // The main protection for focused input is that this useEffect path is usually only taken for external changes or mode changes.
            if (inputValue !== newInputValueTarget) {
                setInputValue(newInputValueTarget)
            }
        }

        // Update previous state trackers after comparison
        if (tokenValue !== prevTokenValue) setPrevTokenValue(tokenValue)
        if (inputDenomination !== prevInputDenomination) setPrevInputDenomination(inputDenomination)
        if (currencyMode !== prevCurrencyMode) setPrevCurrencyMode(currencyMode)
    }, [
        tokenValue,
        currencyMode,
        currency,
        inputDenomination,
        selectedTokenData,
        isFocused,
        inputValue,
        prevTokenValue,
        prevInputDenomination,
        prevCurrencyMode,
    ])

    // Restore useEffect for dynamic width adjustment
    useEffect(() => {
        if (inputRef.current) {
            const placeholderText = '0.00'
            const textInInput = inputValue || placeholderText

            let numChars = textInInput.length

            if (numChars === 0) {
                numChars = 1
            } else if (inputValue === '' && placeholderText) {
                numChars = placeholderText.length
            }

            const bufferForCursor = 1.5
            inputRef.current.style.width = `${numChars + bufferForCursor}ch`
        }
    }, [inputValue])

    const onChange = (rawUserTypedValue: string) => {
        let sanitizedValue = rawUserTypedValue.replace(/[^0-9.]/g, '')
        const parts = sanitizedValue.split('.')
        if (parts.length > 1) {
            sanitizedValue = parts[0] + '.' + (parts[1] || '')
            if (parts.length > 2) {
                sanitizedValue = parts[0] + '.' + parts.slice(1).join('')
            }
        }

        const maxAllowedDecimals = currency || inputDenomination === 'USD' ? 2 : (selectedTokenData?.decimals ?? 6)

        if (maxAllowedDecimals === 0 && sanitizedValue.includes('.')) {
            sanitizedValue = sanitizedValue.split('.')[0]
        } else if (parts.length === 2 && parts[1].length > maxAllowedDecimals) {
            sanitizedValue = `${parts[0]}.${parts[1].substring(0, maxAllowedDecimals)}`
        }

        setInputValue(sanitizedValue)

        let newCanonicalTokenValue
        let newAlternativeCurrencyAmount

        const numericSanitizedValue = parseFloat(sanitizedValue)

        if (currency) {
            if (isNaN(numericSanitizedValue) && sanitizedValue !== '' && sanitizedValue !== '.') {
                newCanonicalTokenValue = undefined
                newAlternativeCurrencyAmount = undefined
            } else if (sanitizedValue === '' || sanitizedValue === '.') {
                newCanonicalTokenValue = undefined
                newAlternativeCurrencyAmount = undefined
            } else if (currencyMode === 'CUSTOM') {
                newAlternativeCurrencyAmount = numericSanitizedValue.toString()
                if (currency.price > 0) {
                    newCanonicalTokenValue = (numericSanitizedValue / currency.price).toFixed(6)
                } else {
                    newCanonicalTokenValue = undefined
                }
            } else {
                newCanonicalTokenValue = numericSanitizedValue.toFixed(2)
                if (currency.price > 0) {
                    newAlternativeCurrencyAmount = (numericSanitizedValue * currency.price).toFixed(2)
                }
            }
        } else {
            if (isNaN(numericSanitizedValue) && sanitizedValue !== '' && sanitizedValue !== '.') {
                newCanonicalTokenValue = undefined
                newAlternativeCurrencyAmount = undefined
            } else if (sanitizedValue === '' || sanitizedValue === '.') {
                newCanonicalTokenValue = undefined
                newAlternativeCurrencyAmount = undefined
            } else if (inputDenomination === 'USD') {
                newAlternativeCurrencyAmount = numericSanitizedValue.toFixed(2)
                if (selectedTokenData?.price && selectedTokenData.price > 0) {
                    newCanonicalTokenValue = (numericSanitizedValue / selectedTokenData.price).toFixed(
                        selectedTokenData.decimals || 6
                    )
                } else {
                    newCanonicalTokenValue = undefined
                }
            } else {
                const tokenDecimals = selectedTokenData?.decimals ?? 0
                const valueParts = sanitizedValue.split('.')
                if (valueParts.length === 2 && valueParts[1].length > tokenDecimals) {
                    newCanonicalTokenValue = parseFloat(
                        valueParts[0] + '.' + valueParts[1].substring(0, tokenDecimals)
                    ).toString()
                } else {
                    newCanonicalTokenValue = numericSanitizedValue.toString()
                }

                if (selectedTokenData?.price && selectedTokenData.price > 0) {
                    newAlternativeCurrencyAmount = (numericSanitizedValue * selectedTokenData.price).toFixed(2)
                }
            }
        }
        setTokenValue(newCanonicalTokenValue)
        if (setCurrencyAmount) setCurrencyAmount(newAlternativeCurrencyAmount)
    }

    const handleMaxClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (maxValue) {
            setTokenValue(maxValue)
        }
    }

    const handleFocus = () => setIsFocused(true)
    const handleBlur = () => {
        setIsFocused(false)
        if (inputValue.endsWith('.')) {
            const cleaned = inputValue.slice(0, -1) || ''
            setInputValue(cleaned)
            onChange(cleaned)
        }
    }

    const handleToggleCurrencyMode = () => {
        if (currency) {
            setCurrencyMode((prevMode) => (prevMode === 'USD' ? 'CUSTOM' : 'USD'))
        } else if (selectedTokenData?.price) {
            const newDenomination = inputDenomination === 'USD' ? 'TOKEN' : 'USD'
            setInputDenomination(newDenomination)
        }
    }

    let inputPrefix = ''
    if (currency) {
        inputPrefix = currencyMode === 'CUSTOM' ? currency.symbol : '$'
    } else {
        if (inputDenomination === 'TOKEN') {
            inputPrefix = selectedTokenData?.symbol || ''
        } else {
            inputPrefix = '$'
        }
    }

    let secondaryDisplayString = ''
    const numericTokenValueForSecondary = parseFloat(tokenValue || '0')

    if (!isNaN(numericTokenValueForSecondary)) {
        if (currency) {
            if (currencyMode === 'CUSTOM') {
                secondaryDisplayString = formatCurrencyWithIntl(
                    numericTokenValueForSecondary,
                    undefined,
                    'USD',
                    'currency',
                    2,
                    2
                )
            } else {
                if (currency.price > 0) {
                    const arsValue = numericTokenValueForSecondary * currency.price
                    secondaryDisplayString = formatCurrencyWithIntl(
                        arsValue,
                        undefined,
                        currency.code,
                        'currency',
                        2,
                        2
                    )
                }
            }
        } else {
            if (inputDenomination === 'USD') {
                secondaryDisplayString = `${formatCurrencyWithIntl(numericTokenValueForSecondary, undefined, selectedTokenData?.symbol, 'decimal', 0, selectedTokenData?.decimals ?? 6)} ${selectedTokenData?.symbol || ''}`
            } else {
                if (selectedTokenData?.price && selectedTokenData.price > 0) {
                    const usdValue = numericTokenValueForSecondary * selectedTokenData.price
                    secondaryDisplayString = formatCurrencyWithIntl(usdValue, undefined, 'USD', 'currency', 2, 2)
                }
            }
        }
    }

    const handleContainerClick = () => inputRef.current?.focus()

    return (
        <form
            className={`relative cursor-text rounded-none border border-n-1 bg-white px-2 py-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1">
                {inputPrefix && (
                    <label className={`text-h1 ${inputValue ? 'text-black' : 'text-gray-2'}`}>{inputPrefix}</label>
                )}
                <input
                    className={`h-12 max-w-80 overflow-x-auto bg-transparent text-center text-h1 outline-none transition-colors placeholder:text-h1 focus:border-primary-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1`}
                    placeholder={'0.00'}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    autoComplete="off"
                    disabled={disabled}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && onSubmit) {
                            e.preventDefault()
                            onSubmit()
                        }
                        if (
                            ['e', '+', '-'].includes(e.key.toLowerCase()) &&
                            e.key !== 'Backspace' &&
                            e.key !== 'Delete' &&
                            !e.ctrlKey &&
                            !e.metaKey
                        ) {
                            e.preventDefault()
                        }
                    }}
                />
                {maxValue && maxValue !== tokenValue && (
                    <button
                        onClick={handleMaxClick}
                        className="absolute right-1 ml-1 px-2 py-1 text-h7 uppercase text-grey-1 transition-colors hover:text-black"
                    >
                        Max
                    </button>
                )}
            </div>
            {walletBalance && (
                <div className="mt-0.5 text-center text-xs text-grey-1">
                    Your balance:{' '}
                    {(() => {
                        const numericWalletBalance = parseFloat(walletBalance)
                        if (isNaN(numericWalletBalance)) return walletBalance

                        if (isPeanutWallet) {
                            return formatCurrencyWithIntl(numericWalletBalance, undefined, 'USD', 'currency', 2, 2)
                        }
                        if (currency) {
                            if (currencyMode === 'CUSTOM') {
                                return formatCurrencyWithIntl(
                                    numericWalletBalance * currency.price,
                                    undefined,
                                    currency.code,
                                    'currency',
                                    2,
                                    2
                                )
                            } else {
                                return formatCurrencyWithIntl(numericWalletBalance, undefined, 'USD', 'currency', 2, 2)
                            }
                        } else {
                            if (inputDenomination === 'USD') {
                                if (selectedTokenData?.price && selectedTokenData.price > 0) {
                                    return formatCurrencyWithIntl(
                                        numericWalletBalance * selectedTokenData.price,
                                        undefined,
                                        'USD',
                                        'currency',
                                        2,
                                        2
                                    )
                                } else {
                                    return `${formatCurrencyWithIntl(numericWalletBalance, undefined, selectedTokenData?.symbol, 'decimal', 0, selectedTokenData?.decimals ?? 6)} ${selectedTokenData?.symbol || ''}`
                                }
                            } else {
                                return `${formatCurrencyWithIntl(numericWalletBalance, undefined, selectedTokenData?.symbol, 'decimal', 0, selectedTokenData?.decimals ?? 6)} ${selectedTokenData?.symbol || ''}`
                            }
                        }
                    })()}
                </div>
            )}
            {((!currency && selectedTokenData?.price && !estimateIfIsStableCoinFromPrice(selectedTokenData.price)) ||
                currency) && (
                <div
                    className="flex w-full cursor-pointer flex-row items-center justify-center gap-1"
                    onClick={(e) => {
                        e.preventDefault()
                        handleToggleCurrencyMode()
                    }}
                >
                    <label className="text-base text-grey-1">
                        {secondaryDisplayString || `${currency?.symbol || selectedTokenData?.symbol || ''}0`}
                    </label>
                    {!disabled && (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleToggleCurrencyMode()
                            }}
                        >
                            <Icon name={'switch'} className="rotate-90 cursor-pointer fill-grey-1" />
                        </button>
                    )}
                </div>
            )}
        </form>
    )
}

export default TokenAmountInput
