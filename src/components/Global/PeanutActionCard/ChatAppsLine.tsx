import Image from 'next/image'
import { useTranslations } from 'next-intl'
import SOCIALS_ICON from '@/assets/icons/socials.svg'

/**
 * The chat-apps line under a send-link title: three tiny app bubbles and where
 * a link is meant to go. Hugo, 2026-09-25: the send link reads as something to
 * drop into a chat, so the line is back on every send-link card.
 */
export function ChatAppsLine() {
    const t = useTranslations('global.peanutActionCard')
    return (
        <div className="flex items-center justify-center gap-1">
            <Image src={SOCIALS_ICON} alt="" width={32} height={13} />
            <p className="text-body-s text-foreground-secondary">{t('perfectForChats')}</p>
        </div>
    )
}
