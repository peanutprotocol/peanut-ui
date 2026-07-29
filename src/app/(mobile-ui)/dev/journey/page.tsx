'use client'

import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from 'nuqs'
import { useCallback, useMemo } from 'react'
import DevPageShell from '../_components/DevPageShell'
import DevSectionLabel from '../_components/DevSectionLabel'
import EmailPreviewPanel from './EmailPreviewPanel'
import FindingsStrip from './FindingsStrip'
import JourneyBoard from './JourneyBoard'
import KindLegend from './KindLegend'
import ReviewProgressStrip from './ReviewProgressStrip'
import RulesLegend from './RulesLegend'
import UserInspector from './UserInspector'
import ViewModeToggle from './ViewModeToggle'
import { buildEmailRenderList, renderId } from './emailReview'
import { countReviewed } from './copyReviewStorage'
import { useCopyReview } from './useCopyReview'
import { useJourneySpec } from './useJourneySpec'
import type { JourneyViewMode } from './journeyTypes'

/**
 * /dev/journey — Activation Journey Explorer.
 *
 * Per funnel state: everything a user sees in-app (static catalog, transcribed
 * from the journey UI inventory with source-file annotations) AND every
 * email/push the lifecycle machine sends (fetched LIVE from the sandbox API's
 * __dev/journey-spec endpoint, api PR #1234). Internal tool; desktop-ok.
 *
 * Also the copy-review surface: every email render is read in place (iframed
 * from the API) and carries a verdict, counted in the progress strip above the
 * board. The selected render lives in the URL (`?email=…&example=…`) so one
 * email is shareable mid-review.
 */
export default function JourneyExplorerPage() {
    const { spec, error, loading } = useJourneySpec()
    const [view, setView] = useQueryState(
        'view',
        parseAsStringEnum<JourneyViewMode>(['product', 'dev']).withDefault('product')
    )
    const [preview, setPreview] = useQueryStates({
        email: parseAsString,
        example: parseAsInteger.withDefault(0),
    })
    const { isReviewed, toggle, reset, state } = useCopyReview()
    const showDev = view === 'dev'

    const renders = useMemo(() => buildEmailRenderList(spec), [spec])
    const checkedCount = countReviewed(
        state,
        renders.map((render) => render.id)
    )
    const activeIndex = preview.email
        ? renders.findIndex((render) => render.id === renderId(preview.email as string, preview.example))
        : -1

    const openEmail = useCallback(
        (eventType: string, example: number) => void setPreview({ email: eventType, example }),
        [setPreview]
    )
    const selectIndex = useCallback(
        (index: number) => {
            const next = renders[index]
            if (next) void setPreview({ email: next.eventType, example: next.example })
        },
        [renders, setPreview]
    )
    const closePreview = useCallback(() => void setPreview({ email: null, example: null }), [setPreview])

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
                <ReviewProgressStrip checked={checkedCount} total={renders.length} onReset={reset} />
                <p className="text-[11px] leading-snug text-grey-1">
                    Every email card with an amber dashed border still needs a product verdict. Click one to read the
                    real render, then tick <span className="font-bold">Mark reviewed</span>. Two of them also carry a{' '}
                    <span className="font-bold">decide:</span> chip — those need a keep-or-kill call, not only a copy
                    read.
                </p>
                <JourneyBoard
                    spec={spec}
                    specError={loading ? 'Loading spec…' : error}
                    view={view}
                    isReviewed={isReviewed}
                    onOpenEmail={openEmail}
                />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>Findings — real product issues</DevSectionLabel>
                <FindingsStrip showDev={showDev} />
            </section>

            <section className="flex flex-col gap-2">
                <DevSectionLabel>User inspector</DevSectionLabel>
                <UserInspector />
            </section>

            {activeIndex >= 0 && (
                <EmailPreviewPanel
                    renders={renders}
                    activeIndex={activeIndex}
                    isReviewed={isReviewed}
                    onToggleReviewed={toggle}
                    onSelect={selectIndex}
                    onClose={closePreview}
                />
            )}
        </DevPageShell>
    )
}
