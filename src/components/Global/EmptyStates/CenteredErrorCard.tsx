import { type ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import PeanutMascot from '../PeanutMascot'
import { MASCOT_STATE_CLASS } from '../PeanutMascot/PeanutMascot.consts'

interface CenteredErrorCardProps {
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
}

export default function CenteredErrorCard({ title, description, children }: CenteredErrorCardProps) {
    return (
        <div className="flex w-full flex-col gap-4">
            <PeanutMascot pose="sad" className={`mx-auto max-w-full ${MASCOT_STATE_CLASS}`} />
            <Card className="items-center gap-4 p-6 text-center">
                <IconBubble icon="cancel" color="red" size="m" aria-hidden="true" />
                <div className="space-y-2 w-full min-w-0 wrap-break-word">
                    <h1 className="text-heading-s">{title}</h1>
                    {description && <div className="text-body-m text-foreground-secondary">{description}</div>}
                </div>
                {children}
            </Card>
        </div>
    )
}
