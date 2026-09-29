'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import EnableAutoBalanceBanner from '@/components/Home/EnableAutoBalanceBanner'
import HomeCarouselCTA from '@/components/Home/HomeCarouselCTA'
import HomeHistory from '@/components/Home/HomeHistory'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useProviderRejection } from '@/hooks/useProviderRejection'
import { canHideChecklist } from '@/utils/activation-step.utils'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
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
 * project, not the ds rebuild.
 *
 * one CTA surface at a time (hugo, 2026-09-25): a large verification task card
 * replaces the carousel and the checklist; it is due, so it wins. with no task
 * card, a user who finished onboarding (or hid the checklist once only the
 * payment row was left) gets the carousel and everyone else the
 * getting-started checklist (ActivationCTAs) — never both.
 * PendingVerificationTasks renders `whenEmpty` only when it shows nothing itself.
 */
export function HomePage() {
    const {
        isPageLoading,
        username,
        isActivated,
        onboarding,
        isOnboardingComplete,
        isChecklistHidden,
        hideChecklist,
        hiddenHomeCtas,
        hideCta,
        spendableBalance,
        isFetchingSpendableBalance,
        isSpendableBalanceStale,
        isBalanceHidden,
        toggleBalanceVisibility,
    } = useHomeFlow()
    useHomeViewAnalytics(isPageLoading)
    const { nextActions, rails } = useCapabilities()
    const { documentSlide } = selectHomeTasks(nextActions, rails ?? [])
    const { blockedCard } = useProviderRejection(onboarding)
    // a blocked card (region refused, provider rejection) owns the slot until
    // the user hides it, even when every checklist row is done; hiding hands over
    // to the carousel, and Profile → Accounts keeps the fix or support route. A hidden checklist
    // counts as done only while it may be hidden (payment row left).
    const showCarousel = blockedCard
        ? hiddenHomeCtas.has(blockedCard.ctaId)
        : isOnboardingComplete || (isChecklistHidden && canHideChecklist(onboarding))

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
                    <EnableAutoBalanceBanner />
                    <PendingVerificationTasks
                        placement="home"
                        whenEmptyShowsDocumentRequest={showCarousel}
                        whenEmpty={
                            showCarousel ? (
                                <HomeCarouselCTA documentRequest={documentSlide} />
                            ) : (
                                <ActivationCTAs
                                    onboarding={onboarding}
                                    onHideChecklist={hideChecklist}
                                    onHideBlockedCard={hideCta}
                                />
                            )
                        }
                    />
                    <HomeHistory
                        username={username ?? undefined}
                        hideTxnAmount={isBalanceHidden}
                        hideEmptyState={!showCarousel}
                    />
                </div>
            </div>
            <HomeModals />
            <HomeActionDrawers />
        </PageContainer>
    )
}
