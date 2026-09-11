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
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { lazy, Suspense, useEffect, useState } from 'react'
import { formatUnits } from 'viem'

// lazy load heavy modal components (~20-30KB each) to reduce initial bundle size
// components are only loaded when user triggers them
// wrapped in error boundaries to gracefully handle chunk load failures
const BalanceWarningDrawer = lazy(() => import('@/components/Global/BalanceWarningDrawer'))
const SetupNotificationsModal = lazy(() => import('@/components/Notifications/SetupNotificationsModal'))
const NoMoreJailDrawer = lazy(() => import('@/components/Global/NoMoreJailDrawer'))
const EarlyUserDrawer = lazy(() => import('@/components/Global/EarlyUserDrawer'))
const WelcomeUnlockDrawer = lazy(() => import('@/components/Home/WelcomeUnlockDrawer'))
const IosPwaInstallDrawer = lazy(() => import('@/components/Global/IosPwaInstallDrawer'))
const MigrationDownloadModal = lazy(() => import('@/components/Migration/MigrationDownloadModal'))
const ScanToDownloadModal = lazy(() => import('@/components/Migration/ScanToDownloadModal'))

// guard against malformed env values — NaN would silently disable the
// warning (threshold compare always false) or break dismissal expiry
const parsedThreshold = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_THRESHOLD ?? '500')
const BALANCE_WARNING_THRESHOLD = Number.isNaN(parsedThreshold) ? 500 : parsedThreshold
const parsedExpiry = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_EXPIRY ?? '1814400')
const BALANCE_WARNING_EXPIRY = Number.isNaN(parsedExpiry) ? 1814400 : parsedExpiry // 21 days in seconds

/**
 * home modal orchestration — the priority chain the old home page carried
 * inline. migration download outranks everything, then notifications, kyc
 * celebration, post-signup, ios pwa, balance warning.
 */
export function HomeModals() {
    const { showPermissionModal } = useNotifications()
    const { isGetAppModalOpen, setIsGetAppModalOpen, isIosPwaInstallDrawerOpen } = useModalsContext()
    const { balance, isFetchingBalance } = useWallet()
    const { user, fetchUser } = useAuth()
    const { isKycApproved } = useCapabilities()

    const [showBalanceWarningDrawer, setShowBalanceWarningDrawer] = useState(false)
    const [isPostSignupActionModalVisible, setIsPostSignupActionModalVisible] = useState(false)
    const [showKycModal, setShowKycModal] = useState(false)
    // migration download prompt outranks every other home modal (self-gating,
    // only during the pwa-sunset notice window)
    const [showMigrationModal, setShowMigrationModal] = useState(false)
    // Both celebration drawers open themselves (session storage / a user
    // flag), and a pre-lockup invitee can qualify for both at once — two open
    // vaul roots would stack overlays and scroll locks. The jail celebration
    // goes first; the early-user drawer mounts only once it is out of the way.
    const [jailCelebrationPending, setJailCelebrationPending] = useState(
        () => typeof window !== 'undefined' && sessionStorage.getItem('showNoMoreJailModal') === 'true'
    )
    // Derived synchronously from the user flag, not from the child's effect:
    // the drawer only reports itself open after mount, and that one-commit gap
    // let the activation celebration flash open between two drawers. The flag
    // holds the queue until the drawer reports its dismissal.
    const [earlyUserDone, setEarlyUserDone] = useState(false)
    const [earlyUserOpen, setEarlyUserOpen] = useState(false)
    const earlyUserPending = (!!user?.showEarlyUserModal && !earlyUserDone) || earlyUserOpen

    // the migration prompt outranks the post-signup modal; unmounting the
    // manager skips its onVisibilityChange(false), so clear the state here or
    // it stays stuck true and suppresses the balance-warning modal
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
            setShowBalanceWarningDrawer(true)
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
            {showPermissionModal && !showBalanceWarningDrawer && !showMigrationModal && (
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
            {!showBalanceWarningDrawer && !showMigrationModal && (
                <>
                    <LazyLoadErrorBoundary>
                        <Suspense fallback={null}>
                            <NoMoreJailDrawer onVisibilityChange={setJailCelebrationPending} />
                        </Suspense>
                    </LazyLoadErrorBoundary>

                    {!jailCelebrationPending && (
                        <LazyLoadErrorBoundary>
                            <Suspense fallback={null}>
                                <EarlyUserDrawer
                                    onVisibilityChange={(visible) => {
                                        setEarlyUserOpen(visible)
                                        if (!visible) setEarlyUserDone(true)
                                    }}
                                />
                            </Suspense>
                        </LazyLoadErrorBoundary>
                    )}
                </>
            )}

            {/* mount-gated so the ~20-30KB chunk only loads when the modal can show */}
            {showKycModal && (
                <LazyLoadErrorBoundary>
                    <Suspense fallback={null}>
                        <WelcomeUnlockDrawer
                            isOpen={
                                showKycModal &&
                                !showBalanceWarningDrawer &&
                                !showMigrationModal &&
                                !jailCelebrationPending &&
                                !earlyUserPending
                            }
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
            )}

            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <BalanceWarningDrawer
                        visible={showBalanceWarningDrawer && !showMigrationModal}
                        onCloseAction={() => {
                            setShowBalanceWarningDrawer(false)
                            // no non-null assertion: user can log out while the modal is open
                            if (user?.user.userId) {
                                updateUserPreferences(user.user.userId, {
                                    hasSeenBalanceWarning: {
                                        value: true,
                                        expiry: Date.now() + BALANCE_WARNING_EXPIRY * 1000,
                                    },
                                })
                            }
                        }}
                    />
                </Suspense>
            </LazyLoadErrorBoundary>

            {/* mount-gated: the modal is purely context-driven, so the chunk
                only loads once something opens it */}
            {isIosPwaInstallDrawerOpen && (
                <LazyLoadErrorBoundary>
                    <Suspense fallback={null}>
                        <IosPwaInstallDrawer />
                    </Suspense>
                </LazyLoadErrorBoundary>
            )}

            {/* card pioneer modal — eligibility check happens during the flow (geo
                screen), not here. unmounted while the migration prompt shows (it
                re-checks on remount); the effect above clears its stuck state */}
            {!showMigrationModal && (
                <PostSignupActionManager onActionModalVisibilityChange={setIsPostSignupActionModalVisible} />
            )}
        </>
    )
}
