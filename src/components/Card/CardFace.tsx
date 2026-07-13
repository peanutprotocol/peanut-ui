'use client'
import { type FC, useState } from 'react'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@/components/Global/Icons/Icon'
import CardDetailField from '@/components/Card/CardDetailField'
import { PEANUT_CARD_HAND, VISA_BRAND_MARK } from '@/assets/cards'
import { PEANUTMAN } from '@/assets/mascot'

export interface RevealedCardDetails {
    pan: string
    cvv: string
    expiryMonth: number
    expiryYear: number
    /** Registered cardholder name from Rain. Optional — the backend resolves it
     *  best-effort, so a Rain hiccup leaves it absent and the field is hidden. */
    cardholderName?: string
}

interface Props {
    last4: string
    isVirtual?: boolean
    isLocked?: boolean
    revealed?: RevealedCardDetails | null
    /** Render skeleton blocks where PAN/expiry/CVV would appear. Used between
     *  "user tapped reveal" and the reveal payload arriving — replaces the
     *  static loading sentence with in-place skeletons. */
    loading?: boolean
    /** Reveal-error message. Rendered INSIDE the card face so a failed reveal
     *  doesn't push surrounding layout. `useCardReveal` clears the error on
     *  the next attempt, so the eye button (visible when not loading) is
     *  the retry affordance — no separate dismiss needed. */
    error?: string | null
    onToggleReveal?: () => void
    onCopy?: (value: string, field: 'pan' | 'cvv') => void
    /** Pre-activation preview: PAN/cardholder/expiry rendered as `?`s.
     *  Used on AddCardEntryScreen before KYC + first spend. */
    locked?: boolean
    className?: string
}

const formatPan = (pan: string) => pan.replace(/(.{4})/g, '$1 ').trim()

const CardFace: FC<Props> = ({
    last4,
    isVirtual = true,
    isLocked = false,
    revealed,
    loading = false,
    error,
    onToggleReveal,
    onCopy,
    locked = false,
    className,
}) => {
    const showingDetails = revealed != null
    const [copiedField, setCopiedField] = useState<'pan' | 'cvv' | null>(null)

    const handleCopy = (value: string, field: 'pan' | 'cvv') => {
        setCopiedField(field)
        // Clear only if still showing the same field — guards against an
        // earlier setTimeout overwriting a fresher copy on the other field.
        setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500)
        onCopy?.(value, field)
    }

    return (
        <div
            className={twMerge(
                'relative aspect-[1.586/1] w-full overflow-hidden rounded-xl bg-primary-1 text-n-1',
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
                    <Image src={PEANUTMAN} alt="" aria-hidden className="h-10 w-auto" />
                    <Image src={VISA_BRAND_MARK} alt="Visa" className="h-6 w-auto brightness-0 invert" />
                </div>

                {/* Bottom block — PAN sits at the very bottom (in the slot the
                 * Virtual pill occupies when masked). When revealed, PAN stays
                 * on top and expiry + CVV sit below it. */}
                <div className="mt-auto flex flex-col">
                    {locked ? (
                        <>
                            <span className="text-xl font-extrabold tracking-wider">???? ???? ???? ????</span>
                            <div className="mt-1 flex items-end justify-between gap-6 text-xs">
                                <div>
                                    <div className="opacity-70">Peanut Pioneer</div>
                                    <div className="font-bold">????</div>
                                </div>
                                <div>
                                    <div className="opacity-70">Valid</div>
                                    <div className="font-bold">??/??</div>
                                </div>
                            </div>
                        </>
                    ) : showingDetails ? (
                        // Fields are real readOnly <input>s (via CardDetailField) inside a
                        // <form> so password managers recognise the card and offer to save
                        // it. `contents` keeps the form out of the layout box tree, so the
                        // flex layout — and every field's rendered position — is unchanged.
                        <form className="contents" onSubmit={(e) => e.preventDefault()}>
                            <div className="flex items-center gap-2">
                                {/* Copy button stays outside the field so replays still show
                                 * whether the user tapped copy (the field itself is ph-no-capture). */}
                                <CardDetailField
                                    value={formatPan(revealed.pan)}
                                    autoComplete="cc-number"
                                    name="cardnumber"
                                    ariaLabel="Card number"
                                    className="text-xl font-extrabold tracking-wider"
                                />
                                {onCopy && (
                                    <button
                                        type="button"
                                        aria-label="Copy card number"
                                        onClick={() => handleCopy(revealed.pan, 'pan')}
                                        className="p-1"
                                    >
                                        <Icon name={copiedField === 'pan' ? 'check' : 'copy'} size={16} />
                                    </button>
                                )}
                            </div>
                            {/* Registered cardholder name — PII, kept out of session
                             * recordings like the other revealed fields. */}
                            {revealed.cardholderName && (
                                <div className="mt-1">
                                    <CardDetailField
                                        value={revealed.cardholderName}
                                        autoComplete="cc-name"
                                        name="ccname"
                                        ariaLabel="Cardholder name"
                                        className="text-sm font-bold uppercase tracking-wide"
                                    />
                                </div>
                            )}
                            <div className="flex items-end justify-between">
                                <div className="text-s flex gap-6">
                                    <div>
                                        {/* "Expiry" label dropped — value row stays one line so PAN/name clear the artwork */}
                                        <CardDetailField
                                            value={`${String(revealed.expiryMonth).padStart(2, '0')}/${String(
                                                revealed.expiryYear
                                            ).slice(-2)}`}
                                            autoComplete="cc-exp"
                                            name="cc-exp"
                                            ariaLabel="Expiry date"
                                            className="font-bold"
                                        />
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <div>
                                            {/* "CVV" label dropped — value only */}
                                            <CardDetailField
                                                value={revealed.cvv}
                                                autoComplete="cc-csc"
                                                name="cvc"
                                                ariaLabel="Security code"
                                                className="font-bold"
                                            />
                                        </div>
                                        {onCopy && (
                                            <button
                                                type="button"
                                                aria-label="Copy CVV"
                                                onClick={() => handleCopy(revealed.cvv, 'cvv')}
                                                className="p-1"
                                            >
                                                <Icon name={copiedField === 'cvv' ? 'check' : 'copy'} size={14} />
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
                        </form>
                    ) : loading ? (
                        <>
                            <div className="h-7 w-56 animate-pulse rounded bg-white/40" />
                            <div className="mt-2 flex items-end gap-6 text-xs">
                                <div>
                                    {/* label dropped to match the revealed layout — no height jump on reveal */}
                                    <div className="mt-1 h-4 w-12 animate-pulse rounded bg-white/40" />
                                </div>
                                <div>
                                    {/* label dropped to match the revealed layout */}
                                    <div className="mt-1 h-4 w-10 animate-pulse rounded bg-white/40" />
                                </div>
                            </div>
                        </>
                    ) : error ? (
                        <>
                            <span className="text-sm font-bold leading-snug">{error}</span>
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
                                        aria-label="Retry showing card details"
                                        onClick={onToggleReveal}
                                        className="p-1"
                                    >
                                        <Icon name="eye" size={22} />
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
