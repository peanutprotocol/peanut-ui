'use client'

import { Card } from '@/components/0_Bruddle/Card'
import BoardGroup from './BoardGroup'
import EmailCard from './EmailCard'
import PushCard from './PushCard'
import SurfaceCard from './SurfaceCard'
import { FUNNEL_STATES, IN_APP_SURFACES } from './journeyData'
import type { JourneySpec, JourneyViewMode } from './journeyTypes'

const EMPTY_NOTE = 'text-body-xs italic leading-snug text-foreground-secondary'

/**
 * The column-per-funnel-state board: in-app surfaces (static catalog from
 * journeyData) + emails/push (live from the API spec) stacked per state.
 */
export default function JourneyBoard({
    spec,
    specError,
    view,
    isReviewed,
    onOpenEmail,
}: {
    spec: JourneySpec | null
    specError: string | null
    view: JourneyViewMode
    isReviewed: (id: string) => boolean
    onOpenEmail: (eventType: string, example: number) => void
}) {
    const showDev = view === 'dev'
    const mappedStageNames = new Set(FUNNEL_STATES.flatMap((s) => s.specStages))
    const unmappedStages = spec ? spec.stages.filter((st) => !mappedStageNames.has(st.stage)) : []

    return (
        <div className="flex flex-col gap-2">
            <p className="text-body-xs text-foreground-secondary">
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
                                <Card key={state.id} className="w-80 shrink-0 overflow-hidden">
                                    <header className="bg-background-default p-3">
                                        <div className="text-label-l">
                                            {i + 1}. {state.label}
                                        </div>
                                        <p className="mt-0.5 text-body-xs leading-snug text-foreground-secondary">
                                            {state.description}
                                        </p>
                                    </header>

                                    <BoardGroup
                                        icon="home"
                                        label="in-app"
                                        count={surfaces.length}
                                        tint="bg-background-default"
                                    >
                                        {surfaces.map((surface) => (
                                            <SurfaceCard key={surface.id} surface={surface} showDev={showDev} />
                                        ))}
                                        {surfaces.length === 0 && (
                                            <p className={EMPTY_NOTE}>No activation-specific surface.</p>
                                        )}
                                    </BoardGroup>

                                    <BoardGroup
                                        icon="docs"
                                        label="emails"
                                        count={emailCount}
                                        tint="bg-background-badge-accent/20"
                                    >
                                        {specError && <p className={EMPTY_NOTE}>{specError}</p>}
                                        {spec && state.includesWelcome && (
                                            <>
                                                <p className="text-body-xs leading-snug text-foreground-secondary italic">
                                                    On signup (immediate):
                                                </p>
                                                <EmailCard
                                                    step={spec.welcome}
                                                    showDev={showDev}
                                                    isReviewed={isReviewed}
                                                    onOpen={onOpenEmail}
                                                />
                                            </>
                                        )}
                                        {stages.map((stage) => (
                                            <div key={stage.stage} className="flex flex-col gap-2">
                                                {showDev && (
                                                    <p className="text-body-xs leading-snug text-foreground-secondary italic">
                                                        stage{' '}
                                                        <span className="font-mono text-label-m">{stage.stage}</span> —{' '}
                                                        {stage.predicate}
                                                    </p>
                                                )}
                                                {stage.steps.map((step) => (
                                                    <EmailCard
                                                        key={step.type}
                                                        step={step}
                                                        showDev={showDev}
                                                        isReviewed={isReviewed}
                                                        onOpen={onOpenEmail}
                                                    />
                                                ))}
                                            </div>
                                        ))}
                                        {spec && stages.length === 0 && !state.includesWelcome && (
                                            <p className={EMPTY_NOTE}>
                                                {state.noEmailReason ?? 'No lifecycle email in this state.'}
                                            </p>
                                        )}
                                    </BoardGroup>

                                    <BoardGroup
                                        icon="bell"
                                        label="push"
                                        count={pushCount}
                                        tint="bg-action-secondary/20"
                                    >
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
                                </Card>
                            )
                        })}

                        {unmappedStages.length > 0 && (
                            <Card className="w-80 shrink-0 bg-action-secondary/40 p-3">
                                <div className="text-label-l">Unmapped spec stages</div>
                                <p className="mt-1 text-body-xs leading-snug text-foreground-secondary">
                                    The API spec reports stages this board doesn&apos;t map to a column yet
                                    {showDev ? ' — update FUNNEL_STATES.specStages in journeyData.ts:' : ':'}
                                </p>
                                <p className="mt-1 font-mono text-body-xs">
                                    {unmappedStages.map((s) => s.stage).join(', ')}
                                </p>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
