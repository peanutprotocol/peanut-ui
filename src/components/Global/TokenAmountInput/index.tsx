import { PEANUT_WALLET_TOKEN } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { estimateIfIsStableCoinFromPrice, formatTokenAmount, formatNumberForDisplay, formatAmount } from '@/utils'
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
    const inputType = 'text'
    const { isConnected: isPeanutWallet } = useWallet()

    const [currencyMode, setCurrencyMode] = useState<'USD' | 'CUSTOM'>(currency ? 'CUSTOM' : 'USD')
    const [displayValue, setDisplayValue] = useState<string>('')

    const primaryDisplayMaxDecimals = currency ? 2 : (selectedTokenData?.decimals ?? 6)

    useEffect(() => {
        let newDisplayValueBasedOnTokenValue = ''
        if (currency && currencyMode === 'CUSTOM') {
            if (tokenValue && currency.price > 0) {
                const customCurrencyValue = Number(tokenValue) * currency.price
                newDisplayValueBasedOnTokenValue = formatNumberForDisplay(customCurrencyValue.toString(), {
                    maxDecimals: 2,
                })
            } else {
                newDisplayValueBasedOnTokenValue = ''
            }
        } else {
            newDisplayValueBasedOnTokenValue = tokenValue
                ? formatNumberForDisplay(tokenValue, { maxDecimals: primaryDisplayMaxDecimals })
                : ''
        }

        if (displayValue.endsWith('.') && newDisplayValueBasedOnTokenValue === displayValue.slice(0, -1)) {
            // Do nothing; preserve user's partial decimal input
        } else if (newDisplayValueBasedOnTokenValue !== displayValue) {
            setDisplayValue(newDisplayValueBasedOnTokenValue)
        }
    }, [tokenValue, currencyMode, currency, displayValue, primaryDisplayMaxDecimals])

    const onChange = (rawInputValue: string) => {
        const numberStrWithoutCommas = rawInputValue.replace(/,/g, '')

        if (numberStrWithoutCommas === '') {
            setDisplayValue('')
            setTokenValue('')
            if (setCurrencyAmount) setCurrencyAmount('')
            return
        }

        if (/^\d*\.?\d*$/.test(numberStrWithoutCommas)) {
            let formattedForDisplay
            const currentMaxDecimals = currency ? 2 : (selectedTokenData?.decimals ?? 6)

            if (numberStrWithoutCommas.endsWith('.') && (numberStrWithoutCommas.match(/\./g) || []).length === 1) {
                const partBeforeDecimal = numberStrWithoutCommas.slice(0, -1)
                formattedForDisplay =
                    formatNumberForDisplay(partBeforeDecimal, { maxDecimals: currentMaxDecimals }) + '.'
            } else {
                formattedForDisplay = formatNumberForDisplay(numberStrWithoutCommas, {
                    maxDecimals: currentMaxDecimals,
                })
            }

            if (formattedForDisplay === '' && numberStrWithoutCommas === '.') {
                setDisplayValue('.')
            } else {
                setDisplayValue(formattedForDisplay)
            }

            if (currency && currencyMode === 'CUSTOM') {
                if (setCurrencyAmount) setCurrencyAmount(formattedForDisplay)
                const customCurrencyNumber = Number(numberStrWithoutCommas)
                if (!isNaN(customCurrencyNumber) && currency.price > 0) {
                    const usdEquivalent = customCurrencyNumber / currency.price
                    setTokenValue(parseFloat(usdEquivalent.toFixed(6)).toString())
                } else {
                    setTokenValue('')
                }
            } else {
                setTokenValue(numberStrWithoutCommas)
                if (currency && currency.price > 0) {
                    const customEquivalent = Number(numberStrWithoutCommas) * currency.price
                    if (setCurrencyAmount)
                        setCurrencyAmount(formatNumberForDisplay(customEquivalent.toString(), { maxDecimals: 2 }))
                } else if (!currency && setCurrencyAmount && selectedTokenData?.price && selectedTokenData.price > 0) {
                    const usdEquivalent = Number(numberStrWithoutCommas) * selectedTokenData.price
                    setCurrencyAmount(formatNumberForDisplay(usdEquivalent.toString(), { maxDecimals: 2 }))
                } else if (setCurrencyAmount) {
                    setCurrencyAmount('')
                }
            }
        }
    }

    const handleMaxClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (maxValue) {
            setTokenValue(maxValue)
            if (currency && currency.price > 0) {
                const customEquivalent = Number(maxValue) * currency.price
                if (setCurrencyAmount)
                    setCurrencyAmount(formatNumberForDisplay(customEquivalent.toString(), { maxDecimals: 2 }))
            } else if (!currency && setCurrencyAmount && selectedTokenData?.price && selectedTokenData.price > 0) {
                const usdEquivalent = Number(maxValue) * selectedTokenData.price
                setCurrencyAmount(formatNumberForDisplay(usdEquivalent.toString(), { maxDecimals: 2 }))
            }
        }
    }

    useEffect(() => {
        if (inputRef.current) {
            const valueToShow = displayValue
            if (valueToShow?.length !== 0) {
                inputRef.current.style.width = `${(valueToShow?.length ?? 0) + 1}ch`
            } else {
                inputRef.current.style.width = `4ch`
            }
        }
    }, [displayValue])

    const parentWidth = useMemo(() => {
        if (inputRef.current && inputRef.current.parentElement) {
            return inputRef.current.parentElement.offsetWidth
        }
        return 'auto'
    }, [])

    const formRef = useRef<HTMLFormElement>(null)

    const handleContainerClick = () => {
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }

    const handleToggleCurrencyMode = () => {
        if (currency) {
            const newMode = currencyMode === 'USD' ? 'CUSTOM' : 'USD'
            setCurrencyMode(newMode)
        } else if (selectedTokenData?.price) {
            setInputDenomination(inputDenomination === 'USD' ? 'TOKEN' : 'USD')
        }
    }

    return (
        <form
            ref={formRef}
            className={`relative cursor-text rounded-none border border-n-1 bg-white px-2 py-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1">
                {(selectedTokenData?.price || (isPeanutWallet && selectedTokenAddress === PEANUT_WALLET_TOKEN)) &&
                    (inputDenomination === 'USD' ||
                    (selectedTokenData?.price ? estimateIfIsStableCoinFromPrice(selectedTokenData.price) : false) ? (
                        <label className={`text-h1 ${displayValue ? 'text-black' : 'text-gray-2'}`}>
                            {currency && currencyMode === 'CUSTOM' ? currency.symbol : '$'}
                        </label>
                    ) : currency ? (
                        <label className="sr-only text-h1">$</label>
                    ) : null)}
                <input
                    className={`h-12 w-[4ch] max-w-80 bg-transparent text-center text-h1 outline-none transition-colors placeholder:text-h1 focus:border-primary-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1`}
                    placeholder={'0.00'}
                    onChange={(e) => {
                        onChange(e.target.value)
                    }}
                    ref={inputRef}
                    type={inputType}
                    inputMode="decimal"
                    pattern="[0-9,.]*"
                    value={displayValue}
                    step="any"
                    min="0"
                    autoComplete="off"
                    onKeyDown={(e) => {
                        const { key, metaKey, ctrlKey } = e
                        if (
                            !(key >= '0' && key <= '9') &&
                            !(key === '.' && !e.currentTarget.value.includes('.')) &&
                            !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(
                                key
                            ) &&
                            !(metaKey || ctrlKey)
                        ) {
                            e.preventDefault()
                        }
                    }}
                    style={{ maxWidth: `${parentWidth}px` }}
                    disabled={disabled}
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
                    {currency && currencyMode === 'CUSTOM' && currency.price > 0
                        ? `${currency.symbol}${formatNumberForDisplay((Number(walletBalance) * currency.price).toString(), { maxDecimals: 2 })}`
                        : `$${formatNumberForDisplay(walletBalance, { maxDecimals: 2 })}`}
                </div>
            )}
            {((selectedTokenData?.price && !estimateIfIsStableCoinFromPrice(selectedTokenData.price)) || currency) && (
                <div
                    className="flex w-full cursor-pointer flex-row items-center justify-center gap-1"
                    onClick={(e) => {
                        e.preventDefault()
                        handleToggleCurrencyMode()
                    }}
                >
                    <label className="text-base text-grey-1">
                        {(() => {
                            if (!tokenValue)
                                return currencyMode === 'CUSTOM' && currency
                                    ? `$0`
                                    : `${currency?.symbol || selectedTokenData?.symbol || ''}0`

                            if (currency) {
                                const price = currency.price
                                if (!(price > 0)) {
                                    return currencyMode === 'CUSTOM' ? `$0` : `${currency.symbol}0`
                                }

                                if (currencyMode === 'CUSTOM') {
                                    return `$${formatNumberForDisplay(tokenValue, { maxDecimals: 2 })}`
                                } else {
                                    const customEquivalent = Number(tokenValue) * price
                                    return `${currency.symbol}${formatNumberForDisplay(customEquivalent.toString(), { maxDecimals: 2 })}`
                                }
                            } else {
                                if (!selectedTokenData?.price || selectedTokenData.price <= 0) {
                                    return inputDenomination === 'USD' ? `${selectedTokenData?.symbol || ''}0` : '$0'
                                }
                                if (inputDenomination === 'USD') {
                                    const tokenAmountVal = Number(tokenValue) / selectedTokenData.price
                                    return `${formatTokenAmount(tokenAmountVal, selectedTokenData.decimals)} ${selectedTokenData.symbol || ''}`
                                } else {
                                    const usdEquivalentVal = Number(tokenValue) * selectedTokenData.price
                                    return `$${formatNumberForDisplay(usdEquivalentVal.toString(), { maxDecimals: 2 })}`
                                }
                            }
                        })()}
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
