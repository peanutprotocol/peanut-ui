'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { isMarketingRoute } from '@/utils/marketing-routes'
import { AuthProvider } from './authContext'

// note: push notifications are now handled by onesignal via useNotifications hook.
// the legacy PushProvider (web-push based) has been removed.

const AppFlowProviders = dynamic(() => import('./appFlowProviders').then((m) => m.AppFlowProviders))

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    // Marketing routes render without the wallet provider tree, which keeps the
    // ZeroDev SDK and the transfer-flow contexts out of the landing page's
    // JavaScript. `isMarketingRoute` fails safe: anything it doesn't recognise
    // gets the full tree.
    const marketing = isMarketingRoute(usePathname())

    return (
        <ToastProvider>
            <AuthProvider>{marketing ? children : <AppFlowProviders>{children}</AppFlowProviders>}</AuthProvider>
        </ToastProvider>
    )
}
