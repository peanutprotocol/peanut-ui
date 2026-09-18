'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import Link from 'next/link'
import { type IconName } from '@/components/Global/Icons/Icon'
import DevPageShell from './_components/DevPageShell'

interface DevTool {
    name: string
    description: string
    path: string
    icon: IconName
    /** true → plain <a> (file in public/, not an app route — Next Link can't client-navigate to it) */
    static?: boolean
}

const groups: { title: string; tools: DevTool[] }[] = [
    {
        title: 'Design system',
        tools: [
            {
                name: 'Design System',
                description: 'Foundations, primitives, patterns, audit, and interactive playground',
                path: '/dev/ds',
                icon: 'docs',
            },
        ],
    },
    {
        title: 'Harnesses',
        tools: [
            {
                name: 'Devices',
                description: 'Any page in 6 phone widths at once (320–430), one mirrored session',
                path: '/dev/devices',
                icon: 'switch',
            },
            {
                name: 'Fixtures',
                description: 'Named app states behind ?__fixture=<name> — every API answer faked',
                path: '/dev/fixtures',
                icon: 'docs',
            },
            {
                name: 'Safe Area',
                description: 'Per-device status-bar insets: env() vs the natively measured Capacitor values',
                path: '/dev/safe-area',
                icon: 'globe-lock',
            },
            {
                name: 'Lottie native profile',
                description: 'Measure live mascot frame cadence and long tasks inside the real Capacitor WebView',
                path: '/dev/lottie-profile',
                icon: 'processing',
            },
            {
                name: 'Home CTAs',
                description: 'Every home-screen CTA rendered in isolation, ignoring auth/state gating',
                path: '/dev/home-ctas',
                icon: 'credit-card',
            },
            {
                name: 'Profile card row',
                description: 'The profile "first group" in both card states, with the real ProfileMenuItem',
                path: '/dev/profile-card-row',
                icon: 'credit-card',
            },
            {
                name: 'Perk success test',
                description: 'Fires the perk-claim success screens without a real perk to claim',
                path: '/dev/perk-success-test',
                icon: 'dollar',
            },
            {
                name: 'Shake test',
                description: 'Tunes the shake-and-hold gesture — intensity, duration, thresholds',
                path: '/dev/shake-test',
                icon: 'info',
            },
            {
                name: 'WebAuthn ceremony log',
                description: 'Every passkey sheet this session, tagged with the call path that asked',
                path: '/dev/ceremony-log',
                icon: 'info',
            },
            {
                name: 'Activation Journey',
                description: 'Every in-app surface and lifecycle email/push per funnel state',
                path: '/dev/journey',
                icon: 'users',
            },
        ],
    },
    {
        title: 'Builders & ops',
        tools: [
            {
                name: 'Share asset builder',
                description: 'Iterate the card share asset: badge set, hero variant, seed reroll, PNG capture',
                path: '/dev/share-builder',
                icon: 'docs',
            },
            {
                name: 'Debug',
                description: 'Sandbox-only: full setup, fund USDC, fast-forward KYC, complete intents',
                path: '/dev/debug',
                icon: 'dollar',
            },
            {
                name: 'Card session approve',
                description: 'Grants the combined Rain session-key permission in one passkey tap',
                path: '/dev/card-session-approve',
                icon: 'credit-card',
            },
        ],
    },
    {
        title: 'Experiments',
        tools: [
            {
                name: 'Full Graph',
                description: 'Force-directed graph of all users, invites, and P2P activity (admin only)',
                path: '/dev/full-graph',
                icon: 'globe-lock',
            },
            {
                name: 'Payment Network Explorer',
                description: 'Live P2P payment relationships — team-gated, real usernames and KYC regions',
                path: '/dev/payment-graph',
                icon: 'dollar',
            },
            {
                name: 'Peanut Welcome Club',
                description: 'Onboarding quiz on the Welcome-@anon handbook pitfalls, kawaii edition',
                path: '/onboarding-quiz/index.html',
                icon: 'trophy',
                static: true,
            },
            {
                name: 'Deferred deep link',
                description: 'Inspect the install hand-off state, build payloads, simulate a referrer restore',
                path: '/dev/deferred',
                icon: 'link',
            },
            {
                name: 'KYC flows',
                description: 'KYC 2.0 mermaid flow diagrams, rendered from the mono flow-diagram doc',
                path: '/dev/kyc-flows',
                icon: 'docs',
            },
            {
                name: 'Loading words',
                description: 'Cycling payment-loading words with the production mascot treatment',
                path: '/dev/loading-words',
                icon: 'processing',
            },
            {
                name: 'Tabs looks',
                description: 'TASK-22707 — 6 candidate looks for the one Tabs component, standalone and panelled',
                path: '/dev/tabs-proposals',
                icon: 'switch',
            },
            {
                name: 'Tabs looks — real surfaces',
                description: 'TASK-22707 — the same 6 looks on the real product and marketing screens',
                path: '/dev/tabs-proposals/surfaces',
                icon: 'switch',
            },
        ],
    },
]

export default function DevToolsPage() {
    return (
        <DevPageShell
            title="Dev Tools"
            description="Internal testing tools and components. Publicly accessible for multi-device testing."
            backHref="/home"
            width="prose"
        >
            <div className="flex flex-col gap-4">
                {groups.map((group) => (
                    <Section key={group.title} title={group.title}>
                        <div>
                            {group.tools.map((tool, i) => {
                                const LinkComponent = tool.static ? 'a' : Link
                                return (
                                    <LinkComponent key={tool.path} href={tool.path}>
                                        <ListItem
                                            className="cursor-pointer"
                                            position={getCardPosition(i, group.tools.length)}
                                            leading={<IconBubble icon={tool.icon} size="s" color="brand" />}
                                            title={tool.name}
                                            body={tool.description}
                                            chevron
                                        />
                                    </LinkComponent>
                                )
                            })}
                        </div>
                    </Section>
                ))}

                <Notification
                    priority="info"
                    title="Info"
                    items={[
                        'These tools are only available in development mode.',
                        'Use the device harness to check multiple widths.',
                        'Share the preview URL with team members for testing.',
                    ]}
                />
            </div>
        </DevPageShell>
    )
}
