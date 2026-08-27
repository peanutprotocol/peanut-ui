import { Icon } from '@/components/Global/Icons/Icon'

interface DoDontProps {
    doExample: React.ReactNode
    doLabel?: string
    dontExample: React.ReactNode
    dontLabel?: string
}

export function DoDont({ doExample, doLabel = 'Do', dontExample, dontLabel = "Don't" }: DoDontProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <div className="rounded-sm border-2 border-background-icon-bubble-green bg-background-default p-4">
                    {doExample}
                </div>
                <div className="mt-2 flex items-center gap-1">
                    <div className="flex size-5 items-center justify-center rounded-round bg-background-icon-bubble-green">
                        <Icon name="check" size={12} className="text-foreground-inverse" />
                    </div>
                    <span className="text-label-l">{doLabel}</span>
                </div>
            </div>
            <div>
                <div className="rounded-sm border-2 border-background-icon-bubble-red bg-background-default p-4">
                    {dontExample}
                </div>
                <div className="mt-2 flex items-center gap-1">
                    <div className="flex size-5 items-center justify-center rounded-round bg-background-icon-bubble-red">
                        <Icon name="cancel" size={12} className="text-foreground-inverse" />
                    </div>
                    <span className="text-label-l">{dontLabel}</span>
                </div>
            </div>
        </div>
    )
}
