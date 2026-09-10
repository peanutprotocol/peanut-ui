'use client'

import type { StaticImageData } from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { BadgeImage } from './BadgeImage'
import ShareButton from '../Global/ShareButton'
import { captureBadgeShare, getBadgeShareLink, getBadgeShareText } from './badge.utils'
import { useBadgeShareImpression } from './useBadgeShareImpression'
import { useAuth } from '@/context/authContext'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'

type BadgeDetailDrawerProps = {
    isOpen: boolean
    onClose: () => void
    code?: string
    title: string
    description: string
    logo: string | StaticImageData
}

// Shared by the badges list and the badge-unlock drawer (which closes itself
// before opening this, so the two sheets never stack). The primary action
// shares the badge; swipe / hardware back / overlay dismiss.
export const BadgeDetailDrawer = ({ isOpen, onClose, code, title, description, logo }: BadgeDetailDrawerProps) => {
    const t = useTranslations('badges')
    const locale = useLocale()
    const { user: authUser } = useAuth()
    const username = authUser?.user?.username
    // the sharer's own invite link, so a guest signup credits them
    const shareLink = getBadgeShareLink(username)
    useBadgeShareImpression(isOpen, REFERRAL_SOURCES.BADGE_DETAIL, username)

    const shareText = getBadgeShareText(code, title, shareLink, {
        locale,
        localizedFallback: t('shareText', { badge: title, link: shareLink }),
    })

    return (
        <Drawer
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        {/* the DS hero slot: l bubble, logo fill — the badge art IS the mark */}
                        <IconBubble
                            size="l"
                            color="logo"
                            icon={
                                <BadgeImage
                                    height={100}
                                    width={100}
                                    src={logo}
                                    alt={title}
                                    className="size-full object-contain"
                                    unoptimized
                                />
                            }
                        />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{title}</DrawerTitle>
                            <DrawerDescription>{description}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <ShareButton
                        title=""
                        className="w-full"
                        onSuccess={() => {
                            captureBadgeShare(REFERRAL_SOURCES.BADGE_DETAIL, username)
                            onClose()
                        }}
                        generateText={() => Promise.resolve(shareText)}
                    >
                        {t('shareAchievement')}
                    </ShareButton>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
