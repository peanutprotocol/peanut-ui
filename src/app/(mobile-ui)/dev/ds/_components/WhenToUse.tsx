import { Icon } from '@/components/Global/Icons/Icon'

interface WhenToUseProps {
    use: string[]
    dontUse?: string[]
}

export function WhenToUse({ use, dontUse }: WhenToUseProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-sm border border-gray-3 bg-white p-5">
                <h3 className="text-base font-bold">When to use</h3>
                <ul className="mt-3 space-y-2">
                    {use.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-grey-1">
                            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green-1" />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
            {dontUse && (
                <div className="rounded-sm border border-gray-3 bg-white p-5">
                    <h3 className="text-base font-bold">When not to use</h3>
                    <ul className="mt-3 space-y-2">
                        {dontUse.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-grey-1">
                                <Icon name="cancel" size={16} className="mt-0.5 shrink-0 text-error-1" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
