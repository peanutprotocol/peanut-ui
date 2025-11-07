'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ActionModal from '@/components/Global/ActionModal'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function IdentityVerificationLayout({ children }: { children: React.ReactNode }) {
    const [isAlreadyVerifiedModalOpen, setIsAlreadyVerifiedModalOpen] = useState(false)
    const router = useRouter()
    const { isRegionAlreadyUnlocked, isVerifiedForCountry } = useIdentityVerification()
    const params = useParams()
    const regionParams = params.region as string
    const countryParams = params.country as string

    useEffect(() => {
        const isAlreadyVerified =
            (countryParams && isVerifiedForCountry(countryParams)) ||
            (regionParams && isRegionAlreadyUnlocked(regionParams))

        if (isAlreadyVerified) {
            setIsAlreadyVerifiedModalOpen(true)
        }
    }, [countryParams, regionParams, isVerifiedForCountry, isRegionAlreadyUnlocked])

    return (
        <PageContainer>
            {children}

            <ActionModal
                visible={isAlreadyVerifiedModalOpen}
                onClose={() => {
                    setIsAlreadyVerifiedModalOpen(false)
                    router.push('/profile')
                }}
                title="You're already verified"
                description={
                    <p>
                        Your identity has already been successfully verified for this region. You can continue to use
                        features available in this region. No further action is needed.
                    </p>
                }
                icon="shield"
                ctas={[
                    {
                        text: 'Close',
                        shadowSize: '4',
                        className: 'md:py-2',
                        onClick: () => {
                            setIsAlreadyVerifiedModalOpen(false)
                            router.push('/profile')
                        },
                    },
                ]}
            />
        </PageContainer>
    )
}
