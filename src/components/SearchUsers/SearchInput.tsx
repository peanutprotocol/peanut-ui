import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '../0_Bruddle'
import BaseInput from '../0_Bruddle/BaseInput'

interface SearchInputProps {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onClear: () => void
    inputRef?: React.RefObject<HTMLInputElement>
    className?: string
}

export const SearchInput = ({ value, onChange, onClear, inputRef, className }: SearchInputProps) => {
    return (
        <div className={`relative ${className}`}>
            {/* icono lupa */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="search" size={15} />
            </div>

            {/* input */}
            <BaseInput
                ref={inputRef}
                type="text"
                value={value}
                onChange={onChange}
                placeholder="Search by name or username"
                className="h-10 w-full rounded-sm border border-black pl-10 pr-10 font-normal caret-[#FF90E8] focus:border-black focus:outline-none focus:ring-0"
            />

            {/* botón limpiar */}
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute right-2 top-1/2 h-8 w-6 -translate-y-1/2 p-0"
                >
                    <Icon name="cancel" size={16} />
                </Button>
            )}
        </div>
    )
}
