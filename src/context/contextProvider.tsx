import { type ComponentType, type PropsWithChildren } from 'react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { OnrampFlowContextProvider } from './OnrampFlowContext'
import { AuthProvider } from './authContext'
import { KernelClientProvider } from './kernelClient.context'
import { LoadingStateContextProvider } from './loadingStates.context'
import { TokenContextProvider } from './tokenSelector.context'
import { WithdrawFlowContextProvider } from './WithdrawFlowContext'
import { ClaimBankFlowContextProvider } from './ClaimBankFlowContext'
import { RequestFulfilmentFlowContextProvider } from './RequestFulfillmentFlowContext'
import { PasskeySupportProvider } from './passkeySupportContext'
import { ModalsProvider } from './ModalsContext'
import { RainCooldownProvider } from './RainCooldownContext'

// note: push notifications are now handled by onesignal via useNotifications hook.
// the legacy PushProvider (web-push based) has been removed.

/**
 * Outer → inner. A provider may depend on the context of any provider above
 * it in this list. ToastProvider sits outermost because every other provider
 * (including the cooldown one) can surface toasts.
 */
const providers: Array<ComponentType<PropsWithChildren>> = [
    ToastProvider,
    AuthProvider,
    KernelClientProvider,
    TokenContextProvider,
    LoadingStateContextProvider,
    ClaimBankFlowContextProvider,
    RequestFulfilmentFlowContextProvider,
    WithdrawFlowContextProvider,
    OnrampFlowContextProvider,
    PasskeySupportProvider,
    ModalsProvider,
    RainCooldownProvider,
]

export const ContextProvider = ({ children }: { children: React.ReactNode }) =>
    providers.reduceRight((tree, Provider) => <Provider>{tree}</Provider>, children as React.ReactElement)
