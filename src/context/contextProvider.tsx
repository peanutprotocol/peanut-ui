import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { AddFlowContextProvider } from './AddFlowContext'
import { AuthProvider } from './authContext'
import { KernelClientProvider } from './kernelClient.context'
import { LoadingStateContextProvider } from './loadingStates.context'
import { PushProvider } from './pushProvider'
import { TokenContextProvider } from './tokenSelector.context'
import { WithdrawFlowContextProvider } from './WithdrawFlowContext'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <PushProvider>
                    <KernelClientProvider>
                        <TokenContextProvider>
                            <LoadingStateContextProvider>
                                <WithdrawFlowContextProvider>
                                    <AddFlowContextProvider>{children}</AddFlowContextProvider>
                                </WithdrawFlowContextProvider>
                            </LoadingStateContextProvider>
                        </TokenContextProvider>
                    </KernelClientProvider>
                </PushProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
