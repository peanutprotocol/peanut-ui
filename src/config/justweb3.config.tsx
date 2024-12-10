'use client'
import { JustWeb3Provider as JustWeb3ProviderPrimitive, JustWeb3ProviderConfig } from '@justweb3/widget'
import '@justweb3/widget/styles.css'
import { ChainId } from '@justaname.id/sdk'

export const chainId = process.env.NEXT_PUBLIC_JUSTANAME_CHAIN_ID
    ? (parseInt(process.env.NEXT_PUBLIC_JUSTANAME_CHAIN_ID) as ChainId)
    : 1
export const peanutEnsDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
export const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY
const justweb3Config: JustWeb3ProviderConfig = {
    networks: [
        {
            chainId: 1,
            providerUrl: `https://mainnet.infura.io/v3/` + infuraApiKey,
        },
        {
            chainId: 11155111,
            providerUrl: `https://sepolia.infura.io/v3/` + infuraApiKey,
        },
    ],
    ensDomains: [
        {
            ensDomain: peanutEnsDomain,
            chainId: 1,
        },
    ],
    openOnWalletConnect: false,
}

export interface JustaNameProviderConfig {
    children: React.ReactNode
}

export const JustWeb3Provider: React.FC<JustaNameProviderConfig> = ({ children }) => {
    return <JustWeb3ProviderPrimitive config={justweb3Config}>{children}</JustWeb3ProviderPrimitive>
}
