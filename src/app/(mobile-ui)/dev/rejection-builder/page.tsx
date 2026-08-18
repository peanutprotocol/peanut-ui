'use client'

/**
 * /dev/rejection-builder — iterator for the full mobile rejection screen
 * (CardRejectionScreen): the "not tonight, <username>" asset + the scarcity
 * explainer copy + the "Tweet to appeal" CTA, previewed inside a phone frame.
 *
 * Knobs feed the whole screen so we can dial in the copy, the door tally, and
 * which smug peanut bouncer shows on the asset. "Tweet to appeal" fires the
 * real share path with a random caption (rejectionCaptions.ts).
 */

import { useState } from 'react'
import CardRejectionScreen from '@/components/Card/CardRejectionScreen'
import { computeDoorTally } from '@/components/Card/doorTally.utils'
import type { RejectionMascot } from '@/components/Card/share-asset/shareAsset.types'
import DevField from '../_components/DevField'
import DevPageShell from '../_components/DevPageShell'
import DevPanel from '../_components/DevPanel'
import DevPresetButton from '../_components/DevPresetButton'

const MASCOTS: ReadonlyArray<[RejectionMascot, string]> = [
    ['none', 'none'],
    ['cool', 'cool (shades)'],
    ['mock', 'mock (point + laugh)'],
    ['chill', 'chill (whistling)'],
]

export default function RejectionBuilderPage() {
    const [username, setUsername] = useState('kkonrad')
    const [mascot, setMascot] = useState<RejectionMascot>('cool')
    // The REAL backend counts (waitlistTotal / admittedTotal). The screen
    // inflates "tried" for FOMO; the readout below shows what it renders.
    const [waitlistTotal, setWaitlistTotal] = useState(120)
    const [admittedTotal, setAdmittedTotal] = useState(7)
    const [alreadyJoined, setAlreadyJoined] = useState(false)

    const tally = computeDoorTally(waitlistTotal, admittedTotal)

    return (
        <DevPageShell
            title="Rejection screen builder"
            description="Dial in the /card waitlist rejection screen — bouncer mascot, door tally, waitlist state — against a live phone-frame preview."
        >
            <div className="flex flex-col gap-8 lg:flex-row">
                {/* ─── LEFT: Controls ──────────────────────────────────── */}
                <aside className="flex flex-col gap-6 lg:w-[360px] lg:flex-shrink-0">
                    <DevPanel title="Identity">
                        <DevField label={`Username (${username.length})`}>
                            <input
                                type="text"
                                value={username}
                                maxLength={20}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="custom-input"
                                placeholder="kkonrad"
                            />
                        </DevField>
                        <div className="flex flex-wrap gap-2">
                            <DevPresetButton onClick={() => setUsername('me')}>2-char</DevPresetButton>
                            <DevPresetButton onClick={() => setUsername('kkonrad')}>kkonrad</DevPresetButton>
                            <DevPresetButton onClick={() => setUsername('thisistwentyplus_chars')}>
                                20+ chars
                            </DevPresetButton>
                        </div>
                    </DevPanel>

                    <DevPanel title="Bouncer mascot (asset, left side)">
                        <div className="flex flex-wrap gap-2">
                            {MASCOTS.map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setMascot(key)}
                                    className={`rounded-full border-2 border-n-1 px-3 py-1 text-xs font-bold transition-colors ${
                                        mascot === key
                                            ? 'bg-primary-1 text-n-1'
                                            : 'bg-white text-grey-1 hover:bg-grey-2'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] leading-snug text-grey-1">
                            No dedicated “laughing” peanut exists yet — these are the closest mocking/cool poses. Say
                            the word and I’ll generate a true laughing one via the badges pipeline.
                        </p>
                    </DevPanel>

                    <DevPanel title="Door tally — REAL backend counts">
                        <DevField label={`Waitlist size · real cardWaitlistJoinedAt count (${waitlistTotal})`}>
                            <input
                                type="range"
                                min={0}
                                max={5000}
                                step={1}
                                value={waitlistTotal}
                                onChange={(e) => setWaitlistTotal(Number(e.target.value))}
                                className="w-full"
                            />
                        </DevField>
                        <DevField label={`Admitted · real cardAccessGrantedAt count (${admittedTotal})`}>
                            <input
                                type="range"
                                min={0}
                                max={500}
                                step={1}
                                value={admittedTotal}
                                onChange={(e) => setAdmittedTotal(Number(e.target.value))}
                                className="w-full"
                            />
                        </DevField>
                        <p className="rounded-sm border border-n-1 bg-grey-3 p-2 text-center text-xs font-bold text-n-1">
                            renders as:{' '}
                            <span className="text-primary-1">
                                {tally.applicants.toLocaleString('en-US')} tried · {tally.admitted} got in
                            </span>
                            <br />
                            <span className="font-normal text-grey-1">
                                “tried” = waitlist × FOMO multiplier (floored); “got in” = real admitted
                            </span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <DevPresetButton
                                onClick={() => {
                                    setWaitlistTotal(0)
                                    setAdmittedTotal(0)
                                }}
                            >
                                empty (floor)
                            </DevPresetButton>
                            <DevPresetButton
                                onClick={() => {
                                    setWaitlistTotal(120)
                                    setAdmittedTotal(7)
                                }}
                            >
                                early beta
                            </DevPresetButton>
                            <DevPresetButton
                                onClick={() => {
                                    setWaitlistTotal(1842)
                                    setAdmittedTotal(140)
                                }}
                            >
                                busy door
                            </DevPresetButton>
                        </div>
                    </DevPanel>

                    <DevPanel title="Waitlist state">
                        <button
                            onClick={() => setAlreadyJoined((v) => !v)}
                            className={`rounded-full border-2 border-n-1 px-3 py-1 text-xs font-bold transition-colors ${
                                alreadyJoined ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1 hover:bg-grey-2'
                            }`}
                        >
                            {alreadyJoined ? 'already joined ✓' : 'not joined yet'}
                        </button>
                        <p className="text-[11px] leading-snug text-grey-1">
                            Toggles the post-join state: “Join anyway” becomes an “on the list” confirmation while the
                            asset + “Tweet to appeal” stay.
                        </p>
                    </DevPanel>
                </aside>

                {/* ─── RIGHT: Phone-frame preview of the whole screen ──── */}
                <main className="flex flex-1 flex-col items-center gap-4">
                    <div className="self-stretch rounded-sm border border-n-1 bg-grey-3 p-2 text-center font-mono text-xs text-grey-1">
                        mobile screen · CardRejectionScreen
                    </div>
                    <div
                        className="w-full max-w-[392px] overflow-hidden rounded-[28px] border-2 border-n-1 bg-white shadow-4"
                        style={{ height: 800 }}
                    >
                        <div className="flex h-full flex-col px-5 py-4" style={{ minHeight: 740 }}>
                            <CardRejectionScreen
                                username={username || 'anon'}
                                mascot={mascot}
                                waitlistTotal={waitlistTotal}
                                admittedTotal={admittedTotal}
                                alreadyJoined={alreadyJoined}
                                onJoined={() => setAlreadyJoined(true)}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </DevPageShell>
    )
}
