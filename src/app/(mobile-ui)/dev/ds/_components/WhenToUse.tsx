import { Icon } from '@/components/Global/Icons/Icon'

interface WhenToUseProps {
    use: string[]
    dontUse?: string[]
}

export function WhenToUse({ use, dontUse }: WhenToUseProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-sm border border-border-disabled bg-background-default p-4">
                <h3 className="text-body-m-semibold">When to use</h3>
                <ul className="space-y-2 mt-3">
                    {use.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-body-s text-foreground-secondary">
                            <Icon
                                name="check"
                                size={16}
                                className="mt-0.5 shrink-0 text-background-icon-bubble-green"
                            />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
            {dontUse && (
                <div className="rounded-sm border border-border-disabled bg-background-default p-4">
                    <h3 className="text-body-m-semibold">When not to use</h3>
                    <ul className="space-y-2 mt-3">
                        {dontUse.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-body-s text-foreground-secondary">
                                <Icon
                                    name="cancel"
                                    size={16}
                                    className="mt-0.5 shrink-0 text-background-icon-bubble-red"
                                />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
