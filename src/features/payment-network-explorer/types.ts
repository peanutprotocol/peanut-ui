export const PAYMENT_NETWORK_CONTRACT = 'payment-network.v2' as const
export const PAYMENT_NETWORK_MEDIA_TYPE = 'application/vnd.peanut.payment-network.v2+json' as const

export const RANGE_PRESETS = ['24h', '7d', '30d', '90d', '120d', 'custom'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export const MOVEMENT_STATES = ['SETTLED', 'PENDING', 'FAILED', 'REFUNDED', 'REVERSED'] as const
export type MovementState = (typeof MOVEMENT_STATES)[number]

export type ExplorerView = 'graph' | 'table'
export type InfrastructureMode = 'edges' | 'hubs'
export type NodeType = 'USER' | 'EXTERNAL' | 'HUB'
export type LabelVisibility = 'VISIBLE' | 'PSEUDONYMOUS' | 'REVEALED'
export type RelationshipDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL'
export type RevealReason = 'INVESTIGATION' | 'SUPPORT_CASE' | 'FRAUD_REVIEW' | 'OTHER'

export interface ExplorerFilters {
    view: ExplorerView
    range: RangePreset
    customFrom: string | null
    customTo: string | null
    providers: string[]
    methods: string[]
    rails: string[]
    kinds: string[]
    assets: string[]
    chains: string[]
    states: MovementState[]
    directions: RelationshipDirection[]
    infrastructure: InfrastructureMode
    focus: string | null
}

export interface ExplorerRequest {
    from: string
    to: string
    providers: string[]
    methods: string[]
    rails: string[]
    kinds: string[]
    assets: string[]
    chains: string[]
    states: MovementState[]
    directions: RelationshipDirection[]
    includeHubs: boolean
    limit: number
    focus: string | null
}

export interface ExplorerFacet {
    value: string
    label: string
    observedCount: number
    configured: boolean
    isActive: boolean
}

export interface ExplorerAssetFacet extends ExplorerFacet {
    displayCode: string
    decimals: number
    chainId: string | null
}

export interface ExplorerAssetAmount {
    code: string
    displayCode: string
    decimals: number
    chainId: string | null
    paymentCount: number
    nativeAmount: string
}

export interface ExplorerNode {
    id: string
    type: NodeType
    label: string
    labelVisibility: LabelVisibility
    paymentCount: number
    overlayCount: number
    assets: ExplorerAssetAmount[]
    revealToken?: string
}

export interface RelationshipAsset {
    code: string
    displayCode: string
    decimals: number
    chainId: string | null
}

export interface ExplorerRelationship {
    id: string
    source: string
    target: string
    provider: string
    method: string
    rail: string
    kind: string
    direction: RelationshipDirection
    state: MovementState
    evidence: 'POSTED_PRINCIPAL' | 'INTENT_STATUS' | 'REVERSAL_ENTRY' | 'REVERSED_PRINCIPAL'
    timeBasis: 'COMPLETED_AT' | 'CREATED_AT' | 'STATUS_EVENT_AT' | 'ENTRY_EFFECTIVE_AT'
    asset: RelationshipAsset | null
    count: number
    settledPaymentCount: number
    nativeAmount: string | null
    overlayNativeAmount: string | null
    firstAt: string
    lastAt: string
    bidirectional: boolean
    infrastructureHubId?: string
}

export interface ExplorerSampling {
    strategy: 'FULL' | 'TOP_N'
    fullGraphEligible: boolean
    reason: string
    truncated: boolean
    requestedLimit: number
    effectiveLimit: number
    totalNodes: number
    returnedNodes: number
    totalRelationships: number
    returnedRelationships: number
    matchedSettledEventCount: number
    returnedSettledEventCount: number
}

export interface MissingPrincipal {
    provider: string
    kind: string
    method: string
    rail: string
    count: number
}

export interface ExplorerCoverage {
    health: 'HEALTHY' | 'DEGRADED'
    settledMovementCount: number
    overlayEventCount: number
    overlayPostedMovementCount: number
    unclassifiedEventCount: number
    missingPrincipal: MissingPrincipal[]
}

export interface ExplorerMeta {
    from: string
    to: string
    generatedAt: string
    filters: Record<string, unknown>
    sampling: ExplorerSampling
    coverage: ExplorerCoverage
    focus: { nodeId: string; outsideWindowIncluded: boolean } | null
}

export interface ExplorerFacets {
    providers: ExplorerFacet[]
    methods: ExplorerFacet[]
    rails: ExplorerFacet[]
    kinds: ExplorerFacet[]
    assets: ExplorerAssetFacet[]
    chains: ExplorerFacet[]
    states: ExplorerFacet[]
    directions: ExplorerFacet[]
}

export interface PaymentNetworkResponse {
    contractVersion: typeof PAYMENT_NETWORK_CONTRACT
    meta: ExplorerMeta
    facets: ExplorerFacets
    nodes: ExplorerNode[]
    relationships: ExplorerRelationship[]
}

export interface ExplorerSession {
    contractVersion: typeof PAYMENT_NETWORK_CONTRACT
    expiresAt: string
    canReveal: boolean
}

export interface FocusResponse {
    contractVersion: typeof PAYMENT_NETWORK_CONTRACT
    focusToken: string
    expiresAt: string
}

export interface RevealResponse {
    contractVersion: typeof PAYMENT_NETWORK_CONTRACT
    nodeId: string
    label: string
    expiresAt: string
}

export type ExplorerSelection =
    | { type: 'node'; node: ExplorerNode }
    | { type: 'relationship'; relationship: ExplorerRelationship }
    | null
