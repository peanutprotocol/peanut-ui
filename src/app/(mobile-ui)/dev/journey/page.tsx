'use client'

import NavHeader from '@/components/Global/NavHeader'
import JourneyBoard from './JourneyBoard'
import RulesLegend from './RulesLegend'
import FindingsStrip from './FindingsStrip'
import UserInspector from './UserInspector'
import { useJourneySpec } from './useJourneySpec'

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

    return (
        <div className="flex w-full flex-col gap-6 pb-8">
            <NavHeader title="Activation Journey" />

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-grey-1">Email-machine rules</h2>
                <RulesLegend rules={spec?.rules ?? null} specError={loading ? null : error} />
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-grey-1">Journey board</h2>
                <JourneyBoard spec={spec} specError={loading ? 'Loading spec…' : error} />
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-grey-1">
                    Findings — real product issues
                </h2>
                <FindingsStrip />
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-grey-1">User inspector</h2>
                <UserInspector />
            </section>
        </div>
    )
}
