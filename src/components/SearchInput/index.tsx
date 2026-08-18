import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '../0_Bruddle/BaseInput'

interface SearchInputProps {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onClear: () => void
    inputRef?: React.RefObject<HTMLInputElement>
    className?: string
    placeholder?: string
}

export const SearchInput = ({
    value,
    onChange,
    onClear,
    inputRef,
    className,
    placeholder = 'Search by name or username',
}: SearchInputProps) => {
    return (
        <div className={`relative ${className}`}>
            {/* icono lupa */}
            <div className="absolute top-1/2 left-4 z-10 -translate-y-1/2">
                <Icon name="search" size={15} />
            </div>

            {/* input */}
            <BaseInput
                ref={inputRef}
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="h-10 w-full rounded-sm border border-black pr-10 pl-10 font-normal caret-[#FF90E8] focus:border-black focus:ring-0 focus:outline-none"
            />

            {/* botón limpiar */}
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute top-1/2 right-2 h-8 w-6 -translate-y-1/2 p-0"
                >
                    <Icon name="cancel" size={16} />
                </Button>
            )}
        </div>
    )
}
