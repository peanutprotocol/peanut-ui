import { useState, useEffect, ChangeEvent, useRef } from 'react'
import Icon from '@/components/Global/Icon'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import classNames from 'classnames'

type ValidatedInputProps = {
    label?: string
    value: string
    placeholder?: string
    debounceTime?: number
    validate: (value: string) => Promise<boolean>
    onUpdate: (update: InputUpdate) => void
    className?: string
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
}: ValidatedInputProps) => {
    const [isValid, setIsValid] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [debouncedValue, setDebouncedValue] = useState<string>(value)
    const previousValueRef = useRef(value)

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
        onUpdate({ value: newValue, isValid: false, isChanging: !!newValue })
    }
    return (
        <div className={classNames(`relative w-full ${className}`, {})}>
            {label && (
                <label className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center bg-white text-h8 font-medium">
                    {label}:
                </label>
            )}
            <BaseInput
                type="text"
                value={value}
                onChange={handleChange}
                className={classNames({
                    'pl-12': Boolean(label),
                    'border-red': value && !isValidating && !isValid,
                })}
                placeholder={placeholder}
                spellCheck="false"
            />
            {value &&
                (isValidating ? (
                    <div className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white">
                        <div
                            className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-none"
                            role="status"
                        />
                    </div>
                ) : (
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            onUpdate({ value: '', isValid: false, isChanging: false })
                        }}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white"
                    >
                        <Icon className="h-6 w-6 dark:fill-white" name="close" />
                    </button>
                ))}
        </div>
    )
}
export default ValidatedInput
