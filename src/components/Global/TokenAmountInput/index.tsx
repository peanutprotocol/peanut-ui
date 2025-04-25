import { PEANUT_WALLET_TOKEN } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { estimateIfIsStableCoinFromPrice, formatAmountWithoutComma, formatTokenAmount } from '@/utils'
import { useContext, useEffect, useMemo, useRef } from 'react'
import Icon from '../Icon'

interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
    onSubmit?: () => void
    maxValue?: string
    disabled?: boolean
    walletBalance?: string
}

const TokenAmountInput = ({
    className,
    tokenValue,
    setTokenValue,
    onSubmit,
    maxValue,
    disabled,
    walletBalance,
}: TokenAmountInputProps) => {
    const { inputDenomination, setInputDenomination, selectedTokenData, selectedTokenAddress } =
        useContext(tokenSelectorContext)
    const inputRef = useRef<HTMLInputElement>(null)
    const inputType = useMemo(() => (window.innerWidth < 640 ? 'text' : 'number'), [])
    const { isPeanutWallet } = useWallet()

    const onChange = (tokenvalue: string) => {
        setTokenValue(tokenvalue)
    }

    const handleMaxClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation() // Prevent container click handler from firing
        if (maxValue) {
            setInputDenomination('TOKEN')
            setTokenValue(maxValue)
        }
    }

    useEffect(() => {
        if (inputRef.current) {
            if (tokenValue?.length !== 0) {
                inputRef.current.style.width = `${(tokenValue?.length ?? 0) + 1}ch`
            } else {
                inputRef.current.style.width = `4ch`
            }
        }
    }, [tokenValue])

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
            className={`relative cursor-text rounded-none border border-n-1 px-2 py-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1">
                {/* Show dollar sign if either:
                    1. We have price data from API and it's either in USD mode or is a stablecoin
                         // TODO: if multiple denominations (USD, EURO, etc), show the correct one
                    2. It's a Peanut Wallet USDC transaction (which we know is always $1)
                    This prevents flickering/not loading of the dollar sign while waiting for price data */}
                {(selectedTokenData?.price || (isPeanutWallet && selectedTokenAddress === PEANUT_WALLET_TOKEN)) &&
                    (inputDenomination === 'USD' ||
                    (selectedTokenData?.price ? estimateIfIsStableCoinFromPrice(selectedTokenData.price) : false) ? (
                        <label className={`text-h1 ${tokenValue ? 'text-black' : 'text-gray-2'}`}>$</label>
                    ) : (
                        <label className="sr-only text-h1">$</label>
                    ))}
                <input
                    className={`h-12 w-[4ch] max-w-80 bg-transparent text-center text-h1 outline-none transition-colors placeholder:text-h1 focus:border-primary-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1`}
                    placeholder={'0.00'}
                    onChange={(e) => {
                        const value = formatAmountWithoutComma(e.target.value)
                        onChange(value)
                    }}
                    ref={inputRef}
                    inputMode="decimal"
                    type={inputType}
                    value={tokenValue}
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
                <div className="mt-0.5 text-center text-xs text-grey-1">Your balance: ${walletBalance}</div>
            )}
            {selectedTokenData?.price && !estimateIfIsStableCoinFromPrice(selectedTokenData.price) && (
                <div className="flex w-full flex-row items-center justify-center gap-1">
                    <label className="text-base text-grey-1">
                        {!tokenValue
                            ? '0'
                            : inputDenomination === 'USD'
                              ? formatTokenAmount(Number(tokenValue) / (selectedTokenData?.price ?? 0))
                              : '$' + formatTokenAmount(Number(tokenValue) * (selectedTokenData?.price ?? 0))}
                    </label>
                    {!disabled && (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                if (selectedTokenData?.price)
                                    setInputDenomination(inputDenomination === 'USD' ? 'TOKEN' : 'USD')
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
