'use client'

import { parseAsStringEnum, useQueryState } from 'nuqs'
import DevPageShell from '../_components/DevPageShell'
import DevSectionLabel from '../_components/DevSectionLabel'
import FindingsStrip from './FindingsStrip'
import JourneyBoard from './JourneyBoard'
import KindLegend from './KindLegend'
import RulesLegend from './RulesLegend'
import UserInspector from './UserInspector'
import ViewModeToggle from './ViewModeToggle'
import { useJourneySpec } from './useJourneySpec'
import type { JourneyViewMode } from './journeyTypes'

/**
 * /dev/journey — Activation Journey Explorer.
 *
 * Per funnel state: everything a user sees in-app (static catalog, transcribed
 * from the journey UI inventory with source-file annotations) AND every
 * email/push the lifecycle machine sends (fetched LIVE from the sandbox API's
 * __dev/journey-spec endpoint, api PR #1234). Internal tool; desktop-ok.
 */
export default function JourneyExplorerPage() {
    const { spec, error, loading } = useJourneySpec()
    const [view, setView] = useQueryState(
        'view',
        parseAsStringEnum<JourneyViewMode>(['product', 'dev']).withDefault('product')
    )
    const showDev = view === 'dev'

    return (
        <DevPageShell
            title="Activation Journey"
            description="Every surface a user meets on the way to their first payment — what the app shows them, and what the lifecycle machine sends them — one column per funnel state."
            actions={<ViewModeToggle value={view} onChange={(next) => void setView(next)} />}
        >
            <section className="flex flex-col gap-2">
                <DevSectionLabel>Email-machine rules</DevSectionLabel>
                <RulesLegend rules={spec?.rules ?? null} specError={loading ? null : error} />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>In-app surface kinds</DevSectionLabel>
                <KindLegend />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>Journey board</DevSectionLabel>
                <JourneyBoard spec={spec} specError={loading ? 'Loading spec…' : error} view={view} />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>Findings — real product issues</DevSectionLabel>
                <FindingsStrip showDev={showDev} />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>User inspector</DevSectionLabel>
                <UserInspector />
            </section>
        </DevPageShell>
    )
}
