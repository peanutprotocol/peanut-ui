'use client'
import Icon from '@/components/Global/Icon'

import * as _consts from '../Claim.consts'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card } from '@/components/0_Bruddle'

export const NotFoundClaimLink = () => {
    const router = useRouter()

    return (
        <Card className="sm:shadow-primary-4 shadow-none">
            <Card.Header>
                <Card.Title>Sorryyy</Card.Title>
                <Card.Description>Deposit not found. Are you sure your link is correct?</Card.Description>
            </Card.Header>
            <Card.Content>
                <Link href={'/send'}>
                    <Button variant="stroke" className="text-nowrap">
                        <div className="border border-n-1 p-0 px-1">
                            <Icon name="send" className="-mt-0.5" />
                        </div>
                        Make a payment yourself !
                    </Button>
                </Link>
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
            </Card.Content>
        </Card>
    )
}

export default NotFoundClaimLink
