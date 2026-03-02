'use client'

import Link from 'next/link'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { Card } from '@/components/0_Bruddle/Card'
import { StatusTag } from './StatusTag'

interface CatalogCardProps {
    title: string
    description: string
    href: string
    icon?: IconName
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    quality?: 1 | 2 | 3 | 4 | 5
    usages?: number
}

export function CatalogCard({ title, description, href, icon, status, quality, usages }: CatalogCardProps) {
    return (
        <Link href={href}>
            <Card className="h-full cursor-pointer p-4 transition-all hover:shadow-4 hover:-translate-x-1 hover:-translate-y-1">
                <div className="flex items-start gap-3">
                    {icon && (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-n-1 bg-primary-3">
                            <Icon name={icon} size={18} />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold">{title}</h3>
                        <p className="mt-1 text-sm text-grey-1">{description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {status && <StatusTag status={status} />}
                            {quality && (
                                <span className="text-[10px] text-grey-1">
                                    {'★'.repeat(quality)}
                                    {'☆'.repeat(5 - quality)}
                                </span>
                            )}
                            {usages !== undefined && (
                                <span className="text-[10px] text-grey-1">
                                    {usages} usage{usages !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    <Icon name="arrow-up-right" size={14} className="shrink-0 text-grey-1" />
                </div>
            </Card>
        </Link>
    )
}

export function CatalogGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}
