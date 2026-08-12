'use client'

import { useEffect } from 'react'
import type { StaticImageData } from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import { BadgeImage } from './BadgeImage'
import ShareButton from '../Global/ShareButton'
import { captureBadgeShare, captureBadgeShareShown, getBadgeShareLink, getBadgeShareText } from './badge.utils'
import { useUserStore } from '@/redux/hooks'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'

type BadgeDetailModalProps = {
    isOpen: boolean
    onClose: () => void
    code?: string
    title: string
    description: string
    logo: string | StaticImageData
}

// Shared by the badges list and the badge-unlock drawer. The primary action
// shares the badge, while the top-right close button remains the dismiss action.
export const BadgeDetailModal = ({ isOpen, onClose, code, title, description, logo }: BadgeDetailModalProps) => {
    const t = useTranslations('badges')
    const locale = useLocale()
    const { user: authUser } = useUserStore()
    const username = authUser?.user?.username
    // the sharer's own invite link, so a guest signup credits them (rationale
    // + null handling live on the helper in badge.utils).
    const shareLink = getBadgeShareLink(username)

    // Impression leg: every open is a genuine exposure of the share CTA, so
    // the badge funnel divides by real impressions like every other source.
    useEffect(() => {
        if (isOpen) captureBadgeShareShown(REFERRAL_SOURCES.BADGE_DETAIL, shareLink)
    }, [isOpen, shareLink])

    const shareText = getBadgeShareText(code, title, shareLink, {
        locale,
        localizedFallback: t('shareText', { badge: title, link: shareLink }),
    })

    return (
        <ActionModal
            icon={
                <BadgeImage
                    height={240}
                    width={240}
                    src={logo}
                    alt={title}
                    className="w-60 object-contain"
                    unoptimized
                />
            }
            iconContainerClassName="bg-transparent min-w-60 h-auto"
            modalPanelClassName="m-0"
            visible={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            content={
                <ShareButton
                    title=""
                    className="w-full"
                    onSuccess={() => {
                        captureBadgeShare(REFERRAL_SOURCES.BADGE_DETAIL, shareLink)
                        onClose()
                    }}
                    generateText={() => Promise.resolve(shareText)}
                >
                    {t('shareAchievement')}
                </ShareButton>
            }
        />
    )
}
