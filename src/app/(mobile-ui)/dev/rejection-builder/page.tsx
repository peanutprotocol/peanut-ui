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
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Field } from '@/components/0_Bruddle/Field'
import { Section } from '@/components/0_Bruddle/Section'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import CardRejectionScreen from '@/components/Card/CardRejectionScreen'
import { computeDoorTally } from '@/components/Card/doorTally.utils'
import type { RejectionMascot } from '@/components/Card/share-asset/shareAsset.types'
import { Slider } from '@/components/Global/Slider'
import DevPageShell from '../_components/DevPageShell'

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
                    <Card className="p-4" shadowSize="4">
                        <Section title="Identity">
                            <Field label={`Username (${username.length})`} htmlFor="rejection-username">
                                <BaseInput
                                    id="rejection-username"
                                    variant="sm"
                                    value={username}
                                    maxLength={20}
                                    onChange={(e) =>
                                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                                    }
                                    placeholder="kkonrad"
                                />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="stroke" size="small" onClick={() => setUsername('me')}>
                                    2-char
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setUsername('kkonrad')}>
                                    kkonrad
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => setUsername('thisistwentyplus_chars')}
                                >
                                    20+ chars
                                </Button>
                            </div>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Bouncer mascot (asset, left side)">
                            <SegmentedControl
                                value={mascot}
                                onChange={(value) => setMascot(value as RejectionMascot)}
                                options={MASCOTS.map(([value, label]) => ({ value, label }))}
                                aria-label="Bouncer mascot"
                                fullWidth
                            />
                            <p className="text-body-xs text-foreground-secondary">
                                No dedicated “laughing” peanut exists yet — these are the closest mocking/cool poses.
                                Say the word and I’ll generate a true laughing one via the badges pipeline.
                            </p>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Door tally — REAL backend counts">
                            <Field label={`Waitlist size · real cardWaitlistJoinedAt count (${waitlistTotal})`}>
                                <Slider
                                    className="mb-6"
                                    min={0}
                                    max={5000}
                                    step={1}
                                    value={[waitlistTotal]}
                                    onValueChange={([value]) => setWaitlistTotal(value)}
                                    aria-label="Waitlist size"
                                />
                            </Field>
                            <Field label={`Admitted · real cardAccessGrantedAt count (${admittedTotal})`}>
                                <Slider
                                    className="mb-6"
                                    min={0}
                                    max={500}
                                    step={1}
                                    value={[admittedTotal]}
                                    onValueChange={([value]) => setAdmittedTotal(value)}
                                    aria-label="Admitted users"
                                />
                            </Field>
                            <Card className="bg-background-page p-2 text-center text-label-m text-foreground-primary">
                                renders as:{' '}
                                <span className="text-action-primary">
                                    {tally.applicants.toLocaleString('en-US')} tried · {tally.admitted} got in
                                </span>
                                <br />
                                <span className="text-body-xs text-foreground-secondary">
                                    “tried” = waitlist × FOMO multiplier (floored); “got in” = real admitted
                                </span>
                            </Card>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => {
                                        setWaitlistTotal(0)
                                        setAdmittedTotal(0)
                                    }}
                                >
                                    empty (floor)
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => {
                                        setWaitlistTotal(120)
                                        setAdmittedTotal(7)
                                    }}
                                >
                                    early beta
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => {
                                        setWaitlistTotal(1842)
                                        setAdmittedTotal(140)
                                    }}
                                >
                                    busy door
                                </Button>
                            </div>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Waitlist state">
                            <Field label={alreadyJoined ? 'Already joined' : 'Not joined yet'}>
                                <Toggle
                                    checked={alreadyJoined}
                                    onChange={setAlreadyJoined}
                                    aria-label="Already joined the waitlist"
                                />
                            </Field>
                            <p className="text-body-xs text-foreground-secondary">
                                Toggles the post-join state: “Join anyway” becomes an “on the list” confirmation while
                                the asset + “Tweet to appeal” stay.
                            </p>
                        </Section>
                    </Card>
                </aside>

                {/* ─── RIGHT: Phone-frame preview of the whole screen ──── */}
                <main className="flex flex-1 flex-col items-center gap-4">
                    <div className="self-stretch rounded-sm border border-border-default bg-background-page p-2 text-center font-mono text-body-xs text-foreground-secondary">
                        mobile screen · CardRejectionScreen
                    </div>
                    <div
                        className="w-full max-w-[392px] overflow-hidden rounded-[28px] border-2 border-border-default bg-background-default shadow-4"
                        style={{ height: 800 }}
                    >
                        <div className="flex h-full flex-col p-4" style={{ minHeight: 740 }}>
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
