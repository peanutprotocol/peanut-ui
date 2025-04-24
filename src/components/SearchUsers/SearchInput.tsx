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
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="search" size={20} />
            </div>
            <BaseInput
                ref={inputRef}
                type="text"
                value={value}
                onChange={onChange}
                placeholder="Name or username"
                className="h-10 w-full rounded-sm border border-black pl-12 pr-10"
            />
            {value && (
                <Button
                    variant="transparent"
                    onClick={onClear}
                    className="absolute right-4 top-1/2 h-8 w-6 -translate-y-1/2 p-0"
                >
                    <Icon name="cancel" size={16} />
                </Button>
            )}
        </div>
    )
}
