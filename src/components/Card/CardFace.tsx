'use client'
import type { FC } from 'react'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@/components/Global/Icons/Icon'
import { PEANUT_CARD_HAND, VISA_BRAND_MARK } from '@/assets/cards'
import { PEANUTMAN_LOGO } from '@/assets/peanut'

export interface RevealedCardDetails {
    pan: string
    cvv: string
    expiryMonth: number
    expiryYear: number
}

interface Props {
    last4: string
    isVirtual?: boolean
    isLocked?: boolean
    revealed?: RevealedCardDetails | null
    onToggleReveal?: () => void
    onCopy?: (value: string, field: 'pan' | 'cvv') => void
    /** Marketing / empty-state preview. Renders a sample PAN + cardholder
     *  + expiry with no interactive controls (no eye toggle, no copy, no
     *  Virtual pill). Overrides `revealed` / `last4`. */
    preview?: boolean
    previewPan?: string
    previewCardholderName?: string
    previewCardholderLabel?: string
    previewExpiry?: string
    className?: string
}

const DEFAULT_PREVIEW = {
    pan: '6969042088800420',
    cardholderName: 'NUTTY YOU',
    cardholderLabel: 'Peanut Pioneer',
    expiry: '06/69',
}

const formatPan = (pan: string) => pan.replace(/(.{4})/g, '$1 ').trim()

const CardFace: FC<Props> = ({
    last4,
    isVirtual = true,
    isLocked = false,
    revealed,
    onToggleReveal,
    onCopy,
    preview = false,
    previewPan = DEFAULT_PREVIEW.pan,
    previewCardholderName = DEFAULT_PREVIEW.cardholderName,
    previewCardholderLabel = DEFAULT_PREVIEW.cardholderLabel,
    previewExpiry = DEFAULT_PREVIEW.expiry,
    className,
}) => {
    const showingDetails = revealed != null

    return (
        <div
            className={twMerge(
                'relative aspect-[1.586/1] w-full overflow-hidden rounded-3xl bg-primary-1 text-n-1',
                isLocked && 'grayscale',
                className
            )}
        >
            {/* Hand + yellow stripe artwork. Decorative — sits behind content.
             * Rotated counterclockwise so the arm sweeps up from the bottom,
             * leaving the top-right (Visa) and bottom-right (eye toggle)
             * corners clear. */}
            <Image
                src={PEANUT_CARD_HAND}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -inset-y-10 -right-5 h-full w-auto origin-center -rotate-[15deg] select-none"
                priority
            />

            <div className="relative flex h-full w-full flex-col p-4">
                {/* Top row: peanut icon (no wordmark) + Visa */}
                <div className="flex items-start justify-between">
                    <Image src={PEANUTMAN_LOGO} alt="" aria-hidden className="h-10 w-auto" />
                    <Image src={VISA_BRAND_MARK} alt="Visa" className="h-6 w-auto brightness-0 invert" />
                </div>

                {/* Bottom block — PAN sits at the very bottom (in the slot the
                 * Virtual pill occupies when masked). When revealed, the PAN
                 * stays on top and expiry + CVV sit below it. Preview mode
                 * mimics an embossed plastic card for marketing screens. */}
                <div className="mt-auto flex flex-col">
                    {preview ? (
                        <>
                            <span className="text-xl font-extrabold tracking-wider">{formatPan(previewPan)}</span>
                            <div className="mt-1 flex items-end justify-between gap-6 text-xs">
                                <div>
                                    <div className="opacity-70">{previewCardholderLabel}</div>
                                    <div className="font-bold">{previewCardholderName}</div>
                                </div>
                                <div>
                                    <div className="opacity-70">Valid</div>
                                    <div className="font-bold">{previewExpiry}</div>
                                </div>
                            </div>
                        </>
                    ) : showingDetails ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-extrabold tracking-wider">{formatPan(revealed.pan)}</span>
                                {onCopy && (
                                    <button
                                        type="button"
                                        aria-label="Copy card number"
                                        onClick={() => onCopy(revealed.pan, 'pan')}
                                        className="p-1"
                                    >
                                        <Icon name="copy" size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-end justify-between">
                                <div className="text-s flex gap-6">
                                    <div>
                                        <div className="opacity-70">Expiry</div>
                                        <div className="font-bold">
                                            {String(revealed.expiryMonth).padStart(2, '0')}/
                                            {String(revealed.expiryYear).slice(-2)}
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <div>
                                            <div className="opacity-70">CVV</div>
                                            <div className="font-bold">{revealed.cvv}</div>
                                        </div>
                                        {onCopy && (
                                            <button
                                                type="button"
                                                aria-label="Copy CVV"
                                                onClick={() => onCopy(revealed.cvv, 'cvv')}
                                                className="p-1"
                                            >
                                                <Icon name="copy" size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {onToggleReveal && (
                                    <button
                                        type="button"
                                        aria-label="Hide card details"
                                        onClick={onToggleReveal}
                                        className="p-1"
                                    >
                                        <Icon name="eye-slash" size={22} />
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl font-extrabold tracking-wider">•••• {last4}</span>
                            <div className="mt-1 flex items-end justify-between">
                                {isVirtual ? (
                                    <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold">
                                        Virtual
                                    </span>
                                ) : (
                                    <span />
                                )}
                                {onToggleReveal && (
                                    <button
                                        type="button"
                                        aria-label="Show card details"
                                        onClick={onToggleReveal}
                                        className="p-1"
                                    >
                                        <Icon name="eye" size={22} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default CardFace
