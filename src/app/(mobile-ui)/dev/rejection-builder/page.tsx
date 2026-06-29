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
import NavHeader from '@/components/Global/NavHeader'
import CardRejectionScreen from '@/components/Card/CardRejectionScreen'
import type { RejectionMascot } from '@/components/Card/share-asset/shareAsset.types'

const MASCOTS: ReadonlyArray<[RejectionMascot, string]> = [
    ['none', 'none'],
    ['cool', 'cool (shades)'],
    ['mock', 'mock (point + laugh)'],
    ['chill', 'chill (whistling)'],
]

export default function RejectionBuilderPage() {
    const [username, setUsername] = useState('kkonrad')
    const [mascot, setMascot] = useState<RejectionMascot>('cool')
    const [applicants, setApplicants] = useState(213)
    const [admitted, setAdmitted] = useState(7)
    const [alreadyJoined, setAlreadyJoined] = useState(false)

    return (
        <div className="flex min-h-screen flex-col">
            <NavHeader title="Rejection screen builder" />

            <div className="flex flex-1 flex-col gap-8 px-6 py-6 lg:flex-row">
                {/* ─── LEFT: Controls ──────────────────────────────────── */}
                <aside className="flex flex-col gap-6 lg:w-[360px] lg:flex-shrink-0">
                    <Section title="Identity">
                        <Field label={`Username (${username.length})`}>
                            <input
                                type="text"
                                value={username}
                                maxLength={20}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="custom-input"
                                placeholder="kkonrad"
                            />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                            <PresetButton onClick={() => setUsername('me')}>2-char</PresetButton>
                            <PresetButton onClick={() => setUsername('kkonrad')}>kkonrad</PresetButton>
                            <PresetButton onClick={() => setUsername('thisistwentyplus_chars')}>20+ chars</PresetButton>
                        </div>
                    </Section>

                    <Section title="Bouncer mascot (asset, left side)">
                        <div className="flex flex-wrap gap-2">
                            {MASCOTS.map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setMascot(key)}
                                    className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold transition-colors ${
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
                    </Section>

                    <Section title="Door tally (screen copy, not on asset)">
                        <Field label={`Applicants tonight (${applicants})`}>
                            <input
                                type="range"
                                min={20}
                                max={5000}
                                step={1}
                                value={applicants}
                                onChange={(e) => setApplicants(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Admitted (${admitted})`}>
                            <input
                                type="range"
                                min={1}
                                max={50}
                                step={1}
                                value={admitted}
                                onChange={(e) => setAdmitted(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                            <PresetButton
                                onClick={() => {
                                    setApplicants(213)
                                    setAdmitted(7)
                                }}
                            >
                                213 / 7
                            </PresetButton>
                            <PresetButton
                                onClick={() => {
                                    setApplicants(1842)
                                    setAdmitted(11)
                                }}
                            >
                                1842 / 11
                            </PresetButton>
                        </div>
                    </Section>

                    <Section title="Waitlist state">
                        <button
                            onClick={() => setAlreadyJoined((v) => !v)}
                            className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold transition-colors ${
                                alreadyJoined ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1 hover:bg-grey-2'
                            }`}
                        >
                            {alreadyJoined ? 'already joined ✓' : 'not joined yet'}
                        </button>
                        <p className="text-[11px] leading-snug text-grey-1">
                            Toggles the post-join state: “Join anyway” becomes an “on the list” confirmation while the
                            asset + “Tweet to appeal” stay.
                        </p>
                    </Section>
                </aside>

                {/* ─── RIGHT: Phone-frame preview of the whole screen ──── */}
                <main className="flex flex-1 flex-col items-center gap-4">
                    <div className="self-stretch rounded-sm border border-n-1 bg-grey-3 p-2 text-center font-mono text-xs text-grey-1">
                        mobile screen · CardRejectionScreen
                    </div>
                    <div
                        className="shadow-4 w-full max-w-[392px] overflow-hidden rounded-[28px] border-2 border-n-1 bg-white"
                        style={{ height: 800 }}
                    >
                        <div className="flex h-full flex-col px-5 py-4" style={{ minHeight: 740 }}>
                            <CardRejectionScreen
                                username={username || 'anon'}
                                mascot={mascot}
                                applicants={applicants}
                                admitted={admitted}
                                alreadyJoined={alreadyJoined}
                                onJoined={() => setAlreadyJoined(true)}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

// ─── Small UI primitives ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="shadow-4 rounded-sm border-2 border-n-1 bg-white p-4">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-grey-1">{title}</h2>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-grey-1">{label}</span>
            {children}
        </label>
    )
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="rounded-full border border-n-1 bg-white px-2 py-1 text-xs font-bold transition-colors hover:bg-grey-2"
        >
            {children}
        </button>
    )
}
