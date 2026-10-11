'use client'

import LazyLoadErrorBoundary from '@/components/Global/LazyLoadErrorBoundary'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { lazy, Suspense } from 'react'
import { useArrivalPrompt } from '../useArrivalPrompt'

const ArrivalDrawer = lazy(() => import('./ArrivalDrawer'))
const ScanToDownloadModal = lazy(() => import('@/components/Migration/ScanToDownloadModal'))
const ArrivalDrawer = lazy(() => import('./ArrivalDrawer'))

/**
 * Home's user-triggered modals. Every self-opening prompt that used to be
 * chained here renders through the attention arbiter (features/attention).
 */
export function HomeModals() {
    const { isGetAppModalOpen, setIsGetAppModalOpen } = useModalsContext()
    const { arrival, dismiss } = useArrivalPrompt()
    return (
        <>
        {arrival && <LazyLoadErrorBoundary><Suspense fallback={null}><ArrivalDrawer arrival={arrival} blocked={false} onDismiss={dismiss} /></Suspense></LazyLoadErrorBoundary>}
        {isGetAppModalOpen && <LazyLoadErrorBoundary>
            <Suspense fallback={null}>
                <ScanToDownloadModal
                    visible={isGetAppModalOpen}
                    onClose={() => setIsGetAppModalOpen(false)}
                    surface={MIGRATION_SURFACES.HOME_BANNER}
                />
            </Suspense>
        </LazyLoadErrorBoundary>}
        </>
    )
}
