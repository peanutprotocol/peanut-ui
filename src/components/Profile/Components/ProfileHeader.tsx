'use client'
import { Button, NavIcons } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ProfileHeader = () => {
    const router = useRouter()
    return (
        <div className="flex w-full items-center justify-between py-2">
            <Link href={'/home'}>
                <Button
                    variant="stroke"
                    onClick={() => router.push('/home')}
                    className="h-8 w-8 p-0"
                    aria-label="Go back"
                >
                    <Icon name="arrow-prev" className="h-7 w-7" />
                </Button>
            </Link>
            <div className="text-2xl font-bold">Profile</div>
            <Link href={'/settings'}>
                <Button variant="transparent-dark" className="w-fit p-0">
                    <NavIcons name="settings" className="w-7 pb-0" />
                </Button>
            </Link>
        </div>
    )
}
export default ProfileHeader
