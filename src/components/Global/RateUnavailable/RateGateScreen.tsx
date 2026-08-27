'use client'

import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import RateUnavailable from '@/components/Global/RateUnavailable'

interface RateGateScreenProps {
    title: string
    onBack: () => void
    isLoading: boolean
    onRetry: () => void
}

/**
 * Full-screen FX-rate gate (dev #2843, ported): keeps the header mounted so
 * back always works while the rate loads, and surfaces the retry when the
 * fetch fails — a bare loader here used to spin forever with no way out
 * (#1848). New component justification: this exact header+centered-gate block
 * was being repeated inline in flow pages, where the page de-inlining ratchet
 * counts it; one shared screen keeps pages composing recipes.
 */
const RateGateScreen = ({ title, onBack, isLoading, onRetry }: RateGateScreenProps) => (
    <div className="flex min-h-[inherit] flex-col gap-8">
        <NavHeader title={title} onPrev={onBack} />
        <div className="my-auto flex flex-col justify-center">
            {isLoading ? <Loading variant="mascot" /> : <RateUnavailable onRetry={onRetry} />}
        </div>
    </div>
)

export default RateGateScreen
