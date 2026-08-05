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
import { deriveGate, type GateScope, type GateState } from '@/utils/capability-gate'
import type { RailChannel } from '@/types/capabilities'
import { isDemoMode } from '@/utils/demo'
import { useCallback, useMemo } from 'react'

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
 * D4 freshness: the [USER] query is auto-refreshed every ~4s while any rail
 * is `pending` (provisioning, no user action needed) OR a recent submission
 * window is active. That loop is owned by a SINGLETON effect mounted from
 * AuthProvider (see {@link useUserAutoRefresh}), not from this hook, so the
 * N components reading capabilities share one interval — not N.
 *
 * See engineering/projects/kyc-2.0/capabilities-rehaul-plan.md (D3, D4).
 */

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

    /**
     * **The canonical primitive for "can the user do X (in this scope)? If
     * not, what's blocking?".** Replaces `deriveBridgeGate` (provider-named,
     * bank-only) with a provider-blind, scope-composable gate over the
     * normalized state machine in {@link GateState}.
     *
     * Examples:
     *   useCapabilities().gateFor('deposit', { channel: 'bank', country: 'AR' })
     *   useCapabilities().gateFor('pay')                                  // any rail
     *   useCapabilities().gateFor('withdraw', { railId: 'bridge.ach_us' }) // one rail
     */
    gateFor: (op: RailOperation, scope?: GateScope) => GateState

    /** Bank-channel rails, provider-blind. Optionally country-scoped. */
    bankRails: (opts?: { country?: string }) => RailCapability[]
    /** Channel classifier for a single rail (delegates to {@link railChannel}). */
    channelOf: (rail: RailCapability) => RailChannel
    /** Countries the user can do `op` in (or any op, if undefined). */
    enabledCountriesFor: (op?: RailOperation) => Set<string>
}

export function useCapabilities(): UseCapabilitiesResult {
    const { user, isFetchingUser } = useAuth()

    const capabilities = user?.capabilities ?? EMPTY_CAPABILITIES
    const { rails, nextActions, restrictions } = capabilities
    // The gate's "identity verified" precondition reads the second read-model
    // directly (NOT the rail-level isKycApproved — that's any-rail-enabled
    // which falsely flips for card-only or pool-tier users, the CodeRabbit
    // semantic finding folded in alongside Profile/ProfileEdit).
    const identityVerified = user?.identityVerification?.status === 'verified'

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

    // demo mode: present as verified so KYC walls don't block the walkthrough.
    const isKycApproved = useMemo(() => isDemoMode() || rails.some((rail) => rail.status === 'enabled'), [rails])

    const isKycInProgress = useMemo(
        () => rails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info'),
        [rails]
    )

    // ── Provider-blind primitive layer ─────────────────────────────────────
    // Single source of truth for "can the user do X here?" + bank-channel
    // summaries. Every UI site that used to filter by `provider === 'bridge'`
    // / `provider === 'manteca'` reads through here instead.

    const gateFor = useCallback(
        (op: RailOperation, scope?: GateScope): GateState =>
            deriveGate({ rails, nextActions, identityVerified, isLoading: isFetchingUser }, op, scope),
        [rails, nextActions, identityVerified, isFetchingUser]
    )

    const bankRails = useCallback(
        (opts?: { country?: string }): RailCapability[] => {
            const all = rails.filter((rail) => rail.channel === 'bank')
            return opts?.country ? all.filter((rail) => rail.country === opts.country) : all
        },
        [rails]
    )

    const channelOf = useCallback((rail: RailCapability) => rail.channel, [])

    const enabledCountriesFor = useCallback(
        (op?: RailOperation): Set<string> => {
            const out = new Set<string>()
            for (const rail of rails) {
                const enabled = op ? (rail.operations?.[op] ?? rail.status) === 'enabled' : rail.status === 'enabled'
                if (enabled) out.add(rail.country)
            }
            return out
        },
        [rails]
    )

    // Auto-refresh of the [USER] query is owned by a SINGLETON effect mounted
    // once from AuthProvider via `useUserAutoRefresh` — not here. Hosting it
    // in `useCapabilities` would spawn N concurrent intervals (one per
    // component reading capabilities), with per-instance in-flight guards that
    // React Query coalescing partially hides but doesn't fully neutralize.
    // See {@link useUserAutoRefresh} for the (pending-rail OR submission-window)
    // predicate.

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
        gateFor,
        bankRails,
        channelOf,
        enabledCountriesFor,
    }
}
