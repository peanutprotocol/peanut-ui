import BaseInput from '@/components/0_Bruddle/BaseInput'
import MoreInfo from '@/components/Global/MoreInfo'
import { createSmartPasteHandler, type PasteFieldKind } from '@/utils/clipboard-extract.utils'
import { useClipboardSuggestion } from '@/hooks/useClipboardSuggestion'
import { useDebounce } from '@/hooks/useDebounce'
import { AnimatePresence, motion } from 'framer-motion'
import * as Sentry from '@sentry/nextjs'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'
import Loading from '../Loading'

type ValidatedInputProps = {
    value: string
    placeholder?: string
    debounceTime?: number
    validate: (value: string) => Promise<boolean>
    shouldValidate?: (value: string) => boolean
    onUpdate: (update: InputUpdate) => void
    className?: string
    autoComplete?: string
    name?: string
    infoText?: string
    formatDisplayValue?: (value: string) => string
    isSetupFlow?: boolean
    isInputChanging?: boolean
    smartPasteKind?: PasteFieldKind
}

export type InputUpdate = {
    value: string
    isValid: boolean
    isChanging: boolean
}

const ValidatedInput = ({
    placeholder = '',
    value,
    debounceTime = 750,
    onUpdate,
    validate,
    shouldValidate,
    className,
    autoComplete,
    name,
    infoText,
    formatDisplayValue,
    isSetupFlow = false,
    isInputChanging = false,
    smartPasteKind,
}: ValidatedInputProps) => {
    const [isValid, setIsValid] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const debouncedValue = useDebounce(value, debounceTime)
    const {
        suggestion,
        check: checkClipboard,
        dismiss: dismissSuggestion,
    } = useClipboardSuggestion(smartPasteKind ?? 'recipient', value, !!smartPasteKind)
    const previousValueRef = useRef(value)
    const currentValueRef = useRef(value)
    const _listId = useRef(`datalist-${Math.random().toString(36).substr(2, 9)}`)
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

        // Incomplete input (e.g. too short to be a real handle): treat as still-changing
        // rather than invalid, so we skip the lookup and suppress the error UI.
        if (shouldValidate && !shouldValidate(debouncedValue)) {
            setIsValidating(false)
            setIsValid(false)
            if (currentValueRef.current === debouncedValue) {
                onUpdate({ value: debouncedValue, isValid: false, isChanging: true })
            }
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

    // Update currentValueRef when value changes
    useEffect(() => {
        currentValueRef.current = value
    }, [value])

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
        <div className="w-full">
            <div
                className={twMerge(
                    'relative w-full rounded-sm border border-n-1 bg-white focus:border-primary-1 dark:border-white',
                    value && !isValidating && !isValid && debouncedValue === value
                        ? ' border-error dark:border-error'
                        : '',
                    className
                )}
                translate="no"
            >
                <div className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
                    {infoText && (
                        <div className="notranslate flex h-6 w-6 items-center justify-center bg-white">
                            <MoreInfo text={infoText} />
                        </div>
                    )}
                </div>

                <div className="notranslate flex w-full items-center" translate="no">
                    <BaseInput
                        ref={inputRef}
                        type="text"
                        value={formatDisplayValue ? formatDisplayValue(value) : value}
                        onChange={handleChange}
                        onFocus={smartPasteKind ? () => checkClipboard() : undefined}
                        onPaste={
                            smartPasteKind
                                ? createSmartPasteHandler(smartPasteKind, (v) => {
                                      dismissSuggestion()
                                      onUpdate({ value: v, isValid: false, isChanging: true })
                                  })
                                : undefined
                        }
                        className={twMerge(
                            `notranslate h-12 w-full border-0 bg-white 
                        pr-1 text-sm font-medium outline-none focus:outline-none
                        active:bg-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75`,
                            !!infoText ? 'pl-0' : 'pl-4'
                        )}
                        placeholder={placeholder}
                        spellCheck="false"
                        autoComplete={autoComplete || 'off'}
                        autoCorrect="off"
                        autoCapitalize="off"
                        name={name}
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
                            ) : !!isSetupFlow && !isValid && !isInputChanging ? (
                                <div className="mr-2 flex h-full items-center justify-center rounded-full">
                                    <Icon size={20} className="text-secondary-2" name="error" />
                                </div>
                            ) : !!isSetupFlow && !!isValid && !isInputChanging ? (
                                <div className="mr-2 flex size-5 items-center justify-center rounded-full bg-secondary-8">
                                    <Icon size={12} className=" rounded-full p-0 text-white" name="check" />
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
            </div>
            <AnimatePresence initial={false}>
                {smartPasteKind && suggestion && !value && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                dismissSuggestion()
                                onUpdate({ value: suggestion, isValid: false, isChanging: true })
                            }}
                            className="flex w-full items-start gap-1.5 rounded-sm border border-n-1 bg-white px-3 py-2 text-left text-xs font-medium text-n-1 transition-colors hover:bg-n-3 dark:border-white dark:bg-n-1 dark:text-white dark:hover:bg-n-2"
                        >
                            <Icon name="paste" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="break-all">
                                Paste <span className="notranslate">{suggestion}</span>
                            </span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default ValidatedInput
