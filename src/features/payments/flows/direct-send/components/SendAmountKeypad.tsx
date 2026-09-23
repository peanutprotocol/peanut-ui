'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Icon } from '@/components/Global/Icons/Icon'
import { useToast } from '@/components/0_Bruddle/Toast'
import { clipboardHasStrings } from '@/utils/clipboard-detect'
import { readClipboard } from '@/utils/clipboard-extract.utils'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import { formatTokenAmount } from '@/utils/general.utils'
import { formatSendAmount, parseClipboardAmount, pressAmountKey, type AmountKey } from '../sendAmount.utils'

const KEYS: { label: string; value: AmountKey; ariaLabel?: string }[] = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '.', value: 'decimal' },
    { label: '0', value: '0' },
    { label: '⌫', value: 'delete' },
]

interface SendAmountKeypadProps {
    amount: string
    onAmountChange: (value: string) => void
    balance?: string
    balanceFillAmount?: number
    disabled?: boolean
    commentActive?: boolean
    validationMessage?: string
    validationAction?: ReactNode
    children: ReactNode
}

export function SendAmountKeypad({
    amount,
    onAmountChange,
    balance,
    balanceFillAmount,
    disabled = false,
    commentActive = false,
    validationMessage,
    validationAction,
    children,
}: SendAmountKeypadProps) {
    const t = useTranslations('payment.amountEntry')
    const tGlobal = useTranslations('global.amountInput')
    const toast = useToast()
    const [copiedAmount, setCopiedAmount] = useState<string | null>(null)
    const [hasUninspectedText, setHasUninspectedText] = useState(false)

    // QRScanner follows the same split: Android can inspect the clipboard at
    // open; iOS may only check for text without a paste-permission prompt.
    useEffect(() => {
        let cancelled = false
        const refresh = () => {
            if (isAndroidNative()) {
                void readClipboard().then((result) => {
                    if (cancelled) return
                    setCopiedAmount(result.ok ? parseClipboardAmount(result.text) : null)
                    setHasUninspectedText(false)
                })
            } else if (isIOSNative()) {
                void clipboardHasStrings().then((hasStrings) => {
                    if (cancelled) return
                    setCopiedAmount(null)
                    setHasUninspectedText(hasStrings)
                })
            } else {
                // A browser cannot inspect clipboard contents without access
                // the user may not have granted. Keep the paste action visible,
                // as QRScanner does, and validate the text on the user's tap.
                setHasUninspectedText(true)
                if (navigator.permissions?.query && navigator.clipboard?.readText) {
                    void navigator.permissions
                        .query({ name: 'clipboard-read' as PermissionName })
                        .then(async (permission) => {
                            if (permission.state !== 'granted') return
                            const text = await navigator.clipboard.readText()
                            if (!cancelled) {
                                setCopiedAmount(parseClipboardAmount(text))
                            }
                        })
                        .catch(() => {
                            if (!cancelled) setCopiedAmount(null)
                        })
                }
            }
        }
        refresh()
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh()
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', refresh)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', refresh)
        }
    }, [])

    const pasteAmount = useCallback(async () => {
        const keepBrowserPasteAction = !isAndroidNative() && !isIOSNative()
        const result = await readClipboard()
        if (!result.ok) {
            toast.error(t(result.reason === 'unavailable' ? 'clipboardUnavailable' : 'noAmountOnClipboard'))
            setCopiedAmount(null)
            setHasUninspectedText(keepBrowserPasteAction)
            return
        }
        const parsed = parseClipboardAmount(result.text)
        if (!parsed) {
            toast.error(t('noAmountOnClipboard'))
            setCopiedAmount(null)
            setHasUninspectedText(keepBrowserPasteAction)
            return
        }
        onAmountChange(parsed)
        setCopiedAmount(parsed)
        setHasUninspectedText(false)
    }, [onAmountChange, t, toast])

    const fillValue = balanceFillAmount ? formatTokenAmount(String(balanceFillAmount), 2, true) : undefined
    const canFillBalance = !disabled && !!fillValue && Number(fillValue) > 0

    return (
        <div className="flex w-full flex-1 flex-col">
            <div className="flex min-h-32 flex-1 flex-col items-center justify-center">
                {balance && (
                    <div className="flex min-h-11 items-center justify-center gap-1 text-body-s text-foreground-secondary">
                        <span>{tGlobal('balance')}</span>
                        {canFillBalance ? (
                            <button
                                type="button"
                                onClick={() => fillValue && onAmountChange(fillValue)}
                                aria-label={tGlobal('useFullBalance', { balance: `$${balance}` })}
                                className="min-h-11 min-w-11 px-1 text-foreground-primary underline underline-offset-4 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                            >
                                ${balance}
                            </button>
                        ) : (
                            <span>${balance}</span>
                        )}
                    </div>
                )}
                <output
                    aria-label={t('amountValue')}
                    className="max-w-full truncate text-heading-big-input text-foreground-primary"
                >
                    {formatSendAmount(amount)}
                </output>
                {validationMessage && <FieldError className="mt-1 text-center">{validationMessage}</FieldError>}
                {validationAction && (
                    <div className="mt-2 flex min-h-11 items-center justify-center">{validationAction}</div>
                )}
                {(copiedAmount || hasUninspectedText) && (
                    <button
                        type="button"
                        onClick={() => void pasteAmount()}
                        disabled={disabled}
                        className="mt-3 flex min-h-11 items-center gap-1 rounded-full border border-border-subtle bg-background-default px-3 text-label-l text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus disabled:opacity-40"
                    >
                        <Icon name="paste" size={16} />
                        {t('pasteFromClipboard')}
                        {copiedAmount && (
                            <span className="text-foreground-secondary">{formatSendAmount(copiedAmount)}</span>
                        )}
                    </button>
                )}
            </div>
            <div className="mb-3 flex min-h-12 items-center justify-center">{children}</div>
            <div
                role="group"
                aria-label={t('keypad')}
                aria-hidden={commentActive}
                className={`grid w-full grid-cols-3 ${commentActive ? 'pointer-events-none invisible' : ''}`}
                onPaste={(event) => {
                    if (disabled || commentActive) return
                    const parsed = parseClipboardAmount(event.clipboardData.getData('text'))
                    if (parsed) {
                        event.preventDefault()
                        onAmountChange(parsed)
                    }
                }}
            >
                {KEYS.map(({ label, value }, index) => (
                    <div
                        key={value}
                        className={`${index % 3 !== 2 ? 'border-r' : ''} ${index < 9 ? 'border-b' : ''} border-border-subtle`}
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-15 w-full rounded-none p-0 text-heading-s"
                            onClick={() => onAmountChange(pressAmountKey(amount, value))}
                            aria-label={value === 'delete' ? t('delete') : value === 'decimal' ? t('decimal') : label}
                            disabled={disabled}
                        >
                            {label}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
