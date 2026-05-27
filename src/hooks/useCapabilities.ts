'use client'

import { useAuth } from '@/context/authContext'
import {
    type CapabilityRestriction,
    type NextAction,
    type ProviderCode,
    type RailCapability,
    type RailCapabilityStatus,
    type RailId,
    type RailOperation,
    type UserCapabilities,
} from '@/types/capabilities'
import { useCallback, useEffect, useMemo, useRef } from 'react'

/**
 * Single selector over the backend-computed capability model. ALL KYC/rail
 * decisions in the FE read this hook — it replaces the 8 legacy KYC state-machine
 * hooks (useUnifiedKycStatus, useKycStatus, useQrKycGate, useProviderRejectionStatus,
 * useRailStatusTracking, useBridgeTransferReadiness, useIdentityVerification,
 * useMultiPhaseKycFlow). The backend is the sole source of truth; this hook never
 * interprets provider state, only reads + indexes the capability block.
 *
 * Capabilities live at the TOP LEVEL of the /get-user response (`user.capabilities`,
 * sibling of the inner `user` object — NOT `user.user.capabilities`).
 *
 * D4 freshness: while any rail is `pending` (provisioning, no user action needed),
 * the React Query user object is refetched every ~4s; polling stops the moment no
 * rail is pending. Reuses authContext's `fetchUser` (the only user fetch path —
 * React Query `[USER]` refetch), never adds a second fetch.
 *
 * See engineering/projects/kyc-2.0/capabilities-rehaul-plan.md (D3, D4).
 */

const POLL_INTERVAL_MS = 4000

const EMPTY_CAPABILITIES: UserCapabilities = {
    rails: [],
    nextActions: [],
    restrictions: [],
}

export interface UseCapabilitiesResult {
    /** The raw capability block (empty shape while loading / for logged-out users). */
    capabilities: UserCapabilities
    rails: RailCapability[]
    nextActions: NextAction[]
    restrictions: CapabilityRestriction[]
    /** True while the underlying user query is in flight (no capabilities yet). */
    isLoading: boolean

    /** Look up a single rail by its stable id (e.g. 'bridge.ach_us'). */
    getRail: (railId: RailId | string) => RailCapability | undefined
    /** All rails for a provider (e.g. every Manteca rail). */
    railsForProvider: (provider: ProviderCode) => RailCapability[]
    /** Any rail (optionally provider-scoped) with status 'enabled'. */
    hasEnabledRail: (provider?: ProviderCode) => boolean

    /**
     * Status of a single operation on a rail. Reads the per-op refinement,
     * falling back to the rail's top-level status: `operations?.[op] ?? status`.
     * Undefined if the rail doesn't exist.
     */
    operationStatus: (railId: RailId | string, op: RailOperation) => RailCapabilityStatus | undefined
    /**
     * True if any matching rail has operationStatus 'enabled' for `op`. Scope by
     * provider and/or a specific railId; with no opts, scans all rails.
     */
    canDo: (op: RailOperation, opts?: { provider?: ProviderCode; railId?: RailId | string }) => boolean

    /** Look up a nextAction descriptor by its key. */
    getNextAction: (key: string) => NextAction | undefined
    /** Resolve a rail's `blockingActions` keys into the matching nextAction descriptors. */
    nextActionsForRail: (railId: RailId | string) => NextAction[]
    /** The restriction (if any) whose `affectedRailIds` includes this rail. */
    restrictionForRail: (railId: RailId | string) => CapabilityRestriction | undefined

    /** Convenience: user can transact on at least one rail. Replaces useUnifiedKycStatus.isKycApproved. */
    isKycApproved: boolean
    /** Convenience: at least one rail is mid-flight (pending or requires-info), none yet enabled-only. */
    isKycInProgress: boolean
}

export function useCapabilities(): UseCapabilitiesResult {
    const { user, isFetchingUser, fetchUser } = useAuth()

    const capabilities = user?.capabilities ?? EMPTY_CAPABILITIES
    const { rails, nextActions, restrictions } = capabilities

    // Index nextActions by key for O(1) lookup (blockingActions resolution).
    const nextActionByKey = useMemo(() => {
        const map = new Map<string, NextAction>()
        for (const action of nextActions) map.set(action.key, action)
        return map
    }, [nextActions])

    // Index rails by id for O(1) lookup.
    const railById = useMemo(() => {
        const map = new Map<string, RailCapability>()
        for (const rail of rails) map.set(rail.id, rail)
        return map
    }, [rails])

    const getRail = useCallback((railId: RailId | string) => railById.get(railId), [railById])

    const railsForProvider = useCallback(
        (provider: ProviderCode) => rails.filter((rail) => rail.provider === provider),
        [rails]
    )

    const hasEnabledRail = useCallback(
        (provider?: ProviderCode) =>
            rails.some((rail) => rail.status === 'enabled' && (provider === undefined || rail.provider === provider)),
        [rails]
    )

    const operationStatus = useCallback(
        (railId: RailId | string, op: RailOperation): RailCapabilityStatus | undefined => {
            const rail = railById.get(railId)
            if (!rail) return undefined
            return rail.operations?.[op] ?? rail.status
        },
        [railById]
    )

    const canDo = useCallback(
        (op: RailOperation, opts?: { provider?: ProviderCode; railId?: RailId | string }): boolean => {
            const candidates = opts?.railId
                ? [railById.get(opts.railId)].filter((rail): rail is RailCapability => rail !== undefined)
                : rails
            return candidates.some((rail) => {
                if (opts?.provider !== undefined && rail.provider !== opts.provider) return false
                return (rail.operations?.[op] ?? rail.status) === 'enabled'
            })
        },
        [rails, railById]
    )

    const getNextAction = useCallback((key: string) => nextActionByKey.get(key), [nextActionByKey])

    const nextActionsForRail = useCallback(
        (railId: RailId | string): NextAction[] => {
            const rail = railById.get(railId)
            if (!rail?.blockingActions) return []
            return rail.blockingActions
                .map((key) => nextActionByKey.get(key))
                .filter((action): action is NextAction => action !== undefined)
        },
        [railById, nextActionByKey]
    )

    const restrictionForRail = useCallback(
        (railId: RailId | string) =>
            restrictions.find((restriction) => restriction.affectedRailIds.includes(railId as RailId)),
        [restrictions]
    )

    const isKycApproved = useMemo(() => rails.some((rail) => rail.status === 'enabled'), [rails])

    const isKycInProgress = useMemo(
        () => rails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info'),
        [rails]
    )

    // D4 — poll the user query while any rail is `pending`; stop when settled.
    const hasPendingRail = useMemo(() => rails.some((rail) => rail.status === 'pending'), [rails])

    // Keep the latest pending flag in a ref so the interval callback reads fresh
    // state without forcing the effect (and thus the interval) to re-create each
    // time the user object changes.
    const hasPendingRef = useRef(hasPendingRail)
    hasPendingRef.current = hasPendingRail

    useEffect(() => {
        if (!hasPendingRail) return

        let cancelled = false
        const timer = setInterval(() => {
            if (cancelled) return
            // Self-terminate the moment nothing is pending — the next render's
            // effect cleanup also clears it, this just avoids a stray refetch.
            if (!hasPendingRef.current) {
                clearInterval(timer)
                return
            }
            void fetchUser()
        }, POLL_INTERVAL_MS)

        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [hasPendingRail, fetchUser])

    return {
        capabilities,
        rails,
        nextActions,
        restrictions,
        isLoading: isFetchingUser,
        getRail,
        railsForProvider,
        hasEnabledRail,
        operationStatus,
        canDo,
        getNextAction,
        nextActionsForRail,
        restrictionForRail,
        isKycApproved,
        isKycInProgress,
    }
}
