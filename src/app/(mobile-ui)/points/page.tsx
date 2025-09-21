'use client'

import { Button } from '@/components/0_Bruddle'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'

const PointsPage = () => {
    const { user } = useAuth()

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Invites" onPrev={() => {}} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                <h1 className="font-bold">Refer friends</h1>
                <div className="flex w-full items-center justify-between gap-3">
                    <Card className="flex w-1/2 items-center justify-center py-3.5">
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold md:text-base">{`${user?.user.username?.toUpperCase()}INVITESYOU`}</p>
                    </Card>
                    <Button icon="copy" shadowSize="4" variant="primary-soft">
                        <p className="text-sm"> Copy code</p>
                    </Button>
                </div>

                {/* <Button shadowSize="4">Invite a friend!</Button> */}

                <Card className="flex flex-col items-center justify-center gap-4 py-4">
                    <div className="flex items-center justify-center rounded-full bg-primary-1 p-2">
                        <Icon name="trophy" />
                    </div>
                    <h2 className="font-medium">No points yet</h2>

                    <p className="text-center text-sm text-grey-1">
                        Earn points for every action you take on Peanut and when your invites create an account.
                    </p>

                    <Button shadowSize="4">Invite a friend!</Button>
                </Card>
            </section>
        </PageContainer>
    )
}

export default PointsPage
