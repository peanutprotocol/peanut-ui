'use client'

/**
 * A request link (?chargeId=) whose charge asks for a token requests no longer
 * take, such as ETH (TASK-23850). It can't be paid anymore, so the flow stops
 * here instead of opening Confirm. Same centered card as a link that doesn't
 * parse.
 */

import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'

export function SemanticRequestUnpayableView() {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')

    return (
        <PageStack>
            <NavHeader title={t('headers.pay')} onPrev={onBack} />
            <div className="flex flex-grow flex-col justify-center py-8">
                <EmptyState
                    icon="link"
                    title={t('errors.invalidPaymentUrlTitle')}
                    description={t('errors.requestTokenRetired')}
                />
            </div>
        </PageStack>
    )
}
