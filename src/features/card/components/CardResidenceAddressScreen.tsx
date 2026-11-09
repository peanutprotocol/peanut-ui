import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import type { ResidenceAddressEntry } from '@/features/kyc-features/residenceAddressEntry'

export function CardResidenceAddressScreen({
    state,
    loading,
    error,
    onStart,
    onRefresh,
    onBack,
}: {
    state: ResidenceAddressEntry
    loading: boolean
    error?: string | null
    onStart: () => void
    onRefresh: () => void
    onBack: () => void
}) {
    const t = useTranslations('card')
    const common = useTranslations('common')
    const bank = useTranslations('depositAccounts.gate')
    const waiting = state === 'in_review' || state === 'unavailable'
    return (
        <PageStack gap="6">
            <NavHeader title={t('navAddCard')} onPrev={onBack} />
            <CenteredStatusCard
                tone="neutral"
                title={
                    state === 'unavailable'
                        ? t('page.loadFailed')
                        : bank(
                              state === 'in_review'
                                  ? 'addressReviewTitle'
                                  : state === 'rejected'
                                    ? 'addressRetryTitle'
                                    : 'addressTitle'
                          )
                }
                description={t(`addressStep.${state}`)}
            >
                {error && <Callout priority="error">{error}</Callout>}
                <Button className="w-full" variant="primary" loading={loading} onClick={waiting ? onRefresh : onStart}>
                    {waiting ? common('retry') : bank(state === 'rejected' ? 'addressRetryCta' : 'addressCta')}
                </Button>
            </CenteredStatusCard>
        </PageStack>
    )
}
