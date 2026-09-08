'use client'

import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { AuthProvider } from './authContext'
import { OnrampFlowContextProvider } from './OnrampFlowContext'
import { KernelClientProvider } from './kernelClient.context'
import { LoadingStateContextProvider } from './loadingStates.context'
import { TokenContextProvider } from './tokenSelector.context'
import { WithdrawFlowContextProvider } from './WithdrawFlowContext'
import { ClaimBankFlowContextProvider } from './ClaimBankFlowContext'
import { RequestFulfilmentFlowContextProvider } from './RequestFulfillmentFlowContext'
import { PasskeySupportProvider } from './passkeySupportContext'
import { ModalsProvider } from './ModalsContext'
import { RainCooldownProvider } from './RainCooldownContext'
import { ConnectivityToast } from '@/components/Global/Banner/ConnectivityToast'

// TODO(provider-cake): every new context provider adds another layer of JSX
// nesting here, which is non-DRY and noisy in diffs. Proposed cleanup in its
// own PR: replace this block with a `composeProviders` helper —
//   const providers = [KernelClientProvider, /* …outer→inner… */]
//   return providers.reduceRight((tree, P) => <P>{tree}</P>, children)
// Caveats to handle in that PR:
//   (a) any provider that needs extra props (not just children) breaks the
//       flat-list shape — handle by allowing `[Component, props]` tuples;
//   (b) `children` is `ReactNode`, so the accumulator type must be ReactNode
//       (not ReactElement) to stay honest for multi-child callers;
//   (c) coordinate with eslint-pass / refactor agents — this file isn't on
//       their avoid list and a parallel touch would conflict.
// Kept as nested JSX here to keep this PR surgical.

/**
 * Wallet and transfer-flow providers. Loaded as its own chunk and mounted only
 * on app routes — `KernelClientProvider` alone pulls the ZeroDev SDK, which the
 * marketing site never uses. See `utils/marketing-routes.ts`.
 */
export const AppFlowProviders = ({ children }: { children: React.ReactNode }) => {
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
                                                <ModalsProvider>
                                                    <RainCooldownProvider>
                                                        {/* connectivity state rides the toast surface (ruled 2026-09-03) */}
                                                        <ConnectivityToast />
                                                        {children}
                                                    </RainCooldownProvider>
                                                </ModalsProvider>
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
