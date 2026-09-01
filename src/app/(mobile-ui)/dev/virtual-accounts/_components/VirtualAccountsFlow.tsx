'use client'

import { useQueryStates } from 'nuqs'
import { DetailsScreen } from './DetailsScreen'
import { PickScreen } from './PickScreen'
import { ShareScreen } from './ShareScreen'
import { RAILS } from './mock'
import { VA_PARAMS } from './params'

/**
 * The get-paid flow as a nuqs stepper (design.md "multi-step flow"): the
 * URL holds screen + currency, one NavHeader title across every step, in-flow
 * back sets the step param. `state` and `sku` are prototype-only knobs the
 * harness page sets; a product build reads them from the API instead.
 */
export function VirtualAccountsFlow() {
    const [{ screen, currency, state, sku }, setParams] = useQueryStates(VA_PARAMS)
    const rail = RAILS[currency]

    if (screen === 'share') {
        return <ShareScreen rail={rail} sku={sku} onBack={() => setParams({ screen: 'details' })} />
    }

    if (screen === 'details' && state !== 'kyc') {
        return (
            <DetailsScreen
                rail={rail}
                state={state}
                sku={sku}
                onBack={() => setParams({ screen: 'pick' })}
                onShare={() => setParams({ screen: 'share' })}
                onRetry={() => setParams({ state: 'pending' })}
            />
        )
    }

    return (
        <PickScreen
            kycGate={state === 'kyc'}
            onPick={(picked) => setParams({ screen: 'details', currency: picked })}
            onVerify={() => setParams({ state: 'ready' })}
        />
    )
}
