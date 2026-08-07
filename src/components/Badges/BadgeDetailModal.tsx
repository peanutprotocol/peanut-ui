'use client'

import type { StaticImageData } from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import { BadgeImage } from './BadgeImage'
import ShareButton from '../Global/ShareButton'
import { getBadgeShareText } from './badge.utils'
import { useUserStore } from '@/redux/hooks'
import { BASE_URL } from '@/constants/general.consts'

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
    // the sharer's own public profile — showcases their badges + carries the join CTA
    const profileUrl = username ? `${BASE_URL}/${username}` : BASE_URL

    const shareText = getBadgeShareText(code, title, profileUrl, {
        locale,
        localizedFallback: t('shareText', { badge: title, link: profileUrl }),
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
                    onSuccess={onClose}
                    generateText={() => Promise.resolve(shareText)}
                >
                    {t('shareAchievement')}
                </ShareButton>
            }
        />
    )
}
