'use client'

import Image from 'next/image'
import { useRef, type PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { resolveLocale, type AppLocale } from '@/i18n/app/config'
import { useAppHaptic } from '@/hooks/useAppHaptic'

// Artwork provenance and Google's branding rules:
// https://github.com/peanutprotocol/mono/blob/main/engineering/ui/wallet-brand-assets.md
type Artwork = {
    file: string
    oneLineWidth: number
    twoLineWidth: number
    // Container-query classes that switch to the one-line artwork once the pill
    // is at least its drawn width at 48px. Literals, so Tailwind generates them.
    fits: { pill: string; oneLine: string; twoLine: string }
}

const ARTWORK: Record<AppLocale, Artwork> = {
    en: {
        file: 'en',
        oneLineWidth: 283,
        twoLineWidth: 199,
        fits: { pill: '@min-[272px]:h-12', oneLine: '@min-[272px]:block', twoLine: '@min-[272px]:hidden' },
    },
    'es-419': {
        file: 'es-419',
        oneLineWidth: 378,
        twoLineWidth: 239,
        fits: { pill: '@min-[363px]:h-12', oneLine: '@min-[363px]:block', twoLine: '@min-[363px]:hidden' },
    },
    'es-AR': {
        file: 'es-419',
        oneLineWidth: 378,
        twoLineWidth: 239,
        fits: { pill: '@min-[363px]:h-12', oneLine: '@min-[363px]:block', twoLine: '@min-[363px]:hidden' },
    },
    'pt-BR': {
        file: 'pt-BR',
        oneLineWidth: 372,
        twoLineWidth: 240,
        fits: { pill: '@min-[358px]:h-12', oneLine: '@min-[358px]:block', twoLine: '@min-[358px]:hidden' },
    },
}

const RIPPLE_OPACITY = 0.24
const RIPPLE_GROW_MS = 300
const RIPPLE_FADE_MS = 200
const RIPPLE_EASING = 'cubic-bezier(0.2, 0, 0, 1)'

// Material's touch ripple, as on Google's own Android wallet button: it spreads
// from the touch point and finishes after a quick tap, so the press always shows.
function startRipple(event: PointerEvent<HTMLButtonElement>, host: HTMLSpanElement) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
    const wave = document.createElement('span')
    wave.className = 'absolute rounded-full bg-background-google-wallet-ripple'
    Object.assign(wave.style, {
        left: `${x - radius}px`,
        top: `${y - radius}px`,
        width: `${radius * 2}px`,
        height: `${radius * 2}px`,
        opacity: '0',
    })
    if (typeof wave.animate !== 'function') return
    host.appendChild(wave)
    const grow = wave.animate(
        [
            { transform: 'scale(0.1)', opacity: RIPPLE_OPACITY },
            { transform: 'scale(1)', opacity: RIPPLE_OPACITY },
        ],
        { duration: RIPPLE_GROW_MS, easing: RIPPLE_EASING, fill: 'forwards' }
    )
    const target = event.currentTarget
    const releaseTypes = ['pointerup', 'pointercancel', 'pointerleave'] as const
    const release = () => {
        releaseTypes.forEach((type) => target.removeEventListener(type, release))
        void grow.finished
            .then(
                () =>
                    wave.animate([{ opacity: RIPPLE_OPACITY }, { opacity: 0 }], {
                        duration: RIPPLE_FADE_MS,
                        fill: 'forwards',
                    }).finished
            )
            .catch(() => undefined)
            .finally(() => wave.remove())
    }
    releaseTypes.forEach((type) => target.addEventListener(type, release))
}

export default function GoogleWalletButton({ isAdding, onClick }: { isAdding: boolean; onClick: () => void }) {
    const t = useTranslations('card.yourCard')
    const artwork = ARTWORK[resolveLocale(useLocale())]
    const { triggerHaptic } = useAppHaptic()
    const reducedMotion = useReducedMotion()
    const rippleHost = useRef<HTMLSpanElement>(null)

    return (
        // Vendor branding exception: Google's artwork on Google's pill, full width as in
        // Google's Android codelab. Where the one-line artwork doesn't fit, Google's
        // guidelines call for the two-line badge, which needs >=53dp height. Shadowless,
        // so pressing never moves it (design.md law 7): a touch ripple and Google's
        // pressed state layer show the press, and the fill holds it while the add runs.
        <div className="@container w-full">
            <button
                type="button"
                disabled={isAdding}
                aria-busy={isAdding}
                aria-label={t('addToGoogleWallet')}
                onPointerDown={(event) => {
                    if (!reducedMotion && !isAdding && !event.button && rippleHost.current) {
                        startRipple(event, rippleHost.current)
                    }
                }}
                onClick={() => {
                    triggerHaptic()
                    onClick()
                }}
                className={`relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-background-google-wallet p-0 ring-1 ring-border-google-wallet transition-colors duration-instant ring-inset focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-google-wallet-press aria-busy:bg-background-google-wallet-press ${artwork.fits.pill}`}
            >
                <span ref={rippleHost} aria-hidden className="pointer-events-none absolute inset-0" />
                <Image
                    src={`/wallet/google/one-line/${artwork.file}.svg`}
                    width={artwork.oneLineWidth}
                    height={50}
                    alt=""
                    aria-hidden
                    unoptimized
                    className={`relative hidden h-full w-auto max-w-none ${artwork.fits.oneLine}`}
                />
                <Image
                    src={`/wallet/google/two-line/${artwork.file}.svg`}
                    width={artwork.twoLineWidth}
                    height={55}
                    alt=""
                    aria-hidden
                    unoptimized
                    className={`relative block h-full w-auto max-w-none ${artwork.fits.twoLine}`}
                />
            </button>
        </div>
    )
}
