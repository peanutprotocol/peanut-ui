'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import EnableCardPaymentsBanner from '@/components/Card/EnableCardPaymentsBanner'
import HomeCarouselCTA from '@/components/Home/HomeCarouselCTA'
import HomeHistory from '@/components/Home/HomeHistory'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { HomeActionDrawers } from './components/HomeActionDrawers'
import { HomeModals } from './components/HomeModals'
import { useHomeFlow } from './useHomeFlow'
import { BalanceSection } from './views/BalanceSection'
import { HomeTopNav } from './views/HomeTopNav'
import { useHomeViewAnalytics } from './useHomeViewAnalytics'

/**
 * home page (figma board 17830:75689): top nav (menu / rewards), balance
 * block with add-send-request submenu, cta card slot, activity feed.
 *
 * cta surfaces (carousel, activation ctas, card launch, pending verification
 * tasks) are composed as-is — restyling them belongs to the activation
 * project, not the ds rebuild. the unverified "verify" page state renders
 * through ActivationCTAs in the card slot.
 */
export function HomePage() {
    const {
        isPageLoading,
        username,
        isActivated,
        activationStep,
        dismissCardStep,
        spendableBalance,
        isFetchingSpendableBalance,
        isSpendableBalanceStale,
        isBalanceHidden,
        toggleBalanceVisibility,
    } = useHomeFlow()
    useHomeViewAnalytics(isPageLoading)

    if (isPageLoading) {
        return <Loading variant="mascot" coverFullScreen />
    }

    return (
        <PageContainer>
            <div className="flex h-full w-full flex-col gap-6">
                <HomeTopNav showRewards={isActivated} />
                <BalanceSection
                    balance={spendableBalance}
                    isFetching={isFetchingSpendableBalance}
                    isStale={isSpendableBalanceStale}
                    isHidden={isBalanceHidden}
                    onToggleVisibility={toggleBalanceVisibility}
                />
                <div className="flex flex-col gap-2">
                    <EnableCardPaymentsBanner />
                    <PendingVerificationTasks dismissible />
                    {isActivated ? (
                        <HomeCarouselCTA />
                    ) : (
                        <ActivationCTAs activationStep={activationStep} onDismissCard={dismissCardStep} />
                    )}
                    <HomeHistory
                        username={username ?? undefined}
                        hideTxnAmount={isBalanceHidden}
                        hideEmptyState={!isActivated}
                    />
                </div>
            </div>
            <HomeModals />
            <HomeActionDrawers />
        </PageContainer>
    )
}
