import { Card } from '@/components/0_Bruddle/Card'
import { BulletList } from '@/components/0_Bruddle/BulletList'

interface WhenToUseProps {
    use: string[]
    dontUse?: string[]
}

// dogfood: the two advice wells are DS Cards (quiet border variant)
export function WhenToUse({ use, dontUse }: WhenToUseProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-border-disabled p-4">
                <h3 className="text-body-m-semibold">When to use</h3>
                <BulletList items={use} className="mt-3" />
            </Card>
            {dontUse && (
                <Card className="border-border-disabled p-4">
                    <h3 className="text-body-m-semibold">When not to use</h3>
                    <BulletList items={dontUse} className="mt-3" />
                </Card>
            )}
        </div>
    )
}
