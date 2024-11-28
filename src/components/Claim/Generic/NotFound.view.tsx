'use client'

import * as _consts from '../Claim.consts'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/components/0_Bruddle'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'

export const NotFoundClaimLink = () => {
    const router = useRouter()

    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Sorryyy</Card.Title>
                <Card.Description>Deposit not found. Are you sure your link is correct?</Card.Description>
            </Card.Header>
            <Card.Content>
                <label className="text-h9 font-normal">
                    We would like to hear from your experience. Hit us up on{' '}
                    <a
                        className="cursor-pointer text-black underline dark:text-white"
                        target="_blank"
                        href="https://discord.gg/BX9Ak7AW28"
                    >
                        Discord!
                    </a>
                </label>
                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
