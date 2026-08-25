'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/utils/marketing-routes'

// note: push notifications are now handled by onesignal via useNotifications hook.
// the legacy PushProvider (web-push based) has been removed.

const AppFlowProviders = dynamic(() => import('./appFlowProviders').then((m) => m.AppFlowProviders))

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    // Marketing routes render without the wallet provider tree, which keeps the
    // ZeroDev SDK and the transfer-flow contexts out of the landing page's
    // JavaScript. `isMarketingRoute` fails safe: anything it doesn't recognise
    // gets the full tree.
    const marketing = isMarketingRoute(usePathname())

    // Auth, toast, redux and react-query all live in AppFlowProviders now: the
    // marketing site has no signed-in state to read, and AuthProvider was the
    // only thing pulling that stack onto it.
    return marketing ? <>{children}</> : <AppFlowProviders>{children}</AppFlowProviders>
}
