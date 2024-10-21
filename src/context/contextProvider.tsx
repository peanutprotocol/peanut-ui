import { AuthProvider } from './authContext'
import { LoadingStateContextProvider } from './loadingStates.context'
import { TokenContextProvider } from './tokenSelector.context'
import { WalletProvider } from './walletContext'
import { ZeroDevPeanutProvider } from './walletContext/zeroDevContext.context'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <AuthProvider>
            <ZeroDevPeanutProvider>
                <WalletProvider>
                    <TokenContextProvider>
                        <LoadingStateContextProvider>{children}</LoadingStateContextProvider>
                    </TokenContextProvider>
                </WalletProvider>
            </ZeroDevPeanutProvider>

        </AuthProvider>
    )
}
