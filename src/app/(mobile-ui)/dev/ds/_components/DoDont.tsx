import { Icon } from '@/components/Global/Icons/Icon'

interface DoDontProps {
    doExample: React.ReactNode
    doLabel?: string
    dontExample: React.ReactNode
    dontLabel?: string
}

export function DoDont({
    doExample,
    doLabel = 'Do',
    dontExample,
    dontLabel = "Don't",
}: DoDontProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <div className="rounded-sm border-2 border-green-1 bg-white p-4">{doExample}</div>
                <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex size-5 items-center justify-center rounded-full bg-green-1">
                        <Icon name="check" size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-bold">{doLabel}</span>
                </div>
            </div>
            <div>
                <div className="rounded-sm border-2 border-error-1 bg-white p-4">{dontExample}</div>
                <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex size-5 items-center justify-center rounded-full bg-error-1">
                        <Icon name="cancel" size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-bold">{dontLabel}</span>
                </div>
            </div>
        </div>
    )
}
