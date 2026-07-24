'use client'

import { FUNNEL_STATES, IN_APP_SURFACES } from './journeyData'
import type { JourneySpec } from './journeyTypes'
import SurfaceCard from './SurfaceCard'
import EmailCard from './EmailCard'

function GroupHeader({ emoji, label }: { emoji: string; label: string }) {
    return (
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-grey-1">
            {emoji} {label}
        </div>
    )
}

/**
 * The column-per-funnel-state board: in-app surfaces (static catalog from
 * journeyData) + emails/push (live from the API spec) stacked per state.
 */
export default function JourneyBoard({ spec, specError }: { spec: JourneySpec | null; specError: string | null }) {
    const mappedStageNames = new Set(FUNNEL_STATES.flatMap((s) => s.specStages))
    const unmappedStages = spec ? spec.stages.filter((st) => !mappedStageNames.has(st.stage)) : []

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex w-max gap-3">
                {FUNNEL_STATES.map((state, i) => {
                    const surfaces = IN_APP_SURFACES.filter((s) => s.states.includes(state.id))
                    const stages = spec ? spec.stages.filter((st) => state.specStages.includes(st.stage)) : []
                    return (
                        <div key={state.id} className="w-72 shrink-0 rounded-sm border border-n-1 bg-primary-3/40">
                            <div className="border-b border-n-1 bg-white p-2.5">
                                <div className="text-sm font-bold">
                                    {i + 1}. {state.label}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-grey-1">{state.description}</p>
                            </div>
                            <div className="flex flex-col gap-1.5 p-2">
                                <GroupHeader emoji="🏠" label="in-app" />
                                {surfaces.map((surface) => (
                                    <SurfaceCard key={surface.id} surface={surface} />
                                ))}
                                {surfaces.length === 0 && (
                                    <p className="text-[11px] italic text-grey-1">No activation-specific surface.</p>
                                )}

                                <GroupHeader emoji="✉️" label="emails" />
                                {specError && <p className="text-[11px] italic text-grey-1">{specError}</p>}
                                {spec && state.includesWelcome && (
                                    <>
                                        <p className="text-[10px] italic leading-snug text-grey-1">
                                            On signup (immediate):
                                        </p>
                                        <EmailCard step={spec.welcome} />
                                    </>
                                )}
                                {stages.map((stage) => (
                                    <div key={stage.stage} className="flex flex-col gap-1.5">
                                        <p className="text-[10px] italic leading-snug text-grey-1">
                                            stage <span className="font-mono font-bold">{stage.stage}</span> —{' '}
                                            {stage.predicate}
                                        </p>
                                        {stage.steps.map((step) => (
                                            <EmailCard key={step.type} step={step} />
                                        ))}
                                    </div>
                                ))}
                                {spec && stages.length === 0 && !state.includesWelcome && (
                                    <p className="text-[11px] italic text-grey-1">
                                        {state.noEmailReason ?? 'No lifecycle email in this state.'}
                                    </p>
                                )}

                                <GroupHeader emoji="📳" label="push" />
                                {specError && <p className="text-[11px] italic text-grey-1">{specError}</p>}
                                {spec &&
                                    (state.includesPushReminder ? (
                                        spec.pushReminders.map((push) => (
                                            <div
                                                key={push.type}
                                                className="rounded-sm border border-n-1 bg-white p-2.5"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="text-xs font-bold leading-tight">{push.title}</div>
                                                    <span className="shrink-0 rounded-sm border border-n-1 bg-yellow-1 px-1 py-0.5 text-[9px] font-bold">
                                                        after {push.afterMinutes}min
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[10px] leading-snug text-grey-1">{push.note}</p>
                                                <p className="mt-1.5 font-mono text-[9px] leading-tight text-grey-1">
                                                    {push.type} · {push.channels.join(' + ')}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] italic text-grey-1">—</p>
                                    ))}
                            </div>
                        </div>
                    )
                })}
                {unmappedStages.length > 0 && (
                    <div className="w-72 shrink-0 rounded-sm border border-n-1 bg-yellow-1/40 p-2.5">
                        <div className="text-sm font-bold">Unmapped spec stages</div>
                        <p className="mt-1 text-[11px] text-grey-1">
                            The API spec reports stages this board doesn&apos;t map to a column yet — update
                            FUNNEL_STATES.specStages in journeyData.ts:
                        </p>
                        <p className="mt-1 font-mono text-[11px]">{unmappedStages.map((s) => s.stage).join(', ')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
