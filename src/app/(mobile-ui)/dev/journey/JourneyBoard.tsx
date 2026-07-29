'use client'

import BoardGroup from './BoardGroup'
import EmailCard from './EmailCard'
import PushCard from './PushCard'
import SurfaceCard from './SurfaceCard'
import { FUNNEL_STATES, IN_APP_SURFACES } from './journeyData'
import type { JourneySpec, JourneyViewMode } from './journeyTypes'

const EMPTY_NOTE = 'text-[11px] italic leading-snug text-grey-1'

/**
 * The column-per-funnel-state board: in-app surfaces (static catalog from
 * journeyData) + emails/push (live from the API spec) stacked per state.
 */
export default function JourneyBoard({
    spec,
    specError,
    view,
}: {
    spec: JourneySpec | null
    specError: string | null
    view: JourneyViewMode
}) {
    const showDev = view === 'dev'
    const mappedStageNames = new Set(FUNNEL_STATES.flatMap((s) => s.specStages))
    const unmappedStages = spec ? spec.stages.filter((st) => !mappedStageNames.has(st.stage)) : []

    return (
        <div className="flex flex-col gap-2">
            <p className="text-[11px] text-grey-1">
                {FUNNEL_STATES.length} funnel states, left to right — scroll sideways to reach the last one →
            </p>

            <div className="relative">
                <div className="overflow-x-auto pb-3">
                    <div className="flex w-max items-start gap-3 pr-12">
                        {FUNNEL_STATES.map((state, i) => {
                            const surfaces = IN_APP_SURFACES.filter((s) => s.states.includes(state.id))
                            const stages = spec ? spec.stages.filter((st) => state.specStages.includes(st.stage)) : []
                            const emailCount =
                                stages.reduce((total, stage) => total + stage.steps.length, 0) +
                                (spec && state.includesWelcome ? 1 : 0)
                            const pushCount = spec && state.includesPushReminder ? spec.pushReminders.length : 0

                            return (
                                <div
                                    key={state.id}
                                    className="flex w-80 shrink-0 flex-col overflow-hidden rounded-sm border border-n-1 bg-white"
                                >
                                    <header className="bg-white p-3">
                                        <div className="text-sm font-bold">
                                            {i + 1}. {state.label}
                                        </div>
                                        <p className="mt-0.5 text-[11px] leading-snug text-grey-1">
                                            {state.description}
                                        </p>
                                    </header>

                                    <BoardGroup icon="🏠" label="in-app" count={surfaces.length} tint="bg-white">
                                        {surfaces.map((surface) => (
                                            <SurfaceCard key={surface.id} surface={surface} showDev={showDev} />
                                        ))}
                                        {surfaces.length === 0 && (
                                            <p className={EMPTY_NOTE}>No activation-specific surface.</p>
                                        )}
                                    </BoardGroup>

                                    <BoardGroup icon="✉️" label="emails" count={emailCount} tint="bg-primary-3/50">
                                        {specError && <p className={EMPTY_NOTE}>{specError}</p>}
                                        {spec && state.includesWelcome && (
                                            <>
                                                <p className="text-[10px] italic leading-snug text-grey-1">
                                                    On signup (immediate):
                                                </p>
                                                <EmailCard step={spec.welcome} showDev={showDev} />
                                            </>
                                        )}
                                        {stages.map((stage) => (
                                            <div key={stage.stage} className="flex flex-col gap-1.5">
                                                {showDev && (
                                                    <p className="text-[10px] italic leading-snug text-grey-1">
                                                        stage <span className="font-mono font-bold">{stage.stage}</span>{' '}
                                                        — {stage.predicate}
                                                    </p>
                                                )}
                                                {stage.steps.map((step) => (
                                                    <EmailCard key={step.type} step={step} showDev={showDev} />
                                                ))}
                                            </div>
                                        ))}
                                        {spec && stages.length === 0 && !state.includesWelcome && (
                                            <p className={EMPTY_NOTE}>
                                                {state.noEmailReason ?? 'No lifecycle email in this state.'}
                                            </p>
                                        )}
                                    </BoardGroup>

                                    <BoardGroup icon="📳" label="push" count={pushCount} tint="bg-yellow-1/20">
                                        {specError && <p className={EMPTY_NOTE}>{specError}</p>}
                                        {spec &&
                                            (state.includesPushReminder ? (
                                                spec.pushReminders.map((push) => (
                                                    <PushCard key={push.type} push={push} showDev={showDev} />
                                                ))
                                            ) : (
                                                <p className={EMPTY_NOTE}>No push in this state.</p>
                                            ))}
                                    </BoardGroup>
                                </div>
                            )
                        })}

                        {unmappedStages.length > 0 && (
                            <div className="w-80 shrink-0 rounded-sm border border-n-1 bg-yellow-1/40 p-3">
                                <div className="text-sm font-bold">Unmapped spec stages</div>
                                <p className="mt-1 text-[11px] leading-snug text-grey-1">
                                    The API spec reports stages this board doesn&apos;t map to a column yet
                                    {showDev ? ' — update FUNNEL_STATES.specStages in journeyData.ts:' : ':'}
                                </p>
                                <p className="mt-1 font-mono text-[11px]">
                                    {unmappedStages.map((s) => s.stage).join(', ')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scroll affordance: the last column is otherwise silently cut off. */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
            </div>
        </div>
    )
}
