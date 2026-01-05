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

// note: push notifications are now handled by onesignal via useNotifications hook.
// the legacy PushProvider (web-push based) has been removed.

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <KernelClientProvider>
                    <TokenContextProvider>
                        <LoadingStateContextProvider>
                            <ClaimBankFlowContextProvider>
                                <RequestFulfilmentFlowContextProvider>
                                    <WithdrawFlowContextProvider>
                                        <OnrampFlowContextProvider>
                                            <PasskeySupportProvider>
                                                <ModalsProvider>{children}</ModalsProvider>
                                            </PasskeySupportProvider>
                                        </OnrampFlowContextProvider>
                                    </WithdrawFlowContextProvider>
                                </RequestFulfilmentFlowContextProvider>
                            </ClaimBankFlowContextProvider>
                        </LoadingStateContextProvider>
                    </TokenContextProvider>
                </KernelClientProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
