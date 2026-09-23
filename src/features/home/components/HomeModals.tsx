'use client'

import LazyLoadErrorBoundary from '@/components/Global/LazyLoadErrorBoundary'
import { PostSignupActionManager } from '@/components/Global/PostSignupActionManager'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
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
const EarlyUserDrawer = lazy(() => import('@/components/Global/EarlyUserDrawer'))
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
 * inline. migration download outranks everything, then notifications,
 * post-signup, and balance warning.
 */
export function HomeModals() {
    const { showPermissionModal } = useNotifications()
    const { isGetAppModalOpen, setIsGetAppModalOpen } = useModalsContext()
    const { balance, isFetchingBalance } = useWallet()
    const { user } = useAuth()

    const [showBalanceWarningDrawer, setShowBalanceWarningDrawer] = useState(false)
    const [isPostSignupActionModalVisible, setIsPostSignupActionModalVisible] = useState(false)
    // migration download prompt outranks every other home modal (self-gating,
    // only during the native-migration notice window)
    const [showMigrationModal, setShowMigrationModal] = useState(false)
    // the migration prompt outranks the post-signup modal; unmounting the
    // manager skips its onVisibilityChange(false), so clear the state here or
    // it stays stuck true and suppresses the balance-warning modal
    useEffect(() => {
        if (showMigrationModal) setIsPostSignupActionModalVisible(false)
    }, [showMigrationModal])

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
            !isPostSignupActionModalVisible
        ) {
            setShowBalanceWarningDrawer(true)
        }
    }, [balance, isFetchingBalance, showMigrationModal, showPermissionModal, isPostSignupActionModalVisible, user])

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

            {/* this modal manages its own state internally */}
            {!showBalanceWarningDrawer && !showMigrationModal && (
                <LazyLoadErrorBoundary>
                    <Suspense fallback={null}>
                        <EarlyUserDrawer />
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

            {/* Post-signup actions are unmounted while the migration prompt shows.
                The effect above clears their visibility state before remounting. */}
            {!showMigrationModal && (
                <PostSignupActionManager onActionModalVisibilityChange={setIsPostSignupActionModalVisible} />
            )}
        </>
    )
}
