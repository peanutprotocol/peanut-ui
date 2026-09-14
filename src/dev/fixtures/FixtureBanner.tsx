'use client'

// Every API answer on this tab is faked while a fixture is active, but a
// logged-in user who opens a ?__fixture= link keeps their real session cookie
// — without this strip there is no visible difference between fixture data and
// their real account.

import { useEffect, useState } from 'react'
import { Notification } from '@/components/0_Bruddle/Notification'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { FIXTURE_PARAM, peekActiveFixture } from '@/dev/fixtures/active'

export function FixtureBanner() {
    // read after mount: peekActiveFixture is window-only, so rendering from it
    // during SSR/hydration would mismatch.
    const [name, setName] = useState<string | null>(null)
    useEffect(() => {
        if (DEV_TOOLS_ENABLED) setName(peekActiveFixture())
    }, [])
    if (!name) return null

    return (
        <Notification
            variant="floating"
            priority="attention"
            title={`Fixture: ${name}`}
            className="fixed right-4 bottom-[calc(var(--safe-bottom)_+_1rem)] left-4 z-50 mx-auto max-w-xl"
            ctas={[
                {
                    label: 'Exit fixture',
                    onClick: () => {
                        window.location.href = `?${FIXTURE_PARAM}=off`
                    },
                },
            ]}
        >
            API responses on this page are simulated.
        </Notification>
    )
}
