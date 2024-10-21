import { useState, useEffect, ChangeEvent, useRef } from 'react'
import Icon from '@/components/Global/Icon'
type ValidatedInputProps = {
    label: string
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
    const [debouncedValue, setDebouncedValue] = useState<string>('')
    const previousValueRef = useRef(value)

    useEffect(() => {
        if ('' === debouncedValue || debouncedValue === previousValueRef.current) {
            return
        }
        let isStale = false
        previousValueRef.current = debouncedValue
        setIsValidating(true)
        validate(debouncedValue).then((isValid) => {
            if (isStale) return
            setIsValid(isValid)
            setIsValidating(false)
            onUpdate({ value: debouncedValue, isValid, isChanging: false })
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
        <div
            className={`relative w-full max-w-96 border border-n-1 dark:border-white${
                value && !isValidating && isValid
                    ? ' border border-n-1 dark:border-white'
                    : value && !isValidating && !isValid
                      ? ' border-n-1 border-red dark:border-red'
                      : ''
            } ${className}`}
        >
            <div className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center bg-white text-h8 font-medium">
                {label}:
            </div>
            <input
                type="text"
                value={value}
                onChange={handleChange}
                className={`transition-color h-12 w-full rounded-none bg-transparent
                bg-white px-4 pl-8 text-h8 font-medium outline-none placeholder:text-sm focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1`}
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
