'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { resolveLocale, type AppLocale } from '@/i18n/app/config'
import { useAppHaptic } from '@/hooks/useAppHaptic'

// Google's one-line artwork, drawn 50 units high with Google's side padding.
const ARTWORK: Record<AppLocale, { file: string; width: number }> = {
    en: { file: 'en', width: 283 },
    'es-419': { file: 'es-419', width: 378 },
    'es-AR': { file: 'es-419', width: 378 },
    'pt-BR': { file: 'pt-BR', width: 372 },
}

export default function GoogleWalletButton({ isAdding, onClick }: { isAdding: boolean; onClick: () => void }) {
    const t = useTranslations('card.yourCard')
    const artwork = ARTWORK[resolveLocale(useLocale())]
    const { triggerHaptic } = useAppHaptic()

    return (
        // Vendor branding exception: Google's one-line artwork on Google's pill, full width
        // as in Google's Android codelab, at Google's 48dp minimum in every language. The
        // artwork shrinks to fit a narrower pill rather than switching to the taller badge.
        // Pressed moves the whole pill 1px down-right and leaves the artwork as Google
        // drew it; it stays pressed while the add is in flight.
        <button
            type="button"
            disabled={isAdding}
            aria-busy={isAdding}
            aria-label={t('addToGoogleWallet')}
            onClick={() => {
                triggerHaptic()
                onClick()
            }}
            className="flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-background-google-wallet p-0 ring-1 ring-border-google-wallet transition-all duration-instant ring-inset focus-visible:outline-[3px] focus-visible:outline-action-focus active:translate-x-px active:translate-y-px aria-busy:translate-x-px aria-busy:translate-y-px"
        >
            <Image
                src={`/wallet/google/one-line/${artwork.file}.svg`}
                width={artwork.width}
                height={50}
                alt=""
                aria-hidden
                unoptimized
                className="block h-full w-full object-contain"
            />
        </button>
    )
}
