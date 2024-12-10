import { JustaName } from '@justaname.id/sdk'

let justanameInstance: JustaName | null = null

export const getJustaNameInstance = (): JustaName => {
    const ensDomain = process.env.JUSTANAME_ENS_DOMAIN as string
    const infuraApiKey = process.env.INFURA_API_KEY as string
    if (!justanameInstance) {
        justanameInstance = JustaName.init({
            defaultChainId: 1,
            ensDomains: [
                {
                    chainId:11155111,
                    ensDomain,
                    apiKey: process.env.JUSTANAME_API_KEY as string,
                },
                {
                    chainId:1,
                    ensDomain,
                    apiKey: process.env.JUSTANAME_API_KEY as string,
                },
            ],
            networks: [
                {
                    chainId:1,
                    providerUrl: `https://mainnet.infura.io/v3/` + infuraApiKey,
                },
                {
                    chainId:11155111,
                    providerUrl: `https://sepolia.infura.io/v3/` + infuraApiKey,
                }
            ]
        })
    }
    return justanameInstance
}
