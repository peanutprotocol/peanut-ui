'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useRouter } from 'next/navigation'
import IdentityVerificationCountryList from '../components/IdentityVerificationCountryList'
import { Button } from '@/components/0_Bruddle/Button'

const RegionsPage = ({ path }: { path: string }) => {
    const router = useRouter()
    const { lockedRegions } = useIdentityVerification()

    const hideVerifyButtonPaths = ['latam', 'rest-of-the-world']

    const region = lockedRegions.find((region) => region.path === path)

    if (!region) {
        return null
    }

    return (
        <div className="relative h-[80vh]">
            <div className="flex min-h-[inherit] flex-col space-y-8 pb-28">
                <NavHeader title={region.name} onPrev={() => router.back()} />

                <IdentityVerificationCountryList region={region.path} />
            </div>
            {!hideVerifyButtonPaths.includes(region.path) && (
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
