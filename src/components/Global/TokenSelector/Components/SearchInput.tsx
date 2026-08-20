import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Icon } from '@/components/Global/Icons/Icon'
import { useTranslations } from 'next-intl'
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
    placeholder,
    className,
    inputClassName,
    ...rest
}) => {
    const t = useTranslations('global')

    return (
        <div className={twMerge('relative', className)}>
            <BaseInput
                variant="md"
                className={twMerge(
                    'h-10 w-full border border-border-default px-10 text-body-s font-normal',
                    inputClassName
                )}
                placeholder={placeholder ?? t('tokenSelector.searchPlaceholder')}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                {...rest}
            />
            <Icon
                name="search"
                className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-foreground-secondary"
            />
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute top-1/2 right-2 w-fit -translate-y-1/2 p-0"
                    aria-label={t('tokenSelector.clearSearch')}
                >
                    <div className="flex size-6 items-center justify-center">
                        <Icon name="cancel" className="h-5 w-5 text-foreground-secondary" />
                    </div>
                </Button>
            )}
        </div>
    )
}

export default SearchInput
