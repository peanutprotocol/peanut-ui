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
    /** Control rendered inside the field at the right end, after the clear
     *  button — a filter entry point on a list that is searched and filtered
     *  together. Match the clear button's anatomy (24px box, 16px icon) so the
     *  two read as one cluster. */
    trailing?: React.ReactNode
}

/**
 * The one search field: a thin wrapper over the DS input (BaseInput / .input)
 * with a leading search icon, a clear button, and an optional trailing
 * control. Zero styling of its own beyond icon placement.
 */
export const SearchInput = ({
    value,
    onChange,
    onClear,
    placeholder,
    inputRef,
    className,
    trailing,
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
                // reserve the right end for the control cluster, whether or not
                // the clear button is showing — padding must not shift as the
                // user types
                className={twMerge('h-10 w-full px-10 text-body-s font-normal', trailing && 'pr-16')}
                {...props}
            />
            <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-foreground-secondary"
            />
            {/* Right cluster. With a neighbour present the clear button's hit
                area narrows to its own column (48px tall, 32px wide) so the two
                controls cannot steal each other's taps; alone it keeps the
                original 48px square. */}
            <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-2">
                {value && (
                    <Button
                        variant="transparent"
                        onClick={onClear}
                        className={twMerge(
                            'relative w-fit p-0 after:absolute',
                            trailing ? 'after:-inset-x-1 after:-inset-y-3' : 'after:-inset-3'
                        )}
                        aria-label={t('tokenSelector.clearSearch')}
                    >
                        <div className="flex size-6 items-center justify-center">
                            <Icon name="cancel" size={16} className="text-foreground-secondary" />
                        </div>
                    </Button>
                )}
                {trailing}
            </div>
        </div>
    )
}
