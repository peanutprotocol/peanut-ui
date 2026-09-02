'use client'

import Card from '@/components/Global/Card'
import DevNoteCard from '@/app/(mobile-ui)/dev/_components/DevNoteCard'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'
import { clearFixture, FIXTURE_PARAM } from '@/dev/fixtures/active'
import { FIXTURES } from '@/dev/fixtures/registry'

export default function FixtureList() {
    const names = Object.keys(FIXTURES).sort()

    return (
        <DevPageShell
            title="Fixtures"
            description={`Named app states. Every API answer is faked, so any screen renders with no database, no API and no provider keys. Open a screen with ?${FIXTURE_PARAM}=<name>; the fixture then follows you across navigation until the tab closes.`}
            width="prose"
        >
            <div className="space-y-2">
                {names.map((name) => {
                    const fixture = FIXTURES[name]
                    // Plain <a>: a soft navigation would keep the previous fixture's
                    // React Query cache, so the screen would show stale state.
                    // a route may carry its own query (nuqs URL state)
                    const href = `${fixture.route}${fixture.route.includes('?') ? '&' : '?'}${FIXTURE_PARAM}=${name}`
                    return (
                        <a key={name} href={href}>
                            <Card className="cursor-pointer p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-h8">{name}</h3>
                                        <p className="text-body-xs text-grey-1">{fixture.about}</p>
                                    </div>
                                    <span className="shrink-0 text-body-xs text-grey-1">{fixture.route}</span>
                                </div>
                            </Card>
                        </a>
                    )
                })}
            </div>

            <DevNoteCard title="Info">
                <ul className="space-y-0.5">
                    <li>{names.length} fixtures. Names are stable — they become screenshot filenames.</li>
                    <li>An unknown name logs the valid list to the console and serves the defaults.</li>
                    <li>
                        <button className="underline" onClick={clearFixture}>
                            Clear the fixture session
                        </button>{' '}
                        to sign out of the fake user. `?{FIXTURE_PARAM}=off` does the same.
                    </li>
                </ul>
            </DevNoteCard>
        </DevPageShell>
    )
}
