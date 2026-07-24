'use client'
import { type FC, useState } from 'react'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@/components/Global/Icons/Icon'
import { PEANUT_CARD_HAND, VISA_BRAND_MARK } from '@/assets/cards'
import { PEANUTMAN } from '@/assets/mascot'
import { PEANUT_LOGO_BLACK } from '@/assets/logos'

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
    // The hand slides out of the way while details are shown OR being fetched,
    // so it never covers the PAN / expiry / CVV (or the loading skeletons).
    // It slides back when the card is re-masked.
    const detailsShown = showingDetails || loading
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
            {/* Hand + yellow stripe artwork. Decorative — sits behind content,
             * bottom-anchored to match the finalised Rain card art. On reveal
             * (or while fetching) it slides diagonally off the bottom-right
             * corner so it never covers the card details; slides back when
             * re-masked. pointer-events-none so it never intercepts the eye tap. */}
            <Image
                src={PEANUT_CARD_HAND}
                alt=""
                aria-hidden
                className={twMerge(
                    'pointer-events-none absolute bottom-0 right-0 h-[90%] w-auto select-none transition-transform duration-500',
                    detailsShown && 'translate-x-full translate-y-full'
                )}
                priority
            />

            <div className="relative flex h-full w-full flex-col p-4">
                {/* Top row: peanut mascot + wordmark (left) + Visa Platinum (right).
                 * Matches the finalised Rain card art (Apple Wallet): yellow mascot +
                 * black PEANUT wordmark (PEANUT_LOGO_BLACK is the text-only black
                 * variant; PEANUT_LOGO bakes in a white wordmark for dark bgs) and a
                 * dark VISA with a "Platinum" tier line — not the old inverted-white
                 * Visa with no tier. */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <Image src={PEANUTMAN} alt="" aria-hidden className="h-8 w-auto" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut" className="h-3 w-auto" />
                    </div>
                    <div className="flex flex-col items-end leading-none">
                        <Image src={VISA_BRAND_MARK} alt="Visa" className="h-6 w-auto brightness-0" />
                        <span className="mt-0.5 text-[11px] font-semibold tracking-wide">Platinum</span>
                    </div>
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
                        <>
                            <div className="flex items-center gap-2">
                                {/* ph-no-capture: PAN out of session recordings. Wraps only
                                 * the digits, not the copy button — we still want to see in
                                 * replays whether the user tapped copy. */}
                                <span className="ph-no-capture text-xl font-extrabold tracking-wider">
                                    {formatPan(revealed.pan)}
                                </span>
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
                                <span className="ph-no-capture mt-1 text-sm font-bold uppercase tracking-wide">
                                    {revealed.cardholderName}
                                </span>
                            )}
                            <div className="flex items-end justify-between">
                                <div className="text-s flex gap-6">
                                    <div>
                                        {/* "Expiry" label dropped — value row stays one line so PAN/name clear the artwork */}
                                        {/* ph-no-capture: expiry digits out of recordings. */}
                                        <div className="ph-no-capture font-bold">
                                            {String(revealed.expiryMonth).padStart(2, '0')}/
                                            {String(revealed.expiryYear).slice(-2)}
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <div>
                                            {/* "CVV" label dropped — value only */}
                                            {/* ph-no-capture: CVV out of recordings. */}
                                            <div className="ph-no-capture font-bold">{revealed.cvv}</div>
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
                        </>
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
                            {/* Retry eye inline with the message — hand is still present
                             * in the error state, so keep the control in the left zone. */}
                            <div className="flex items-start gap-3">
                                <span className="text-sm font-bold leading-snug">{error}</span>
                                {onToggleReveal && (
                                    <button
                                        type="button"
                                        aria-label="Retry showing card details"
                                        onClick={onToggleReveal}
                                        className="shrink-0 p-1"
                                    >
                                        <Icon name="eye" size={22} />
                                    </button>
                                )}
                            </div>
                            {isVirtual && (
                                <div className="mt-1">
                                    <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold">
                                        Virtual
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Eye sits inline with the number — the bottom-right corner
                             * is where the hand's arm rests when masked, so the reveal
                             * toggle lives in the hand-free left zone instead. */}
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-extrabold tracking-wider">•••• {last4}</span>
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
                            {isVirtual && (
                                <div className="mt-1">
                                    <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold">
                                        Virtual
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default CardFace
