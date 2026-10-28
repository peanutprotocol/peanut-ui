'use client'

import LazyLoadErrorBoundary from '@/components/Global/LazyLoadErrorBoundary'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { lazy, Suspense } from 'react'

const ScanToDownloadModal = lazy(() => import('@/components/Migration/ScanToDownloadModal'))

/**
 * Home's user-triggered modals. Every self-opening prompt that used to be
 * chained here renders through the attention manager (features/attention).
 */
export function HomeModals() {
    const { isGetAppModalOpen, setIsGetAppModalOpen } = useModalsContext()
    if (!isGetAppModalOpen) return null
    return (
        // desktop target of the get-the-app carousel cta
        <LazyLoadErrorBoundary>
            <Suspense fallback={null}>
                <ScanToDownloadModal
                    visible={isGetAppModalOpen}
                    onClose={() => setIsGetAppModalOpen(false)}
                    surface={MIGRATION_SURFACES.HOME_BANNER}
                />
            </Suspense>
        </LazyLoadErrorBoundary>
    )
}
