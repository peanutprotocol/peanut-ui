'use client'
import * as global_components from '@/components/global'
import * as components from '@/components'
import { useSearchParams } from 'next/navigation'

export default function ClaimPage() {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
    return (
        <global_components.PageWrapper>
            <components.Claim link={pageUrl} />
        </global_components.PageWrapper>
    )
}