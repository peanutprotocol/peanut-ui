'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { resolveLocale, type AppLocale } from '@/i18n/app/config'

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

export default function GoogleWalletButton({ isAdding, onClick }: { isAdding: boolean; onClick: () => void }) {
    const t = useTranslations('card.yourCard')
    const artwork = ARTWORK[resolveLocale(useLocale())]

    return (
        // Vendor branding exception: Google's artwork on Google's pill, full width as in
        // Google's Android codelab. Where the one-line artwork doesn't fit, Google's
        // guidelines call for the two-line badge, which needs >=53dp height.
        <div className="@container w-full">
            <button
                type="button"
                disabled={isAdding}
                aria-busy={isAdding}
                aria-label={t('addToGoogleWallet')}
                onClick={onClick}
                className={`flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-background-google-wallet p-0 ring-1 ring-border-google-wallet ring-inset focus-visible:outline-[3px] focus-visible:outline-action-focus ${artwork.fits.pill}`}
            >
                <Image
                    src={`/wallet/google/one-line/${artwork.file}.svg`}
                    width={artwork.oneLineWidth}
                    height={50}
                    alt=""
                    aria-hidden
                    unoptimized
                    className={`hidden h-full w-auto max-w-none ${artwork.fits.oneLine}`}
                />
                <Image
                    src={`/wallet/google/two-line/${artwork.file}.svg`}
                    width={artwork.twoLineWidth}
                    height={55}
                    alt=""
                    aria-hidden
                    unoptimized
                    className={`block h-full w-auto max-w-none ${artwork.fits.twoLine}`}
                />
            </button>
        </div>
    )
}
