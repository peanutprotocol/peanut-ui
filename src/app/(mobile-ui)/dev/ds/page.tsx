'use client'

import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'
import { Card } from '@/components/0_Bruddle/Card'
import Title from '@/components/0_Bruddle/Title'
import { DocPage } from './_components/DocPage'

const sections = [
    {
        title: 'Foundations',
        description: 'Color tokens, typography, spacing, shadows, icons, and borders',
        href: '/dev/ds/foundations',
        icon: 'bulb' as const,
        count: 6,
    },
    {
        title: 'Primitives',
        description: 'Bruddle base components: Button, Card, Input, Select, Checkbox, Toast',
        href: '/dev/ds/primitives',
        icon: 'switch' as const,
        count: 9,
    },
    {
        title: 'Patterns',
        description: 'Composed components: Modal, Drawer, Navigation, Loading, Feedback, Layouts',
        href: '/dev/ds/patterns',
        icon: 'docs' as const,
        count: 9,
    },
    {
        title: 'Playground',
        description: 'Interactive test harnesses: shake animations, haptics, confetti, perk flows',
        href: '/dev/ds/playground',
        icon: 'bulb' as const,
        count: 2,
    },
]

export default function DesignSystemPage() {
    return (
        <DocPage>
            {/* Hero */}
            <div className="rounded-sm border border-n-1 bg-purple-1 p-6">
            <Title text="PEANUT" />
            <p className="mt-2 text-base font-bold text-n-1">Design System</p>
            <p className="mt-1 text-sm text-n-1/70">
                Foundations → Primitives → Patterns → Playground
            </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
            {[
                { label: 'Primitives', value: '9' },
                { label: 'Global', value: '70+' },
                { label: 'Icons', value: '85+' },
            ].map((stat) => (
                <div key={stat.label} className="rounded-sm border border-n-1 p-3 text-center">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-grey-1">{stat.label}</p>
                </div>
            ))}
        </div>

        {/* Section cards */}
        <div className="space-y-4">
            {sections.map((section) => (
                <Link key={section.href} href={section.href}>
                    <Card shadowSize="4" className="cursor-pointer p-4 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-sm border border-n-1 bg-primary-3">
                                <Icon name={section.icon} size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-bold">{section.title}</h3>
                                    <span className="rounded-full bg-n-1/10 px-2 py-0.5 text-xs font-bold text-grey-1">
                                        {section.count}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-sm text-grey-1">{section.description}</p>
                            </div>
                            <Icon name="arrow-up-right" size={16} className="text-grey-1" />
                        </div>
                    </Card>
                </Link>
            ))}
        </div>

        {/* Design rules quick reference */}
        <div className="space-y-4 rounded-sm border border-n-1 bg-primary-3/20 p-3">
            <p className="text-sm font-bold">Quick Rules</p>
            <ul className="space-y-1 text-sm text-grey-1">
                <li>Primary CTA: <code className="rounded bg-white px-1 font-mono text-[10px]">variant=&quot;purple&quot; shadowSize=&quot;4&quot; w-full</code></li>
                <li>Links: <code className="rounded bg-white px-1 font-mono text-[10px]">text-black underline</code> — never text-purple-1</li>
                <li>purple-1 is <span className="inline-block size-3 rounded-sm bg-purple-1 align-middle" /> pink (#FF90E8), not purple</li>
                <li>size=&quot;large&quot; is h-10 (shorter than default h-13)</li>
            </ul>
        </div>
        </DocPage>
    )
}
