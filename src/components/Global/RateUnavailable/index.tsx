'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useTranslations } from 'next-intl'

interface RateUnavailableProps {
    onRetry: () => void
    className?: string
}

/**
 * Recovery affordance for a failed FX-rate fetch. Every flow that prices in a
 * local currency needs one: the rate hook only refetches when the currency code
 * changes, so without a retry the user is stranded until they leave the screen.
 */
const RateUnavailable = ({ onRetry, className }: RateUnavailableProps) => {
    const t = useTranslations('errors')
    const tCommon = useTranslations('common')

    return (
        <div className={className}>
            <ErrorAlert description={t('rateUnavailable')} />
            <Button variant="stroke" shadowSize="4" icon="retry" size="medium" onClick={onRetry} className="mt-4">
                {tCommon('retry')}
            </Button>
        </div>
    )
}

export default RateUnavailable
