"use client"

import { JustaNameProvider } from "@justaname.id/react"
export const JustaNameContext = ({children}: {children: React.ReactNode}) => {
    return (
        <JustaNameProvider config={{
            networks: [
                {
                    chainId: 1,
                    providerUrl: 'https://mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_API_KEY
                }
            ]
        }}>
            {children}
        </JustaNameProvider>
    )
}