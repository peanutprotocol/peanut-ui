'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useRouter } from 'next/navigation'
import React from 'react'
import IdentityVerificationCountryList from '../components/IdentityVerificationCountryList'
import { Button } from '@/components/0_Bruddle'

const RegionsPage = ({ path }: { path: string }) => {
    const router = useRouter()
    const { lockedRegions } = useIdentityVerification()

    const region = lockedRegions.find((region) => region.path === path)

    if (!region) {
        return <div>Region not found</div>
    }

    return (
        <div className="relative h-[80vh]">
            <div className="flex min-h-[inherit] flex-col space-y-8 pb-28">
                <NavHeader title={region.name} onPrev={() => router.back()} />

                <IdentityVerificationCountryList region={region.path} />
            </div>
            {region.path !== 'latam' && (
                <div className="sticky bottom-4 flex justify-center">
                    <Button
                        onClick={() => router.push(`/profile/identity-verification/${region.path}/bridge`)}
                        variant="purple"
                        shadowSize="4"
                        className="max-w-[280px]"
                    >
                        Verify to unlock
                    </Button>
                </div>
            )}
        </div>
    )
}

export default RegionsPage
