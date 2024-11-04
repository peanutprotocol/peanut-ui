import { useWallet } from '@/context/walletContext'
import SafeAppsSDK from '@safe-global/safe-apps-sdk'
import { useEffect, useState, useRef } from 'react'

type Opts = {
    allowedDomains?: RegExp[]
    debug?: boolean
    isServer?: boolean
}

const opts: Opts = {
    allowedDomains: [/app.safe.global$/, /.*\.blockscout\.com$/],
    debug: false,
    isServer: true,
}

/**
 * Custom React hook to detect and manage the user's wallet type (e.g., Blockscout or safe app environment)
 * using the SafeApps SDK, fetch environment and wallet information,
 * and update the state based on the wallet address.
 */
export const useWalletType = () => {
    const [walletType, setWalletType] = useState<'blockscout' | undefined>(undefined)
    const [environmentInfo, setEnvironmentInfo] = useState<any | undefined>(undefined)
    const [safeInfo, setSafeInfo] = useState<any | undefined>(undefined)
    const { address } = useWallet()
    const prevAddressRef = useRef<string | undefined>(undefined)

    const sdk = new SafeAppsSDK(opts)

    const fetchWalletType = async () => {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 2000)
        )

        try {
            const [envInfo, info] = await Promise.race([
                Promise.all([sdk.safe.getEnvironmentInfo(), sdk.safe.getInfo()]),
                timeout,
            ])

            setEnvironmentInfo(envInfo)
            setSafeInfo(info)

            if (envInfo.origin.includes('blockscout.com')) {
                setWalletType('blockscout')
            } else {
                setWalletType('blockscout')
            }
        } catch (error) {
            console.log('Failed to get wallet info:', error)
            setWalletType(undefined)
            setEnvironmentInfo(undefined)
            setSafeInfo(undefined)
        }
    }

    useEffect(() => {
        if (address && prevAddressRef.current !== address) {
            prevAddressRef.current = address
            fetchWalletType()
        }
    }, [address])

    return { walletType, environmentInfo, safeInfo }
}
