'use client'

import { useTranslations } from 'next-intl'
import { SETUP_SUPPORT_FALLBACK_URL, useSetupSupportClick } from '@/components/Setup/useSetupSupportClick'

/** "Still stuck? Contact support" under the buttons of a failure screen; opens in-app SupportDrawer when mounted. */
export function PasskeySupportLine({ onSupport }: { onSupport: () => void }) {
    const t = useTranslations('setupRedesign.common')
    const supportLink = useSetupSupportClick({ key: 'setupPasskey' }, onSupport)
    return (
        <span>
            {t.rich('support', {
                link: (chunks) => (
                    <a
                        href={SETUP_SUPPORT_FALLBACK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={supportLink.onClick}
                        className="relative underline after:absolute after:inset-x-0 after:-inset-y-3.5"
                    >
                        {chunks}
                    </a>
                ),
            })}
        </span>
    )
}
