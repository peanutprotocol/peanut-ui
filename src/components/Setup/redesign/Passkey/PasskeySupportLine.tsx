'use client'

import { useTranslations } from 'next-intl'

const SUPPORT_URL = 'https://peanut.me/support'

/** "Still stuck? Contact support" under the buttons of a failure screen; the link opens peanut.me/support. */
export function PasskeySupportLine({ onSupport }: { onSupport: () => void }) {
    const t = useTranslations('setupRedesign.common')
    return (
        <span>
            {t.rich('support', {
                link: (chunks) => (
                    <a
                        href={SUPPORT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onSupport}
                        className="relative underline after:absolute after:inset-x-0 after:-inset-y-3.5"
                    >
                        {chunks}
                    </a>
                ),
            })}
        </span>
    )
}
