'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

interface TokenAmountInputProps {
    className?: string
}

const TokenAmountInput = ({ className }: TokenAmountInputProps) => {
    const [inputDenomination, setInputDenomination] = useState<'USD' | 'TOKEN'>('TOKEN')
    const inputRef = useRef<any>(null)

    const [value, setValue] = useState('')
    const onChange = (value: string) => {
        setValue(value)
    }

    useEffect(() => {
        if (inputRef.current) {
            if (value.length != 0) {
                inputRef.current.style.width = `${value.length + 1}ch`
            } else {
                inputRef.current.style.width = `4ch`
            }
        }
    }, [value]) // TODO: default width of inputRef to 4ch before render

    return (
        <form
            className={`relative max-w-96 rounded-none border border-n-1 px-2 py-4 dark:border-white ${className}`}
            action=""
        >
            <div className="flex h-14 w-full flex-row items-center justify-center gap-1 ">
                {inputDenomination === 'USD' ? (
                    <label className={` text-h1 ${value ? 'text-black' : 'text-gray-2'}`}>$</label>
                ) : (
                    <label className={`sr-only text-h1 `}>$</label>
                )}
                <input
                    className={`h-12 w-[4ch] bg-transparent text-h1 outline-none transition-colors placeholder:text-h1 focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white  dark:placeholder:text-white/75 dark:focus:border-purple-1`}
                    type="number"
                    placeholder={'0.00'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    ref={inputRef}
                    inputMode="decimal"
                    step="any"
                    min="0"
                    autoComplete="off"
                />
            </div>
            <div className="flex w-full flex-row items-center justify-center gap-1">
                <label className="text-base text-gray-1">{inputDenomination === 'USD' ? '0.00' : '$0.00'}</label>
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        setInputDenomination(inputDenomination === 'USD' ? 'TOKEN' : 'USD')
                    }}
                >
                    <Icon name={'switch'} className="rotate-90 cursor-pointer fill-gray-1" />
                </button>
            </div>
        </form>
    )
}

export default TokenAmountInput
