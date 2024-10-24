'use client'
import { Button, Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'

export const CanceledClaimLink = () => {
    return (
        <Card>
            <Card.Header>
                <Card.Title>Sorryyy</Card.Title>
                <Card.Header>This request had been canceled</Card.Header>
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

                <Link href={'/request/create'}>
                    <Button variant="stroke">
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="send" className="-mt-0.5" />
                        </div>
                        Make a request yourself!
                    </Button>
                </Link>
            </Card.Content>
        </Card>
    )
}

export default CanceledClaimLink
