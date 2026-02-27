'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'

export default function DevToolsPage() {
    const tools: { name: string; description: string; path: string; icon: IconName }[] = [
        {
            name: 'Points Leaderboard',
            description: 'Real-time leaderboard with customizable time filters for event competitions',
            path: '/dev/leaderboard',
            icon: 'trophy',
        },
        {
            name: 'Full Graph',
            description:
                'Interactive force-directed graph visualization of all users, invites, and P2P activity (admin only)',
            path: '/dev/full-graph',
            icon: 'globe-lock',
        },
        {
            name: 'Payment Graph',
            description: 'P2P payment flow visualization',
            path: '/dev/payment-graph',
            icon: 'dollar',
        },
        {
            name: 'Design System',
            description: 'Foundations, primitives, patterns, and interactive playground',
            path: '/dev/ds',
            icon: 'docs',
        },
    ]

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="px-4 pt-4">
                <NavHeader title="Dev Tools" />
            </div>

            <div className="flex h-full flex-col space-y-4 px-4 pb-8">
                <p className="text-sm text-grey-1">
                    Internal testing tools and components. Publicly accessible for multi-device testing.
                </p>

                <div className="space-y-2">
                    {tools.map((tool) => (
                        <Link key={tool.path} href={tool.path}>
                            <Card className="cursor-pointer p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-10 items-center justify-center rounded-sm border border-n-1 bg-primary-3">
                                            <Icon name={tool.icon} size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold">{tool.name}</h3>
                                            <p className="text-xs text-grey-1">{tool.description}</p>
                                        </div>
                                    </div>
                                    <Icon name="arrow-up-right" size={16} className="text-grey-1" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>

                <div className="rounded-sm border border-n-1 bg-primary-3/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                        <Icon name="info" size={14} />
                        <span className="text-xs font-bold">Info</span>
                    </div>
                    <ul className="space-y-0.5 text-xs text-grey-1">
                        <li>These tools are only available in development mode</li>
                        <li>Perfect for testing on multiple devices</li>
                        <li>Share the URL with team members for testing</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
