'use client'

import { isCapacitor } from '@/utils/capacitor'
import { SumsubNativeSdk } from './SumsubNativeSdk'
import { SumsubWebSdkModal } from './SumsubWebSdkModal'
import type { SumsubSdkProps } from './sumsubSdk.types'

/**
 * Every KYC entry point funnels through here, so this is the one place that
 * knows which Sumsub SDK to drive. Native gets the Cordova SDK: the WebSDK does
 * run inside the Capacitor WebView, but a Sumsub-side init failure there paints
 * their "Initialization error" screen inside a cross-origin iframe, silent to
 * every handler and every reporter we have.
 */
export const SumsubKycWrapper = (props: SumsubSdkProps) => {
    if (isCapacitor()) return <SumsubNativeSdk {...props} />
    return <SumsubWebSdkModal {...props} />
}
