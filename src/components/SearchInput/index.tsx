import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    onClear: () => void
    placeholder?: string
    inputRef?: React.RefObject<HTMLInputElement>
    className?: string
    'aria-label'?: string
    /** Clear-button label. Needed where the `global` namespace is absent (marketing). */
    clearLabel?: string
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
    clearLabel,
    ...props
}: SearchInputProps) => {
    const t = useTranslations('global')
    return (
        <div className={twMerge('relative', className)}>
            <BaseInput
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                size="sm"
                className="w-full px-10 text-body-s font-normal"
                {...props}
            />
            <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-foreground-secondary"
            />
            {value && (
                <Button
                    variant="ghost"
                    onClick={onClear}
                    className="absolute top-1/2 right-2 w-fit -translate-y-1/2 p-0 after:absolute after:-inset-3"
                    aria-label={clearLabel ?? t('tokenSelector.clearSearch')}
                >
                    <div className="flex size-6 items-center justify-center">
                        <Icon name="cancel" size={16} className="text-foreground-secondary" />
                    </div>
                </Button>
            )}
        </div>
    )
}
