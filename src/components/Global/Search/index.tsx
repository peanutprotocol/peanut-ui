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
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Ensure that the input does not automatically focus when rendered
        if (ref.current) {
            ref.current.blur()
        }
    }, [])

    return (
        <form
            className={`relative ${className} ${large ? 'shadow-primary-4 w-full' : ''}`}
            action=""
            onSubmit={onSubmit}
        >
            <input
                ref={ref}
                className={`w-full rounded-none bg-transparent text-base outline-none
                transition-colors placeholder:text-base focus:border-purple-1 dark:border-white dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1 ${
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
                onFocus={(e) => e.target.blur()} // Keep input blurred on focus
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
