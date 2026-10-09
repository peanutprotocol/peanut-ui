'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { resolveLocale, type AppLocale } from '@/i18n/app/config'

const ARTWORK: Record<AppLocale, { file: string; width: number }> = {
    en: { file: 'en', width: 199 },
    'es-419': { file: 'es-419', width: 239 },
    'es-AR': { file: 'es-419', width: 239 },
    'pt-BR': { file: 'pt-BR', width: 240 },
}

export default function GoogleWalletButton({ isAdding, onClick }: { isAdding: boolean; onClick: () => void }) {
    const t = useTranslations('card.yourCard')
    const artwork = ARTWORK[resolveLocale(useLocale())]

    return (
        // Google's condensed artwork needs >=53dp height and 8dp clear space.
        // Vendor branding exception: use the supplied button, without DS styling.
        <div className="flex justify-center p-2">
            <button
                type="button"
                disabled={isAdding}
                aria-busy={isAdding}
                aria-label={t('addToGoogleWallet')}
                onClick={onClick}
                className="block rounded-full border-0 bg-transparent p-0 focus-visible:outline-[3px] focus-visible:outline-action-focus"
            >
                <Image
                    src={`/wallet/google/${artwork.file}.svg`}
                    width={artwork.width}
                    height={55}
                    alt=""
                    aria-hidden
                    unoptimized
                    className="h-14 w-auto"
                />
            </button>
        </div>
    )
}
