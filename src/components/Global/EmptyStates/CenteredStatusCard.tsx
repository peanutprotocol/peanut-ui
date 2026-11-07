import { type ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { type IconName } from '../Icons/Icon'
import PeanutMascot from '../PeanutMascot'
import { MASCOT_STATE_CLASS } from '../PeanutMascot/PeanutMascot.consts'
import { type MascotPose } from '../PeanutMascot/PeanutMascot.types'

type StatusTone = 'error' | 'warning' | 'success' | 'neutral'

const STATUS_STYLES: Record<StatusTone, { pose: MascotPose; icon: IconName; color: IconBubbleColor }> = {
    error: { pose: 'sad', icon: 'cancel', color: 'red' },
    warning: { pose: 'worried', icon: 'alert', color: 'yellow' },
    success: { pose: 'pointing', icon: 'check', color: 'green' },
    neutral: { pose: 'worried', icon: 'info', color: 'gray' },
}

interface CenteredStatusCardProps {
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    tone?: StatusTone
    pose?: MascotPose
}

export default function CenteredStatusCard({
    title,
    description,
    children,
    tone = 'error',
    pose,
}: CenteredStatusCardProps) {
    const status = STATUS_STYLES[tone]
    return (
        <div className="flex w-full flex-col gap-4">
            <PeanutMascot pose={pose ?? status.pose} className={`mx-auto max-w-full ${MASCOT_STATE_CLASS}`} />
            <Card className="items-center gap-4 p-6 text-center">
                <IconBubble icon={status.icon} color={status.color} size="m" aria-hidden="true" />
                <div className="space-y-2 w-full min-w-0 wrap-break-word">
                    <h1 className="text-heading-s">{title}</h1>
                    {description && <div className="text-body-m text-foreground-secondary">{description}</div>}
                </div>
                {children}
            </Card>
        </div>
    )
}
