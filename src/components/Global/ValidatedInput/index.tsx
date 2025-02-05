import BaseInput from '@/components/0_Bruddle/BaseInput'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Loading from '../Loading'

type ValidatedInputProps = {
    label?: string
    value: string
    placeholder?: string
    debounceTime?: number
    validate: (value: string) => Promise<boolean>
    onUpdate: (update: InputUpdate) => void
    className?: string
    autoComplete?: string
    name?: string
    suggestions?: string[]
    infoText?: string
    formatDisplayValue?: (value: string) => string
}

export type InputUpdate = {
    value: string
    isValid: boolean
    isChanging: boolean
}

const ValidatedInput = ({
    label,
    placeholder = '',
    value,
    debounceTime = 300,
    onUpdate,
    validate,
    className,
    autoComplete,
    name,
    suggestions,
    infoText,
    formatDisplayValue,
}: ValidatedInputProps) => {
    const [isValid, setIsValid] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [debouncedValue, setDebouncedValue] = useState<string>(value)
    const previousValueRef = useRef(value)
    const listId = useRef(`datalist-${Math.random().toString(36).substr(2, 9)}`)

    useEffect(() => {
        if ('' === debouncedValue) {
            return
        }
        let isStale = false
        previousValueRef.current = debouncedValue
        setIsValidating(true)
        validate(debouncedValue)
            .then((isValid) => {
                if (isStale) return
                setIsValid(isValid)
                onUpdate({ value: debouncedValue, isValid, isChanging: false })
            })
            .catch((error) => {
                if (isStale) return
                console.error('Unexpected error while validating recipient input field:', error)
                setIsValid(false)
                onUpdate({ value: debouncedValue, isValid: false, isChanging: false })
            })
            .finally(() => {
                if (isStale) return
                setIsValidating(false)
            })
        return () => {
            isStale = true
        }
    }, [debouncedValue])

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, debounceTime)
        return () => {
            clearTimeout(handler)
        }
    }, [value, debounceTime])

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onUpdate({
            value: newValue,
            isValid: false,
            isChanging: !!newValue,
        })
    }

    return (
        <div
            className={`relative w-full border border-n-1 focus:border-purple-1 dark:border-white ${
                value && !isValidating && !isValid && debouncedValue === value ? ' border-red dark:border-red' : ''
            } ${className}`}
        >
            <div className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
                {infoText && (
                    <div className="flex h-6 w-6 items-center justify-center bg-white">
                        <MoreInfo text={infoText} html={true} />
                    </div>
                )}
            </div>

            <div className="flex w-full items-center">
                <BaseInput
                    type="text"
                    value={formatDisplayValue ? formatDisplayValue(value) : value}
                    onChange={handleChange}
                    className={twMerge(
                        `h-12 w-full border-0 bg-white pr-1 text-h8 
                        font-medium outline-none focus:outline-none
                        active:bg-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75`,
                        !!infoText ? 'pl-0' : 'pl-4'
                    )}
                    placeholder={placeholder}
                    spellCheck="false"
                    autoComplete={autoComplete || 'off'}
                    autoCorrect="off"
                    autoCapitalize="off"
                    name={name}
                    list={suggestions ? listId.current : undefined}
                    style={{
                        WebkitTapHighlightColor: 'transparent',
                        WebkitTextFillColor: 'inherit',
                    }}
                />
                {value && (
                    <div
                        className={`h-full ${
                            isValidating
                                ? 'opacity-100'
                                : 'opacity-100 transition-opacity hover:opacity-100 md:opacity-0'
                        }`}
                    >
                        {isValidating ? (
                            <div className="flex h-full w-12 items-center justify-center dark:bg-n-1">
                                <Loading />
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    onUpdate({ value: '', isValid: false, isChanging: false })
                                }}
                                className="flex h-full w-6 items-center justify-center pr-2 dark:bg-n-1 md:w-8 md:pr-0"
                            >
                                <Icon className="h-6 w-6 dark:fill-white" name="close" />
                            </button>
                        )}
                    </div>
                )}
            </div>
            {suggestions && (
                <datalist id={listId.current}>
                    {suggestions.map((suggestion, index) => (
                        <option key={index} value={suggestion} />
                    ))}
                </datalist>
            )}
        </div>
    )
}

export default ValidatedInput
