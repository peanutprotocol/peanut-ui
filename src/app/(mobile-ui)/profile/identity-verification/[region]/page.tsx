'use client'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import RegionsPage from '@/components/Profile/views/RegionsPage.view'
import { useParams } from 'next/navigation'

export default function IdentityVerificationRegionPage() {
    const params = useParams()
    const region = params.region as string

    return (
        <PageContainer>
            <RegionsPage path={region} />
        </PageContainer>
    )
}
