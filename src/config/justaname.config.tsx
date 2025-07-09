'use client'

import { JustaNameProvider } from '@justaname.id/react'
import { rpcUrls } from '@/constants/general.consts'
import { mainnet } from 'viem/chains'

export const JustaNameContext = ({ children }: { children: React.ReactNode }) => {
    const mainnetRpcUrl = rpcUrls[mainnet.id]?.[0]

    const networks = mainnetRpcUrl
        ? [
              {
                  chainId: mainnet.id,
                  providerUrl: mainnetRpcUrl,
              },
          ]
        : []

    return (
        <JustaNameProvider
            config={{
                networks,
            }}
        >
            {children}
        </JustaNameProvider>
    )
}
