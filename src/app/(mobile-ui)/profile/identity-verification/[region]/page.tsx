'use client'
import RegionsPage from '@/components/Profile/views/RegionsPage.view'
import { useParams } from 'next/navigation'

export default function IdentityVerificationRegionPage() {
    const params = useParams()
    const region = params.region as string

    return <RegionsPage path={region} />
}
