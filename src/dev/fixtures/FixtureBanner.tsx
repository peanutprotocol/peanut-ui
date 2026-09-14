'use client'

// Every API answer on this tab is faked while a fixture is active, but a
// logged-in user who opens a ?__fixture= link keeps their real session cookie
// — without this strip there is no visible difference between fixture data and
// their real account. Dev tooling: plain elements on purpose, no design-system
// ceremony.

import { useEffect, useState } from 'react'
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
        // plain <a>, full navigation: ?__fixture=off is read by
        // ensureActiveFixture on the next load, which clears the session and
        // the fake cookie.
        <a
            href={`?${FIXTURE_PARAM}=off`}
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: '#7c2d12',
                color: '#fff',
                font: '600 11px/1.8 monospace',
                textAlign: 'center',
                textDecoration: 'none',
            }}
        >
            fixture: {name} — API faked · tap to exit
        </a>
    )
}
