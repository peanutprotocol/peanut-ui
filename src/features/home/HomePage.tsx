'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import CardLaunchCTA from '@/components/Home/CardLaunchCTA'
import EnableAutoBalanceBanner from '@/components/Home/EnableAutoBalanceBanner'
import HomeCarouselCTA from '@/components/Home/HomeCarouselCTA'
import HomeHistory from '@/components/Home/HomeHistory'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { HomeModals } from './components/HomeModals'
import { useHomeFlow } from './useHomeFlow'
import { BalanceSection } from './views/BalanceSection'
import { HomeTopNav } from './views/HomeTopNav'

/**
 * home page (figma board 17830:75689): top nav (avatar / rewards), balance
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
        avatarName,
        isActivated,
        activationStep,
        dismissCardStep,
        spendableBalance,
        isFetchingSpendableBalance,
        isBalanceHidden,
        toggleBalanceVisibility,
    } = useHomeFlow()

    if (isPageLoading) {
        return <Loading variant="mascot" coverFullScreen />
    }

    return (
        <PageContainer>
            <div className="flex h-full w-full flex-col gap-6 p-4">
                <HomeTopNav avatarName={avatarName} showRewards={isActivated} />
                <BalanceSection
                    balance={spendableBalance}
                    isFetching={isFetchingSpendableBalance}
                    isHidden={isBalanceHidden}
                    onToggleVisibility={toggleBalanceVisibility}
                />
                <div className="flex flex-col gap-2">
                    <EnableAutoBalanceBanner />
                    <CardLaunchCTA />
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
        </PageContainer>
    )
}
