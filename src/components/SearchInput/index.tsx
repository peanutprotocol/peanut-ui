import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { twMerge } from 'tailwind-merge'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    onClear: () => void
    placeholder?: string
    inputRef?: React.RefObject<HTMLInputElement>
    className?: string
    'aria-label'?: string
}

/**
 * The one search field: a thin wrapper over the DS input (BaseInput / .input)
 * with a leading search icon and a clear button. Zero styling of its own
 * beyond icon placement.
 */
export const SearchInput = ({
    value,
    onChange,
    onClear,
    placeholder,
    inputRef,
    className,
    ...props
}: SearchInputProps) => {
    return (
        <div className={twMerge('relative', className)}>
            <BaseInput
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-10 w-full px-10 text-body-s font-normal"
                {...props}
            />
            <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-foreground-secondary"
            />
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute top-1/2 right-2 w-fit -translate-y-1/2 p-0"
                    aria-label="Clear search"
                >
                    <div className="flex size-6 items-center justify-center">
                        <Icon name="cancel" size={16} className="text-foreground-secondary" />
                    </div>
                </Button>
            )}
        </div>
    )
}

export default SearchInput
