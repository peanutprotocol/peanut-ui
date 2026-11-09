'use client'

import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { useTranslations } from 'next-intl'

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
const RateGateScreen = ({ title, onBack, isLoading, onRetry }: RateGateScreenProps) => {
    const t = useTranslations('rateGate')
    const tErrors = useTranslations('errors')
    const tCommon = useTranslations('common')

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center className="gap-4">
                {isLoading ? (
                    <Loading variant="mascot" />
                ) : (
                    <>
                        <CenteredStatusCard
                            title={t('title')}
                            description={<div role="alert">{tErrors('rateUnavailable')}</div>}
                        />
                        <Button variant="primary" shadowSize="4" icon="retry" onClick={onRetry}>
                            {tCommon('retry')}
                        </Button>
                    </>
                )}
            </PageStack.Center>
        </PageStack>
    )
}

export default RateGateScreen
