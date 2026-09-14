'use client'

import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'

// This route sits OUTSIDE the (mobile-ui) group on purpose, next to
// /dev/devices. Under that group's client layout, notFound() renders the
// not-found UI but still answers 200; here it answers a real 404.
//
// The list is loaded lazily behind the build-time flag, the same shape
// ClientProviders uses for the harness bootstrap. That keeps the registry out
// of the page chunk and out of the prerendered HTML. It does NOT delete the
// lazy chunk from the build — webpack emits one for every import() in the
// source, dead branch or not, which is why /dev/devices also still ships its
// harness. Removing those needs a build-config rule covering every /dev page.
const FixtureList = DEV_TOOLS_ENABLED ? dynamic(() => import('./FixtureList')) : null

export default function DevFixturesPage() {
    // gate lives outside the component that calls hooks, or rules-of-hooks fails lint.
    if (!FixtureList) notFound()
    return <FixtureList />
}
