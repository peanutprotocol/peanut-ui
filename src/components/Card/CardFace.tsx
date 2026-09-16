'use client'
import { type FC, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'
import { Button } from '@/components/0_Bruddle/Button'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import CopyToClipboard, { type CopyToClipboardRef } from '@/components/Global/CopyToClipboard'
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
    onToggleReveal?: () => void
    onCopy?: (value: string, field: CopyableCardField) => void
    /** Pre-activation preview: PAN/cardholder/expiry rendered as `?`s.
     *  Used on AddCardEntryScreen before KYC + first spend. */
    locked?: boolean
    className?: string
}

export type CopyableCardField = 'pan' | 'expiry' | 'cvv'

interface CardCopyButtonProps {
    value: string
    ariaLabel: string
    onCopy: () => void
}

const CardCopyButton: FC<CardCopyButtonProps> = ({ value, ariaLabel, onCopy }) => {
    const copyRef = useRef<CopyToClipboardRef>(null)

    return (
        <Button
            type="button"
            variant="transparent"
            aria-label={ariaLabel}
            onClick={() => copyRef.current?.copy()}
            disableHaptics
            className="relative size-4 min-h-0 w-4 shrink-0 p-0 after:absolute after:-inset-4"
        >
            <CopyToClipboard
                ref={copyRef}
                type="icon"
                textToCopy={value}
                iconSize="4"
                interactive={false}
                onCopy={onCopy}
            />
        </Button>
    )
}

const formatPan = (pan: string) => pan.replace(/(.{4})/g, '$1 ').trim()
const formatExpiry = (month: number, year: number) => `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`

const CardFace: FC<Props> = ({
    last4,
    isVirtual = true,
    isLocked = false,
    revealed,
    loading = false,
    onToggleReveal,
    onCopy,
    locked = false,
    className,
}) => {
    const t = useTranslations('card.face')
    const showingDetails = revealed != null
    // The hand slides out of the way while details are shown OR being fetched,
    // so it never covers the PAN / expiry / CVV (or the loading skeletons).
    // It slides back when the card is re-masked.
    const detailsShown = showingDetails || loading

    return (
        <div
            className={twMerge(
                // iso/iec 7810 id-1 card ratio. rounded-card is the
                // physical-card geometry token (12px), intentionally off the
                // ds radius scale — same exemption class as the aspect ratio
                // (visual-qa verdict ui#3201).
                'relative aspect-[1.586/1] w-full overflow-hidden rounded-card bg-action-primary text-foreground-primary',
                isLocked && 'grayscale',
                className
            )}
        >
            {/* issued artwork uses 90% of the card height */}
            <Image
                src={PEANUT_CARD_HAND}
                alt=""
                aria-hidden
                className={twMerge(
                    'pointer-events-none absolute right-0 bottom-0 h-[90%] w-auto transition-transform duration-slow select-none',
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
                        {/* Card-tier brand lockup, not copy — stays English in every locale. */}
                        <span className="mt-0.5 text-label-m tracking-wide">{'Platinum'}</span>
                    </div>
                </div>

                {/* Bottom block — PAN sits at the very bottom (in the slot the
                 * Virtual pill occupies when masked). When revealed, PAN stays
                 * on top and expiry + CVV sit below it. */}
                <div className="mt-auto flex flex-col">
                    {locked ? (
                        <>
                            <span className="text-heading-xs tracking-wider">???? ???? ???? ????</span>
                            <div className="mt-1 flex items-end justify-between gap-6 text-body-xs">
                                <div>
                                    <div className="opacity-70">{t('cardholder')}</div>
                                    <div className="text-body-s-semibold">????</div>
                                </div>
                                <div>
                                    <div className="opacity-70">{t('valid')}</div>
                                    <div className="text-body-s-semibold">??/??</div>
                                </div>
                            </div>
                        </>
                    ) : showingDetails ? (
                        <>
                            <div className="flex items-center gap-2">
                                {/* ph-no-capture: PAN out of session recordings. Wraps only
                                 * the digits, not the copy button — we still want to see in
                                 * replays whether the user tapped copy. */}
                                <span className="ph-no-capture text-heading-xs tracking-wider">
                                    {formatPan(revealed.pan)}
                                </span>
                                {onCopy && (
                                    <CardCopyButton
                                        value={revealed.pan}
                                        ariaLabel={t('copyCardNumber')}
                                        onCopy={() => onCopy(revealed.pan, 'pan')}
                                    />
                                )}
                            </div>
                            {/* Registered cardholder name — PII, kept out of session
                             * recordings like the other revealed fields. */}
                            {revealed.cardholderName && (
                                <span className="ph-no-capture mt-1 text-body-s-semibold tracking-wide uppercase">
                                    {revealed.cardholderName}
                                </span>
                            )}
                            <div className="flex items-end justify-between">
                                <div className="flex gap-6 text-body-s">
                                    <div className="flex items-end gap-1">
                                        <div>
                                            {/* "Expiry" label dropped — value row stays one line so PAN/name clear the artwork */}
                                            {/* ph-no-capture: expiry digits out of recordings. */}
                                            <div className="ph-no-capture text-body-s-semibold">
                                                {formatExpiry(revealed.expiryMonth, revealed.expiryYear)}
                                            </div>
                                        </div>
                                        {onCopy && (
                                            <CardCopyButton
                                                value={formatExpiry(revealed.expiryMonth, revealed.expiryYear)}
                                                ariaLabel={t('copyExpiry')}
                                                onCopy={() =>
                                                    onCopy(
                                                        formatExpiry(revealed.expiryMonth, revealed.expiryYear),
                                                        'expiry'
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <div>
                                            {/* "CVV" label dropped — value only */}
                                            {/* ph-no-capture: CVV out of recordings. */}
                                            <div className="ph-no-capture text-body-s-semibold">{revealed.cvv}</div>
                                        </div>
                                        {onCopy && (
                                            <CardCopyButton
                                                value={revealed.cvv}
                                                ariaLabel={t('copyCvv')}
                                                onCopy={() => onCopy(revealed.cvv, 'cvv')}
                                            />
                                        )}
                                    </div>
                                </div>
                                {onToggleReveal && (
                                    <Button
                                        type="button"
                                        variant="transparent"
                                        size="small"
                                        shape="square"
                                        aria-label={t('hideDetails')}
                                        onClick={onToggleReveal}
                                        icon="eye-slash"
                                        iconSize={20}
                                        className="w-10 shrink-0"
                                    />
                                )}
                            </div>
                        </>
                    ) : loading ? (
                        <>
                            <div className="h-7 w-56 animate-pulse rounded bg-foreground-primary/10" />
                            <div className="mt-2 flex items-end gap-6 text-body-xs">
                                <div>
                                    {/* label dropped to match the revealed layout — no height jump on reveal */}
                                    <div className="mt-1 h-4 w-12 animate-pulse rounded bg-foreground-primary/10" />
                                </div>
                                <div>
                                    {/* label dropped to match the revealed layout */}
                                    <div className="mt-1 h-4 w-10 animate-pulse rounded bg-foreground-primary/10" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Eye sits inline with the number — the bottom-right corner
                             * is where the hand's arm rests when masked, so the reveal
                             * toggle lives in the hand-free left zone instead. */}
                            <div className="flex items-center gap-3">
                                <span className="text-heading-s tracking-wider">•••• {last4}</span>
                                {onToggleReveal && (
                                    <Button
                                        type="button"
                                        variant="transparent"
                                        size="small"
                                        shape="square"
                                        aria-label={t('showDetails')}
                                        onClick={onToggleReveal}
                                        icon="eye"
                                        iconSize={20}
                                        className="w-10 shrink-0"
                                    />
                                )}
                            </div>
                            {isVirtual && (
                                <div className="mt-1">
                                    <StatusBadge status="custom" customText={t('virtual')} />
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
