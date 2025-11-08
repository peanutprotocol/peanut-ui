import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { OnrampFlowContextProvider } from './OnrampFlowContext'
import { AuthProvider } from './authContext'
import { KernelClientProvider } from './kernelClient.context'
import { LoadingStateContextProvider } from './loadingStates.context'
import { PushProvider } from './pushProvider'
import { TokenContextProvider } from './tokenSelector.context'
import { WithdrawFlowContextProvider } from './WithdrawFlowContext'
import { ClaimBankFlowContextProvider } from './ClaimBankFlowContext'
import { RequestFulfilmentFlowContextProvider } from './RequestFulfillmentFlowContext'
import { SupportModalProvider } from './SupportModalContext'
import { QrCodeProvider } from './QrCodeContext'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <PushProvider>
                    <KernelClientProvider>
                        <TokenContextProvider>
                            <LoadingStateContextProvider>
                                <ClaimBankFlowContextProvider>
                                    <RequestFulfilmentFlowContextProvider>
                                        <WithdrawFlowContextProvider>
                                            <OnrampFlowContextProvider>
                                                <SupportModalProvider>
                                                    <QrCodeProvider>{children}</QrCodeProvider>
                                                </SupportModalProvider>
                                            </OnrampFlowContextProvider>
                                        </WithdrawFlowContextProvider>
                                    </RequestFulfilmentFlowContextProvider>
                                </ClaimBankFlowContextProvider>
                            </LoadingStateContextProvider>
                        </TokenContextProvider>
                    </KernelClientProvider>
                </PushProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
