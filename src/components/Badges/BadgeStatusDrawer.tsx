import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { useState } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Card from '../Global/Card'
import { PaymentInfoRow } from '../Payment/PaymentInfoRow'
import ShareButton from '../Global/ShareButton'
import { BadgeDetailModal } from './BadgeDetailModal'
import {
    captureBadgeShare,
    getBadgeDescription,
    getBadgeDisplayName,
    getBadgeIcon,
    getBadgeShareLink,
    getBadgeShareText,
} from './badge.utils'
import { useBadgeShareImpression } from './useBadgeShareImpression'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { BadgeImage } from './BadgeImage'

export type BadgeStatusDrawerProps = {
    isOpen: boolean
    onClose: () => void
    badge: {
        code: string
        name: string
        description?: string | null
        iconUrl?: string | null
        earnedAt?: string | Date
    }
}

// shows a drawer for a newly unlocked badge
export const BadgeStatusDrawer = ({ isOpen, onClose, badge }: BadgeStatusDrawerProps) => {
    const t = useTranslations('badges')
    const locale = useLocale()
    const format = useFormatter()
    const { user: authUser } = useAuth()
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const username = authUser?.user.username
    const earnedAt = badge.earnedAt ? new Date(badge.earnedAt) : undefined
    const dateStr =
        earnedAt && !isNaN(earnedAt.getTime())
            ? format.dateTime(earnedAt, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
              })
            : undefined
    const displayName = getBadgeDisplayName(badge.code, badge.name)
    const displayDescription = getBadgeDescription(badge.description)
    const displayIcon = getBadgeIcon(badge.code, badge.iconUrl)

    // the sharer's own invite link, so a guest signup credits them
    const shareLink = getBadgeShareLink(username)
    useBadgeShareImpression(isOpen, REFERRAL_SOURCES.BADGE_UNLOCK, username)

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="py-5">
                    <div className="space-y-5 p-5">
                        <Card
                            className="relative cursor-pointer p-4 md:p-6"
                            position="single"
                            // close the unlock drawer (z-50) before opening the
                            // detail modal (z-20) so the modal isn't occluded.
                            onClick={() => {
                                onClose()
                                setIsDetailOpen(true)
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full">
                                    <BadgeImage
                                        src={displayIcon}
                                        alt={t('iconAlt', { name: displayName })}
                                        className="size-full object-contain"
                                        width={160}
                                        height={160}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <h2 className="flex items-center gap-2 text-xs font-medium text-grey-1">
                                        {t('unlocked')}
                                    </h2>
                                    <DrawerTitle className="text-lg font-extrabold md:text-4xl">
                                        {displayName}
                                    </DrawerTitle>
                                </div>
                            </div>
                        </Card>

                        <Card position="single">
                            <PaymentInfoRow label={t('unlockedAtLabel')} value={dateStr} />
                            <PaymentInfoRow label={t('reasonLabel')} value={displayDescription} hideBottomBorder />
                        </Card>

                        <div className="pb-4">
                            <ShareButton
                                title=""
                                onSuccess={() => captureBadgeShare(REFERRAL_SOURCES.BADGE_UNLOCK, username)}
                                generateText={() =>
                                    Promise.resolve(
                                        getBadgeShareText(badge.code, displayName, shareLink, {
                                            locale,
                                            localizedFallback: t('shareText', {
                                                badge: displayName,
                                                link: shareLink,
                                            }),
                                        })
                                    )
                                }
                            >
                                {t('shareAchievement')}
                            </ShareButton>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
            <BadgeDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                code={badge.code}
                title={displayName}
                description={displayDescription || ''}
                logo={displayIcon}
            />
        </>
    )
}
