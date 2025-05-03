import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Icon } from '@/components/Global/Icons/Icon'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface SearchInputProps extends Omit<React.ComponentProps<typeof BaseInput>, 'onChange' | 'value'> {
    value: string
    onChange: (value: string) => void
    onClear: () => void
    placeholder?: string
    className?: string
    inputClassName?: string
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    onClear,
    placeholder = 'Search...',
    className,
    inputClassName,
    ...rest
}) => {
    return (
        <div className={twMerge('relative', className)}>
            <BaseInput
                variant="md"
                className={twMerge('h-10 w-full border border-black px-10 text-sm font-normal', inputClassName)}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                {...rest}
            />
            <Icon name="search" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-grey-1" />
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute right-2 top-1/2 w-fit -translate-y-1/2 p-0"
                    aria-label="Clear search"
                >
                    <div className="flex size-6 items-center justify-center">
                        <Icon name="cancel" className="h-5 w-5 text-grey-1" />
                    </div>
                </Button>
            )}
        </div>
    )
}

export default SearchInput
