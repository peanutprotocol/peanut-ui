import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import * as context from '@/context'
import * as utils from '@/utils'

interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
    onSubmit?: () => void
}

const TokenAmountInput = ({ className, tokenValue, setTokenValue, onSubmit }: TokenAmountInputProps) => {
    const { inputDenomination, setInputDenomination, selectedTokenPrice } = useContext(context.tokenSelectorContext)
    const inputRef = useRef<HTMLInputElement>(null)
    const inputType = useMemo(() => (window.innerWidth < 640 ? 'text' : 'number'), [])

    const onChange = (tokenvalue: string) => {
        setTokenValue(tokenvalue)
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

    utils.estimateStableCoin(1)

    const formRef = useRef<HTMLFormElement>(null)

    const handleContainerClick = () => {
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }

    return (
        <form
            ref={formRef}
            className={`relative max-w-96 cursor-text rounded-none border border-n-1 px-2 py-4 dark:border-white ${className}`}
            action=""
            onClick={handleContainerClick}
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1">
                {}
                {selectedTokenPrice &&
                    !utils.estimateStableCoin(selectedTokenPrice) &&
                    (inputDenomination === 'USD' ? (
                        <label className={` text-h1 ${tokenValue ? 'text-black' : 'text-gray-2'}`}>$</label>
                    ) : (
                        <label className={`sr-only text-h1 `}>$</label>
                    ))}
                <input
                    className={`h-12 w-[4ch] max-w-80 bg-transparent text-center text-h1 outline-none transition-colors placeholder:text-h1 focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white  dark:placeholder:text-white/75 dark:focus:border-purple-1`}
                    placeholder={'0.00'}
                    onChange={(e) => {
                        const value = utils.formatAmountWithoutComma(e.target.value)
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
                    }}
                    style={{ maxWidth: `${parentWidth}px` }}
                />
            </div>
            {selectedTokenPrice && !utils.estimateStableCoin(selectedTokenPrice) && (
                <div className="flex w-full flex-row items-center justify-center gap-1">
                    <label className="text-base text-gray-1">
                        {!tokenValue
                            ? '0'
                            : inputDenomination === 'USD'
                              ? utils.formatTokenAmount(Number(tokenValue) / (selectedTokenPrice ?? 0))
                              : '$' + utils.formatTokenAmount(Number(tokenValue) * (selectedTokenPrice ?? 0))}
                    </label>
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            if (selectedTokenPrice) setInputDenomination(inputDenomination === 'USD' ? 'TOKEN' : 'USD')
                        }}
                    >
                        <Icon name={'switch'} className="rotate-90 cursor-pointer fill-gray-1" />
                    </button>
                </div>
            )}
        </form>
    )
}

export default TokenAmountInput
