'use client'

/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */

import { useMemo, useState } from 'react'
import { formatBaseUnitAmount } from './format'
import { nodeIndex, relationshipsForNode } from './selectors'
import RelationshipDetails from './RelationshipDetails'
import type { ExplorerNode, ExplorerRelationship, ExplorerSelection, RevealReason, RevealResponse } from './types'

interface InspectorProps {
    selection: ExplorerSelection
    nodes: readonly ExplorerNode[]
    relationships: readonly ExplorerRelationship[]
    canReveal: boolean
    revealing: boolean
    revealed: RevealResponse | null
    onReveal: (node: ExplorerNode, reason: RevealReason) => Promise<void>
    onSelectRelationship: (relationship: ExplorerRelationship) => void
    onClear: () => void
}

const REVEAL_REASONS: Array<{ value: RevealReason; label: string }> = [
    { value: 'INVESTIGATION', label: 'Investigation' },
    { value: 'SUPPORT_CASE', label: 'Support case' },
    { value: 'FRAUD_REVIEW', label: 'Fraud review' },
    { value: 'OTHER', label: 'Other' },
]

export default function Inspector({
    selection,
    nodes,
    relationships,
    canReveal,
    revealing,
    revealed,
    onReveal,
    onSelectRelationship,
    onClear,
}: InspectorProps) {
    const [reason, setReason] = useState<RevealReason | ''>('')
    const [revealError, setRevealError] = useState<string | null>(null)
    const nodesById = useMemo(() => nodeIndex(nodes), [nodes])

    if (!selection) {
        return (
            <aside className="min-h-0 border-l border-n-1 bg-white p-4" aria-label="Inspector">
                <h2 className="text-sm font-bold">Inspector</h2>
                <p className="mt-3 text-xs text-grey-1">Select a node or relationship.</p>
            </aside>
        )
    }

    const heading = selection.type === 'node' ? 'Node' : 'Relationship'

    return (
        <aside className="min-h-0 overflow-y-auto border-l border-n-1 bg-white p-4" aria-label={`${heading} inspector`}>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold">{heading}</h2>
                <button type="button" onClick={onClear} className="text-xs font-semibold underline">
                    Clear
                </button>
            </div>

            {selection.type === 'node' ? (
                <>
                    <div className="rounded-sm border border-n-1 bg-[#fcfaf7] p-3">
                        <p className="break-words text-base font-bold">
                            {revealed?.nodeId === selection.node.id ? revealed.label : selection.node.label}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-grey-1">
                            {selection.node.type} · {selection.node.labelVisibility.toLowerCase()}
                        </p>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <dt className="text-grey-1">Payments</dt>
                                <dd className="font-bold tabular-nums">
                                    {selection.node.paymentCount.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-grey-1">Overlays</dt>
                                <dd className="font-bold tabular-nums">
                                    {selection.node.overlayCount.toLocaleString()}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {selection.node.assets.length > 0 && (
                        <section className="mt-4" aria-labelledby="native-buckets-heading">
                            <h3
                                id="native-buckets-heading"
                                className="text-xs font-bold uppercase tracking-wide text-grey-1"
                            >
                                Native asset buckets
                            </h3>
                            <ul className="mt-2 space-y-2">
                                {selection.node.assets.map((asset) => (
                                    <li
                                        key={`${asset.code}:${asset.chainId ?? ''}`}
                                        className="rounded-sm bg-[#f3efe9] p-2 text-xs"
                                    >
                                        <span className="font-mono font-bold">
                                            {formatBaseUnitAmount(asset.nativeAmount, asset)}
                                        </span>
                                        <span className="ml-2 text-grey-1">
                                            {asset.paymentCount.toLocaleString()} settled
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {canReveal &&
                        selection.node.labelVisibility === 'PSEUDONYMOUS' &&
                        selection.node.revealToken &&
                        revealed?.nodeId !== selection.node.id && (
                            <form
                                className="mt-4 rounded-sm border border-n-1 bg-yellow-1 p-3"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    if (!reason || !selection.node.revealToken) return
                                    setRevealError(null)
                                    void onReveal(selection.node, reason).catch(() =>
                                        setRevealError(
                                            'Identity could not be revealed. Try again or check your access.'
                                        )
                                    )
                                }}
                            >
                                <label className="block text-xs font-bold">
                                    Reveal reason
                                    <select
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value as RevealReason | '')}
                                        className="mt-1 h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs"
                                    >
                                        <option value="">Select a reason</option>
                                        {REVEAL_REASONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    type="submit"
                                    disabled={!reason || revealing}
                                    className="mt-2 w-full rounded-sm border border-n-1 bg-white px-2 py-1.5 text-xs font-bold shadow-[2px_2px_0_#000] disabled:opacity-40"
                                >
                                    {revealing ? 'Verifying…' : 'Verify & reveal'}
                                </button>
                                <p className="mt-2 text-[11px] text-grey-1">
                                    Passkey required · reveal is audited · expires in 5m
                                </p>
                                {revealError && (
                                    <p role="alert" className="mt-2 text-xs font-semibold text-red">
                                        {revealError}
                                    </p>
                                )}
                            </form>
                        )}

                    <section className="mt-4" aria-labelledby="connections-heading">
                        <h3 id="connections-heading" className="text-xs font-bold uppercase tracking-wide text-grey-1">
                            Connections
                        </h3>
                        <ul className="mt-2 space-y-1">
                            {relationshipsForNode(relationships, selection.node.id)
                                .slice(0, 100)
                                .map((relationship) => {
                                    const otherId =
                                        relationship.source === selection.node.id
                                            ? relationship.target
                                            : relationship.source
                                    return (
                                        <li key={relationship.id}>
                                            <button
                                                type="button"
                                                onClick={() => onSelectRelationship(relationship)}
                                                className="flex w-full items-center justify-between gap-2 rounded-sm border border-n-1/20 px-2 py-1.5 text-left text-xs hover:bg-primary-3/20"
                                            >
                                                <span className="min-w-0 truncate font-semibold">
                                                    {nodesById.get(otherId)?.label ?? otherId}
                                                </span>
                                                <span className="shrink-0 text-grey-1">
                                                    {relationship.count.toLocaleString()}
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                        </ul>
                    </section>
                </>
            ) : (
                <RelationshipDetails relationship={selection.relationship} nodes={nodesById} />
            )}
        </aside>
    )
}
