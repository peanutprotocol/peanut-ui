import { STABLE_COINS, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { formatTokenAmount } from '@/utils'
import { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Icon from '../Icon'

interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
    setUsdValue?: (usdvalue: string) => void
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
    onSubmit?: () => void
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
    disabled,
    walletBalance,
    currency,
    setUsdValue,
}: TokenAmountInputProps) => {
    const { selectedTokenData } = useContext(tokenSelectorContext)
    const inputRef = useRef<HTMLInputElement>(null)
    const inputType = useMemo(() => (window.innerWidth < 640 ? 'text' : 'number'), [])

    // Store display value for input field (what user sees when typing)
    const [displayValue, setDisplayValue] = useState<string>(tokenValue || '')
    const [isInputUsd, setIsInputUsd] = useState<boolean>(!currency)
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
                case 'STABLE':
                    tokenValue = value
                    break
                case 'TOKEN':
                    if (!selectedTokenData?.price) throw new Error('Invalid selected token data')
                    tokenValue = _isInputUsd ? (Number(value) / selectedTokenData.price).toString() : value
                    break
                case 'FIAT':
                    if (!currency?.price) throw new Error('Invalid currency')
                    tokenValue = _isInputUsd ? value : (Number(value) / currency.price).toString()
                    const currencyValue = _isInputUsd ? (Number(value) * currency.price).toString() : value
                    setCurrencyAmount?.(currencyValue)
                    break
                default:
                    throw new Error('Invalid display mode')
            }
            setTokenValue(tokenValue)
        },
        [displayMode, currency?.price, selectedTokenData?.price, calculateAlternativeValue]
    )

    useEffect(() => {
        switch (displayMode) {
            case 'STABLE':
                setDisplaySymbol('$')
                setAlternativeDisplaySymbol('')
                break
            case 'TOKEN':
                if (isInputUsd) {
                    setDisplaySymbol('$')
                    setAlternativeDisplaySymbol(selectedTokenData?.symbol || '')
                } else {
                    setDisplaySymbol(selectedTokenData?.symbol || '')
                    setAlternativeDisplaySymbol('$')
                }
                break
            case 'FIAT':
                if (isInputUsd) {
                    setDisplaySymbol('$')
                    setAlternativeDisplaySymbol(currency?.symbol || '')
                } else {
                    setDisplaySymbol(currency?.symbol || '')
                    setAlternativeDisplaySymbol('$')
                }
                break
            default:
                throw new Error('Invalid display mode')
        }
    }, [displayMode, selectedTokenData?.symbol, currency?.symbol, isInputUsd])

    useEffect(() => {
        if (inputRef.current) {
            if (displayValue?.length !== 0) {
                inputRef.current.style.width = `${(displayValue?.length ?? 0) + 1}ch`
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

    return (
        <form
            ref={formRef}
            className={`relative cursor-text rounded-none border border-n-1 bg-white px-2 py-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1">
                <label className={`text-h1 ${displayValue ? 'text-black' : 'text-gray-2'}`}>{displaySymbol}</label>
                <input
                    className={`h-12 w-[4ch] max-w-80 bg-transparent text-center text-h1 outline-none transition-colors placeholder:text-h1 focus:border-primary-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1`}
                    placeholder={'0.00'}
                    onChange={(e) => {
                        //const value = formatAmountWithoutComma(e.target.value)
                        onChange(e.target.value, isInputUsd)
                    }}
                    ref={inputRef}
                    inputMode="decimal"
                    type={inputType}
                    value={displayValue}
                    step="any"
                    min="0"
                    autoComplete="off"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            if (onSubmit) onSubmit()
                        }
                        if (['e', '+', '-'].includes(e.key.toLowerCase())) {
                            e.preventDefault()
                        }
                    }}
                    style={{ maxWidth: `${parentWidth}px` }}
                    disabled={disabled}
                />
            </div>
            {walletBalance && (
                <div className="mt-0.5 text-center text-xs text-grey-1">
                    Your balance: {displayMode === 'FIAT' && currency ? 'US$' : '$'}
                    {walletBalance}
                </div>
            )}
            {/* Show conversion line and toggle */}
            {(displayMode === 'TOKEN' || displayMode === 'FIAT') && (
                <div
                    className={`flex w-full cursor-pointer flex-row items-center justify-center gap-1`}
                    onClick={(e) => {
                        e.preventDefault()
                        const currentValue = displayValue
                        setDisplayValue(alternativeDisplayValue)
                        setAlternativeDisplayValue(currentValue)
                        setIsInputUsd(!isInputUsd)
                    }}
                >
                    <label className="text-base text-grey-1">
                        {alternativeDisplaySymbol} {alternativeDisplayValue}
                    </label>
                    <Icon name={'switch'} className="rotate-90 cursor-pointer fill-grey-1" />
                </div>
            )}
        </form>
    )
}

export default TokenAmountInput
