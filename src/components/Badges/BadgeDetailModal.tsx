'use client'

import type { StaticImageData } from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import { BadgeImage } from './BadgeImage'
import ShareButton from '../Global/ShareButton'
import { getBadgeShareText } from './badge.utils'
import { useUserStore } from '@/redux/hooks'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { appBaseUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'

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
    // the sharer's own invite link, so a guest signup credits them. A logged-in
    // recipient is redirected to /<username> anyway, so the profile form buys
    // nothing here. `generateInviteCodeLink` has no null guard — keep the ternary.
    const shareLink = username ? generateInviteCodeLink(username).inviteLink : appBaseUrl()

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
                        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                            source: REFERRAL_SOURCES.BADGE_DETAIL,
                            link_type: 'invite_code',
                        })
                        posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, {
                            source: REFERRAL_SOURCES.BADGE_DETAIL,
                            link_type: 'invite_code',
                        })
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
