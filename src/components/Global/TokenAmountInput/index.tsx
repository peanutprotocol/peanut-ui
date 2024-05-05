'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import * as context from '@/context'
import * as utils from '@/utils'
interface TokenAmountInputProps {
    className?: string
    tokenValue: string | undefined
    setTokenValue: (tokenvalue: string | undefined) => void
}

const TokenAmountInput = ({ className, tokenValue, setTokenValue }: TokenAmountInputProps) => {
    const { inputDenomination, setInputDenomination, selectedTokenPrice } = useContext(context.tokenSelectorContext)
    const inputRef = useRef<any>(null)

    const onChange = (tokenvalue: string) => {
        setTokenValue(tokenvalue)
    }

    useEffect(() => {
        if (inputRef.current) {
            if (tokenValue?.length != 0) {
                inputRef.current.style.width = `${(tokenValue?.length ?? 0) + 1}ch`
            } else {
                inputRef.current.style.width = `4ch`
            }
        }
    }, [tokenValue])

    return (
        <form
            className={`relative max-w-96 rounded-none border border-n-1 px-2 py-4 dark:border-white ${className}`}
            action=""
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1 ">
                {inputDenomination === 'USD' ? (
                    <label className={` text-h1 ${tokenValue ? 'text-black' : 'text-gray-2'}`}>$</label>
                ) : (
                    <label className={`sr-only text-h1 `}>$</label>
                )}
                <input
                    className={`h-12 w-[4ch] bg-transparent text-h1 outline-none transition-colors placeholder:text-h1 focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white  dark:placeholder:text-white/75 dark:focus:border-purple-1`}
                    type="number"
                    placeholder={'0.00'}
                    value={tokenValue ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    ref={inputRef}
                    inputMode="decimal"
                    step="any"
                    min="0"
                    autoComplete="off"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                        }
                    }}
                />
            </div>
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
        </form>
    )
}

export default TokenAmountInput
