import BaseInput from '@/components/0_Bruddle/BaseInput'
import MoreInfo from '@/components/Global/MoreInfo'
import * as Sentry from '@sentry/nextjs'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'
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
    debounceTime = 750,
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
    const currentValueRef = useRef(value)
    const listId = useRef(`datalist-${Math.random().toString(36).substr(2, 9)}`)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!inputRef.current) return

        // disable translation for the input element
        inputRef.current.setAttribute('translate', 'no')
        inputRef.current.classList.add('notranslate')

        // create a MutationObserver to monitor changes in the input element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // handle added nodes to remove unwanted elements (e.g., google translate overlays)
                if (mutation.type === 'childList') {
                    Array.from(mutation.addedNodes).forEach((node) => {
                        if (
                            node.nodeType === 1 &&
                            ((node as Element).classList?.contains('google-translate-skip') ||
                                (node as Element).getAttribute('translate') === 'yes')
                        ) {
                            ;(node as Element).remove()
                        }
                    })
                }

                // ensure the input value matches current value ref
                if (inputRef.current && inputRef.current.value !== currentValueRef.current) {
                    inputRef.current.value = currentValueRef.current
                }
            })
        })

        // observe input for changes
        observer.observe(inputRef.current, {
            childList: true, // monitor child node additions/removals
            subtree: true, // monitor changes in all descendant nodes
            characterData: true, // monitor changes to text content
            attributes: true, // monitor changes to attributes
        })

        // cleanup observer when the component unmounts
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (debouncedValue === '') {
            return
        }

        let isStale = false
        previousValueRef.current = debouncedValue
        setIsValidating(true)

        validate(debouncedValue)
            .then((isValid) => {
                if (isStale) return
                setIsValid(isValid)
                if (currentValueRef.current === debouncedValue) {
                    onUpdate({ value: debouncedValue, isValid, isChanging: false })
                }
            })
            .catch((error) => {
                if (isStale) return
                console.error('Unexpected error while validating input field:', error)
                setIsValid(false)
                if (currentValueRef.current === debouncedValue) {
                    onUpdate({ value: debouncedValue, isValid: false, isChanging: false })
                }
                Sentry.captureException(error)
            })
            .finally(() => {
                if (!isStale) {
                    setIsValidating(false)
                }
            })

        return () => {
            isStale = true
        }
    }, [debouncedValue])

    useEffect(() => {
        currentValueRef.current = value
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, debounceTime)

        return () => {
            clearTimeout(handler)
        }
    }, [value, debounceTime])

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        currentValueRef.current = newValue
        onUpdate({
            value: newValue,
            isValid: false,
            isChanging: true,
        })
    }

    return (
        <div
            className={`relative w-full border border-n-1 bg-white focus:border-primary-1 dark:border-white ${
                value && !isValidating && !isValid && debouncedValue === value ? ' border-red dark:border-red' : ''
            } ${className}`}
            translate="no"
        >
            <div className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
                {infoText && (
                    <div className="notranslate flex h-6 w-6 items-center justify-center bg-white">
                        <MoreInfo text={infoText} html={true} />
                    </div>
                )}
            </div>

            <div className="notranslate flex w-full items-center" translate="no">
                <BaseInput
                    ref={inputRef}
                    type="text"
                    value={formatDisplayValue ? formatDisplayValue(value) : value}
                    onChange={handleChange}
                    className={twMerge(
                        `notranslate tap-highlight-color-white h-12 w-full border-0 bg-white 
                        pr-1 text-h8 font-medium outline-none focus:outline-none
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
                    translate="no"
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
                                : 'bg-white opacity-100 transition-opacity hover:opacity-100 md:opacity-0'
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
                                <Icon className="h-6 w-6 dark:fill-white" name="cancel" />
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
