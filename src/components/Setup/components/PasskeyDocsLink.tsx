'use client'

import { useTranslations } from 'next-intl'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import { twMerge } from '@/utils/tw'

/** "Learn more about passkeys": opens the passkeys help doc in the in-app drawer (test-transaction receipts). */
export const PasskeyDocsLink = ({ className }: { className?: string }) => {
    const t = useTranslations('setup')
    return (
        <p
            // ds text tokens stay outside twMerge — unconfigured twMerge groups
            // them as colors and deletes the size (see LinkButton.tsx:40)
            className={`text-body-xs text-foreground-secondary ${twMerge('border-t border-border-subtle pt-2 text-center', className)}`}
        >
            <SetupDocLink kind="passkeys" href="/en/help/passkeys" className={LINK_BUTTON_CLASSES}>
                <Icon name="info" size={16} className="shrink-0" />
                {t('passkey.learnMore')}
            </SetupDocLink>{' '}
        </p>
    )
}
