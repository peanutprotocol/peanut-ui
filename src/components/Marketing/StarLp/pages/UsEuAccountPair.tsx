import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { UsEuAccountCard } from './UsEuAccountCard'

/** Hero art: the euro and the US account land on top of each other like two stickers. */
export function UsEuAccountPair() {
    return (
        <div className="relative mx-auto h-56 w-full max-w-sm">
            <DropIn fromTilt={14} tilt={3} delay={0.15} className="absolute inset-x-1 top-0">
                <UsEuAccountCard flag="eu" label="EUR account" details="IBAN DE•• •••• •••• 0420" tone="sky" />
            </DropIn>
            <DropIn fromTilt={-12} tilt={-2} delay={0.45} className="absolute inset-x-1 top-24">
                <UsEuAccountCard
                    flag="us"
                    label="USD account"
                    details="Routing ••• 069 · Acct •••• 0420"
                    tone="white"
                />
            </DropIn>
        </div>
    )
}
