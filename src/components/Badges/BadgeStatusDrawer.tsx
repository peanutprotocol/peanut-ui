import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { useState } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Card from '../Global/Card'
import { PaymentInfoRow } from '../Payment/PaymentInfoRow'
import ShareButton from '../Global/ShareButton'
import { BadgeDetailModal } from './BadgeDetailModal'
import { captureBadgeShare, getBadgeIcon, getBadgeShareLink, getBadgeShareText } from './badge.utils'
import { useBadgeCopy } from './useBadgeCopy'
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
    const badgeCopy = useBadgeCopy()
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
    const { name: displayName, description: displayDescription } = badgeCopy(badge.code, badge.name, badge.description)
    const displayIcon = getBadgeIcon(badge.code, badge.iconUrl)

    // the sharer's own invite link, so a guest signup credits them
    const shareLink = getBadgeShareLink(username)
    useBadgeShareImpression(isOpen, REFERRAL_SOURCES.BADGE_UNLOCK, username)

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="py-4">
                    <div className="space-y-4 p-4">
                        {/* centered head per the TX Details chrome (board 17490:115877):
                            badge art → type line → title. Tapping it opens the detail
                            modal — close the unlock drawer (z-50) first so the modal
                            (z-20) isn't occluded. */}
                        <button
                            type="button"
                            className="flex w-full cursor-pointer flex-col items-center gap-4 text-center"
                            onClick={() => {
                                onClose()
                                setIsDetailOpen(true)
                            }}
                        >
                            <div className="flex size-16 items-center justify-center rounded-full">
                                <BadgeImage
                                    src={displayIcon}
                                    alt={t('iconAlt', { name: displayName })}
                                    className="size-full object-contain"
                                    width={160}
                                    height={160}
                                />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <h2 className="text-body-s text-foreground-secondary">{t('unlocked')}</h2>
                                <DrawerTitle className="text-heading-s text-foreground-primary">
                                    {displayName}
                                </DrawerTitle>
                            </div>
                        </button>

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
