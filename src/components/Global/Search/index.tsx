'use client'
import Icon from '@/components/Global/Icon'
import { useEffect, useRef, useState } from 'react'

type SearchProps = {
    className?: string
    placeholder: string
    value: string
    onChange: any
    onSubmit: any
    large?: boolean
    medium?: boolean
    border?: boolean
}

const Search = ({ className, placeholder, value, onChange, onSubmit, large, medium, border }: SearchProps) => {
    const [initialRender, setInitialRender] = useState(true)
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            if (ref.current && initialRender) {
                ref.current.blur()
                setInitialRender(false)
            }
        }, 100) // Delays the blur slightly to ensure UI is ready
        return () => clearTimeout(timer)
    }, [])

    return (
        <form
            className={`relative  ${className} ${large ? 'shadow-primary-4 w-full' : ''}`}
            action=""
            onSubmit={onSubmit}
        >
            <input
                className={`transition-color s w-full rounded-none bg-transparent text-base
                outline-none placeholder:text-base focus:border-purple-1 dark:border-white dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1 ${
                    large
                        ? 'h-16 bg-white pl-6 pr-18 text-base font-medium dark:bg-n-1'
                        : medium
                          ? 'h-12 pl-6 pr-8 text-base font-medium dark:bg-n-1 dark:text-white'
                          : 'h-8 pl-8 pr-4 text-base font-bold'
                } ${border && 'border border-n-1'}`}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                autoFocus={false}
                onFocus={(e) => {
                    console.log('focus')
                    e.preventDefault()
                    // ref.current?.blur()
                }}
            />
            <button
                className={`absolute text-0 ${
                    large
                        ? 'right-5 top-1/2 h-8 w-8 -translate-y-1/2 border border-n-1 bg-purple-1 transition-colors hover:bg-purple-1/90'
                        : 'bottom-0 left-0 top-0 w-8'
                }`}
            >
                <Icon className="dark:fill-white" name="search" />
            </button>
        </form>
    )
}

export default Search
