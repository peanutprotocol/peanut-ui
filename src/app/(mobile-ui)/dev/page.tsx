'use client'

import Card from '@/components/Global/Card'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import DevNoteCard from './_components/DevNoteCard'
import DevPageShell from './_components/DevPageShell'

export default function DevToolsPage() {
    // static: true → plain <a> (file in public/, not an app route — Next Link can't client-navigate to it)
    const tools: { name: string; description: string; path: string; icon: IconName; static?: boolean }[] = [
        {
            name: 'Full Graph',
            description:
                'Interactive force-directed graph visualization of all users, invites, and P2P activity (admin only)',
            path: '/dev/full-graph',
            icon: 'globe-lock',
        },
        {
            name: 'Payment Network Explorer',
            description: 'Live P2P payment relationships — team-gated, shows real usernames, points and KYC regions',
            path: '/dev/payment-graph',
            icon: 'dollar',
        },
        {
            name: 'Design System',
            description: 'Foundations, primitives, patterns, and interactive playground',
            path: '/dev/ds',
            icon: 'docs',
        },
        {
            name: 'Devices',
            description:
                'Viewport harness: any page in 6 phone widths at once (320–430), one session. Panes mirror route, scroll, input and clicks. Hover an element to compare its width across widths; press "o" to scan for horizontal overflow.',
            path: '/dev/devices',
            icon: 'switch',
        },
        {
            name: 'Fixtures',
            description:
                'Named app states behind ?__fixture=<name>: long usernames, huge numbers, empty states, KYC gates, errors. Every API answer is faked, so any screen renders with no database, no API and no provider keys.',
            path: '/dev/fixtures',
            icon: 'docs',
        },
        {
            name: 'Debug',
            description:
                'Sandbox-only: one-click full setup, fund USDC, fast-forward KYC, complete pending intents. Pink-banner console logs every action.',
            path: '/dev/debug',
            icon: 'dollar',
        },
        {
            name: 'Safe Area',
            description:
                'Per-device status-bar/system-bar insets: env() vs the natively measured values Capacitor injects, plus webview version and platform context.',
            path: '/dev/safe-area',
            icon: 'globe-lock',
        },
        {
            name: 'Activation Journey',
            description:
                'Per funnel state: every in-app surface (verbatim copy + source file) and every lifecycle email/push, fetched live from the sandbox API journey-spec.',
            path: '/dev/journey',
            icon: 'users',
        },
        {
            name: 'Peanut Welcome Club',
            description:
                'Onboarding quiz: the Welcome-@anon handbook pitfalls (comms, tasks, security, invoicing) as an ironically kawaii quiz. Single static HTML in public/ — zero build impact.',
            path: '/onboarding-quiz/index.html',
            icon: 'trophy',
            static: true,
        },
        {
            name: 'Home CTAs',
            description:
                'Force-renders every home-screen CTA in isolation (card launch banner, carousel CTAs, activation steps) ignoring auth/state/launch gating.',
            path: '/dev/home-ctas',
            icon: 'credit-card',
        },
        {
            name: 'Rejection screen builder',
            description:
                'Iterate the full mobile CardRejectionScreen — bouncer mascot, door tally, waitlist state — inside a phone frame.',
            path: '/dev/rejection-builder',
            icon: 'credit-card',
        },
        {
            name: 'Share asset builder',
            description:
                'Iterate the card share asset (sticker collage): badge set, username length, hero variant, seed reroll, PNG capture.',
            path: '/dev/share-builder',
            icon: 'docs',
        },
        {
            name: 'Profile card row',
            description: 'The profile "first group" in both card states, rendered with the real ProfileMenuItem.',
            path: '/dev/profile-card-row',
            icon: 'credit-card',
        },
        {
            name: 'Perk success test',
            description: 'Fires the perk-claim success screens without needing a real perk to claim.',
            path: '/dev/perk-success-test',
            icon: 'dollar',
        },
        {
            name: 'Shake test',
            description: 'Tunes the shake-and-hold gesture — intensity, duration, thresholds.',
            path: '/dev/shake-test',
            icon: 'info',
        },
        {
            name: 'Card session approve',
            description:
                'Grants the combined Rain session-key permission (auto-balancer + withdraw policies) in one passkey tap.',
            path: '/dev/card-session-approve',
            icon: 'credit-card',
        },
    ]

    return (
        <DevPageShell
            title="Dev Tools"
            description="Internal testing tools and components. Publicly accessible for multi-device testing."
            backHref="/home"
            width="prose"
        >
            <div className="flex flex-col gap-4">
                <div className="space-y-2">
                    {tools.map((tool) => {
                        const LinkComponent = tool.static ? 'a' : Link
                        return (
                            <LinkComponent key={tool.path} href={tool.path}>
                                <Card className="cursor-pointer p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-sm border border-border-default bg-purple-200">
                                                <Icon name={tool.icon} size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-label-l">{tool.name}</h3>
                                                <p className="text-body-xs text-foreground-secondary">
                                                    {tool.description}
                                                </p>
                                            </div>
                                        </div>
                                        <Icon name="arrow-up-right" size={16} className="text-foreground-secondary" />
                                    </div>
                                </Card>
                            </LinkComponent>
                        )
                    })}
                </div>

                <DevNoteCard title="Info">
                    <ul className="space-y-0.5">
                        <li>These tools are only available in development mode</li>
                        <li>Perfect for testing on multiple devices</li>
                        <li>Share the URL with team members for testing</li>
                    </ul>
                </DevNoteCard>
            </div>
        </DevPageShell>
    )
}
