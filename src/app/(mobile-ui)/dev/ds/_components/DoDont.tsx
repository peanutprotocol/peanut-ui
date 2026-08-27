import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

interface DoDontProps {
    doExample: React.ReactNode
    doLabel?: string
    dontExample: React.ReactNode
    dontLabel?: string
}

// dogfood: example wells are DS Cards (border recolored to the verdict tone);
// the verdict dots are DS IconBubbles
export function DoDont({ doExample, doLabel = 'Do', dontExample, dontLabel = "Don't" }: DoDontProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <Card className="border-2 border-background-icon-bubble-green p-4">{doExample}</Card>
                <div className="mt-2 flex items-center gap-1">
                    <IconBubble icon="check" size="xs" color="green" iconClassName="text-foreground-inverse" />
                    <span className="text-label-l">{doLabel}</span>
                </div>
            </div>
            <div>
                <Card className="border-2 border-background-icon-bubble-red p-4">{dontExample}</Card>
                <div className="mt-2 flex items-center gap-1">
                    <IconBubble icon="cancel" size="xs" color="red" iconClassName="text-foreground-inverse" />
                    <span className="text-label-l">{dontLabel}</span>
                </div>
            </div>
        </div>
    )
}
