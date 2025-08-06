import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { OnrampFlowContextProvider } from './OnrampFlowContext'
import { AuthProvider } from './authContext'
import { KernelClientProvider } from './kernelClient.context'
import { LoadingStateContextProvider } from './loadingStates.context'
import { PushProvider } from './pushProvider'
import { TokenContextProvider } from './tokenSelector.context'
import { WithdrawFlowContextProvider } from './WithdrawFlowContext'
import { ClaimBankFlowContextProvider } from './ClaimBankFlowContext'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <PushProvider>
                    <KernelClientProvider>
                        <TokenContextProvider>
                            <LoadingStateContextProvider>
                                <ClaimBankFlowContextProvider>
                                    <WithdrawFlowContextProvider>
                                        <OnrampFlowContextProvider>{children}</OnrampFlowContextProvider>
                                    </WithdrawFlowContextProvider>
                                </ClaimBankFlowContextProvider>
                            </LoadingStateContextProvider>
                        </TokenContextProvider>
                    </KernelClientProvider>
                </PushProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
