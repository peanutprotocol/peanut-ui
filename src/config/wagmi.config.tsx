import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'

import * as consts from '@/consts'

export const wagmiConfig = defaultWagmiConfig({
    chains: consts.chains,
    projectId: process.env.WC_PROJECT_ID ?? '',
    appName: 'Web3Modal',
})

createWeb3Modal({
    wagmiConfig,
    chains: consts.chains,
    projectId: process.env.WC_PROJECT_ID ?? '',
    themeVariables: {
        '--w3m-border-radius-master': '0px',
        '--w3m-accent': 'white',
        '--w3m-color-mix': 'white',
    },
})
