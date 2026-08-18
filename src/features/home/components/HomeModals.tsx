'use client'

import { updateUserById } from '@/app/actions/users'
import LazyLoadErrorBoundary from '@/components/Global/LazyLoadErrorBoundary'
import { PostSignupActionManager } from '@/components/Global/PostSignupActionManager'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useNotifications } from '@/hooks/useNotifications'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { lazy, Suspense, useEffect, useState } from 'react'
import { formatUnits } from 'viem'

// lazy load heavy modal components (~20-30KB each) to reduce initial bundle size
// components are only loaded when user triggers them
// wrapped in error boundaries to gracefully handle chunk load failures
const BalanceWarningModal = lazy(() => import('@/components/Global/BalanceWarningModal'))
const SetupNotificationsModal = lazy(() => import('@/components/Notifications/SetupNotificationsModal'))
const NoMoreJailModal = lazy(() => import('@/components/Global/NoMoreJailModal'))
const EarlyUserModal = lazy(() => import('@/components/Global/EarlyUserModal'))
const WelcomeUnlockModal = lazy(() => import('@/components/Home/WelcomeUnlockModal'))
const IosPwaInstallModal = lazy(() => import('@/components/Global/IosPwaInstallModal'))
const MigrationDownloadModal = lazy(() => import('@/components/Migration/MigrationDownloadModal'))
const ScanToDownloadModal = lazy(() => import('@/components/Migration/ScanToDownloadModal'))
const ReviewPromptModal = lazy(() => import('@/components/Migration/ReviewPromptModal'))

const BALANCE_WARNING_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_THRESHOLD ?? '500')
const BALANCE_WARNING_EXPIRY = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_EXPIRY ?? '1814400') // 21 days in seconds

/**
 * home modal orchestration — the priority chain the old home page carried
 * inline. migration download outranks everything, then notifications, kyc
 * celebration, post-signup, ios pwa, balance warning, review prompt.
 */
export function HomeModals() {
    const { showPermissionModal } = useNotifications()
    const { isGetAppModalOpen, setIsGetAppModalOpen } = useModalsContext()
    const { balance, isFetchingBalance } = useWallet()
    const { user } = useUserStore()
    const { fetchUser } = useAuth()
    const { isKycApproved } = useCapabilities()

    const [showBalanceWarningModal, setShowBalanceWarningModal] = useState(false)
    const [isPostSignupActionModalVisible, setIsPostSignupActionModalVisible] = useState(false)
    const [showKycModal, setShowKycModal] = useState(false)
    // migration download prompt outranks every other home modal (self-gating,
    // only during the pwa-sunset notice window)
    const [showMigrationModal, setShowMigrationModal] = useState(false)

    // the migration prompt outranks the post-signup modal; unmounting the
    // manager skips its onVisibilityChange(false), so clear the state here or
    // it stays stuck true and suppresses the balance-warning/review modals
    useEffect(() => {
        if (showMigrationModal) setIsPostSignupActionModalVisible(false)
    }, [showMigrationModal])

    // show the "you're unlocked" celebration exactly once: the user has a usable
    // rail (isKycApproved) and has never dismissed it (activationCelebratedAt is
    // null, stamped server-side on dismiss). a kyc re-approval can't resurface it.
    useEffect(() => {
        if (isKycApproved && !user?.user.activationCelebratedAt) {
            setShowKycModal(true)
        }
    }, [isKycApproved, user?.user.activationCelebratedAt])

    // balance warning: only when balance is above threshold, unseen recently,
    // and no higher-priority modal is active
    useEffect(() => {
        if (isFetchingBalance || balance === undefined || !user) return
        if (typeof window === 'undefined') return

        const userPreferences = getUserPreferences(user.user.userId)
        const hasSeenBalanceWarning =
            (userPreferences?.hasSeenBalanceWarning?.expiry ?? 0) > Date.now() &&
            userPreferences?.hasSeenBalanceWarning?.value
        const balanceInUsd = Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

        if (
            balanceInUsd > BALANCE_WARNING_THRESHOLD &&
            !hasSeenBalanceWarning &&
            !showMigrationModal && // highest priority
            !showPermissionModal &&
            !showKycModal &&
            !isPostSignupActionModalVisible
        ) {
            setShowBalanceWarningModal(true)
        }
    }, [
        balance,
        isFetchingBalance,
        showMigrationModal,
        showPermissionModal,
        showKycModal,
        isPostSignupActionModalVisible,
        user,
    ])

    return (
        <>
            {showPermissionModal && !showBalanceWarningModal && !showMigrationModal && (
                <LazyLoadErrorBoundary>
                    <Suspense fallback={null}>
                        <SetupNotificationsModal />
                    </Suspense>
                </LazyLoadErrorBoundary>
            )}

            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <MigrationDownloadModal onVisibilityChange={setShowMigrationModal} />
                </Suspense>
            </LazyLoadErrorBoundary>

            {/* desktop target of the get-the-app carousel cta */}
            {isGetAppModalOpen && (
                <LazyLoadErrorBoundary>
                    <Suspense fallback={null}>
                        <ScanToDownloadModal
                            visible={isGetAppModalOpen}
                            onClose={() => setIsGetAppModalOpen(false)}
                            surface={MIGRATION_SURFACES.HOME_BANNER}
                        />
                    </Suspense>
                </LazyLoadErrorBoundary>
            )}

            {/* these modals manage their own state internally */}
            {!showBalanceWarningModal && !showMigrationModal && (
                <>
                    <LazyLoadErrorBoundary>
                        <Suspense fallback={null}>
                            <NoMoreJailModal />
                        </Suspense>
                    </LazyLoadErrorBoundary>

                    <LazyLoadErrorBoundary>
                        <Suspense fallback={null}>
                            <EarlyUserModal />
                        </Suspense>
                    </LazyLoadErrorBoundary>
                </>
            )}

            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <WelcomeUnlockModal
                        isOpen={showKycModal && !showBalanceWarningModal && !showMigrationModal}
                        onClose={async () => {
                            // close the modal immediately for better ux
                            setShowKycModal(false)
                            // update the database and refetch user to ensure sync
                            if (user?.user.userId) {
                                await updateUserById({
                                    userId: user.user.userId,
                                    dismissActivationCelebration: true,
                                })
                                await fetchUser()
                            }
                        }}
                    />
                </Suspense>
            </LazyLoadErrorBoundary>

            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <BalanceWarningModal
                        visible={showBalanceWarningModal && !showMigrationModal}
                        onCloseAction={() => {
                            setShowBalanceWarningModal(false)
                            updateUserPreferences(user!.user.userId, {
                                hasSeenBalanceWarning: {
                                    value: true,
                                    expiry: Date.now() + BALANCE_WARNING_EXPIRY * 1000,
                                },
                            })
                        }}
                    />
                </Suspense>
            </LazyLoadErrorBoundary>

            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <IosPwaInstallModal />
                </Suspense>
            </LazyLoadErrorBoundary>

            {/* card pioneer modal — eligibility check happens during the flow (geo
                screen), not here. unmounted while the migration prompt shows (it
                re-checks on remount); the effect above clears its stuck state */}
            {!showMigrationModal && (
                <PostSignupActionManager onActionModalVisibilityChange={setIsPostSignupActionModalVisible} />
            )}

            {/* app review nudge (native only, once ever) — lowest priority */}
            {!showMigrationModal &&
                !showPermissionModal &&
                !showBalanceWarningModal &&
                !showKycModal &&
                !isPostSignupActionModalVisible && (
                    <LazyLoadErrorBoundary>
                        <Suspense fallback={null}>
                            <ReviewPromptModal />
                        </Suspense>
                    </LazyLoadErrorBoundary>
                )}
        </>
    )
}
