'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import type { RailCapability, RailOperation } from '@/types/capabilities'
import { isDemoMode } from '@/utils/demo'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { canUseBankRail, hasAnyEnabledRail, isIdentityVerified } from '@/utils/verification'

const NO_RAILS: RailCapability[] = []

export interface Verification {
    /** The identity check passed (documents). Not a money gate: rails decide what the user can do. */
    identityVerified: boolean
    /**
     * A provider has enabled at least one rail. Demo mode reads as true, so the
     * walkthrough meets no verification wall.
     */
    hasAnyEnabledRail: boolean
    /** The user may run `op` on a bank rail in `countryCode` (see {@link canUseBankRail}). */
    canUse: (op: RailOperation, countryCode: string) => boolean
}

/** The one place the UI asks "is this user verified?". It reads only what /users/me serves. */
export function useVerification(): Verification {
    const demoMode = useHydrationSnapshot(isDemoMode, () => false)
    const { user } = useAuth()
    const rails = user?.capabilities?.rails ?? NO_RAILS
    const identityVerified = isIdentityVerified(user?.identityVerification)
    const anyEnabledRail = demoMode || hasAnyEnabledRail(rails)
    const canUse = useCallback(
        (op: RailOperation, countryCode: string) => canUseBankRail(rails, op, countryCode),
        [rails]
    )
    return useMemo(
        () => ({ identityVerified, hasAnyEnabledRail: anyEnabledRail, canUse }),
        [identityVerified, anyEnabledRail, canUse]
    )
}
