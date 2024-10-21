'use client'
import { ReactNode } from 'react'

// ZeroDev imports
import * as consts from '@/constants/zerodev.consts'
import { http } from "viem"
import { ZeroDevProvider, createConfig } from "@zerodev/waas"


export const ZeroDevPeanutProvider = ({ children }: { children: ReactNode }) => {

    const zeroDevConfig = createConfig({
        chains: [consts.PEANUT_WALLET_CHAIN],
        transports: {
          [consts.PEANUT_WALLET_CHAIN.id]: http()
        },
        projectIds: {
          [consts.PEANUT_WALLET_CHAIN.id]: consts.ZERO_DEV_PROJECT_ID!
        }
    })
    return (
        <ZeroDevProvider config={zeroDevConfig}>
            {children}
        </ZeroDevProvider>
    )
}
