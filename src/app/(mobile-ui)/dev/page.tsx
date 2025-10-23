'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'

export default function DevToolsPage() {
    const tools = [
        {
            name: 'Points Leaderboard',
            description: 'Real-time leaderboard with customizable time filters for event competitions',
            path: '/dev/leaderboard',
            icon: '🏆',
            status: 'active',
        },
        {
            name: 'Shake Test',
            description: 'Test progressive shake animation and confetti for perk claiming',
            path: '/dev/shake-test',
            icon: '🧪',
            status: 'active',
        },
        // Add more dev tools here in the future
    ]

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="🛠️ Dev Tools" />

            <div className="flex h-full flex-col space-y-6 px-4 pb-8">
                <Card className="p-6">
                    <h1 className="mb-2 text-2xl font-bold">Developer Tools</h1>
                    <p className="text-sm text-gray-600">
                        Internal testing tools and components. Publicly accessible for multi-device testing.
                    </p>
                </Card>

                <div className="space-y-4">
                    {tools.map((tool) => (
                        <Link key={tool.path} href={tool.path}>
                            <Card className="cursor-pointer p-4 transition-all hover:shadow-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{tool.icon}</div>
                                        <div>
                                            <h3 className="font-bold">{tool.name}</h3>
                                            <p className="text-sm text-gray-600">{tool.description}</p>
                                            {tool.status === 'active' && (
                                                <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Icon name="arrow-up-right" size={20} className="text-gray-400" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>

                <Card className="space-y-2 bg-blue-50 p-4">
                    <h3 className="font-bold text-blue-900">ℹ️ Info</h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                        <li>• These tools are publicly accessible (no login required)</li>
                        <li>• Perfect for testing on multiple devices</li>
                        <li>• Share the URL with team members for testing</li>
                    </ul>
                </Card>
            </div>
        </div>
    )
}
