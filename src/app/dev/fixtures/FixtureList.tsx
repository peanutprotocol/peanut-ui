'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'
import { clearFixture, FIXTURE_PARAM, fixtureHref } from '@/dev/fixtures/active'
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
                    const href = fixtureHref(fixture.route, name)
                    return (
                        <a key={name} href={href} className="block">
                            <ListItem
                                className="cursor-pointer"
                                title={name}
                                body={fixture.about}
                                bodyWrap
                                trailing={
                                    <span className="max-w-32 truncate text-body-xs text-foreground-secondary">
                                        {fixture.route}
                                    </span>
                                }
                                chevron
                            />
                        </a>
                    )
                })}
            </div>

            <Notification
                priority="info"
                title="Info"
                items={[
                    `${names.length} fixtures. Names are stable because they become screenshot filenames.`,
                    'An unknown name logs the valid list and serves the defaults.',
                    `Use ?${FIXTURE_PARAM}=off to clear the fixture session.`,
                ]}
                ctas={[{ label: 'Clear fixture session', onClick: clearFixture }]}
            />
        </DevPageShell>
    )
}
