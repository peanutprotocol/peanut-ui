import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import Image from 'next/image'
import { formatDate } from '@/utils/general.utils'
import Card from '../Global/Card'
import { PaymentInfoRow } from '../Payment/PaymentInfoRow'
import ShareButton from '../Global/ShareButton'
import { getBadgeIcon } from './badge.utils'

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
    const earnedAt = badge.earnedAt ? new Date(badge.earnedAt) : undefined
    const dateStr = earnedAt ? formatDate(earnedAt) : undefined

    return (
        <Drawer open={isOpen} onOpenChange={onClose}>
            <DrawerContent className="py-5">
                <div className="space-y-5 p-5">
                    <Card className="relative p-4 md:p-6" position="single">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full">
                                <Image
                                    src={getBadgeIcon(badge.code)}
                                    alt="Icon"
                                    className="size-full object-contain"
                                    width={160}
                                    height={160}
                                />
                            </div>

                            <div className="space-y-1">
                                <h2 className="flex items-center gap-2 text-xs font-medium text-grey-1">
                                    Badge unlocked!
                                </h2>
                                <h1 className={`text-lg font-extrabold md:text-4xl`}>{badge.name}</h1>
                            </div>
                        </div>
                    </Card>

                    <Card position="single">
                        <PaymentInfoRow label="Unlocked" value={dateStr} />
                        <PaymentInfoRow label="Reason" value={badge.description} hideBottomBorder />
                    </Card>

                    <div className="pb-4">
                        <ShareButton
                            title=""
                            generateText={() =>
                                Promise.resolve(
                                    `${badge.description}\nI just unlocked a ${badge.name} badge on Peanut!`
                                )
                            }
                        >
                            Share Achievement
                        </ShareButton>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
