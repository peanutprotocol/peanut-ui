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

    return (
        <form
            className={`border-n-1 relative max-w-96 rounded-none border px-2 py-4 dark:border-white ${className}`}
            action=""
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1 ">
                {inputDenomination === 'USD' ? (
                    <label className={` text-h1 ${tokenValue ? 'text-black' : 'text-gray-2'}`}>$</label>
                ) : (
                    <label className={`text-h1 sr-only `}>$</label>
                )}
                <input
                    className={`text-h1 placeholder:text-h1 focus:border-purple-1 dark:bg-n-1 dark:focus:border-purple-1 h-12 w-[4ch] max-w-80 bg-transparent outline-none transition-colors dark:border-white  dark:text-white dark:placeholder:text-white/75`}
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
            <div className="flex w-full flex-row items-center justify-center gap-1">
                <label className="text-gray-1 text-base">
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
                    <Icon name={'switch'} className="fill-gray-1 rotate-90 cursor-pointer" />
                </button>
            </div>
        </form>
    )
}

export default TokenAmountInput
