'use client'
import { Button, Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'

export const CanceledClaimLink = () => {
    return (
        <Card className="space-y-3 shadow-none sm:shadow-primary-4">
            <Card.Header className="mx-auto space-y-2">
                <Card.Title className="mx-auto text-center">Sorryyy</Card.Title>
                <Card.Description className="mx-auto text-center">This request had been canceled</Card.Description>
            </Card.Header>
            <Card.Content className="mx-auto space-y-2 text-center">
                <div className="block text-h8 font-normal">
                    Deposit not found. Are you sure your link is correct?
                    <a className="text-link-decoration" target="_blank" href="https://discord.gg/BX9Ak7AW28">
                        Discord!
                    </a>
                </div>

                <div className="w-full">
                    <Link href={'/request/create'}>
                        <Button variant="stroke">
                            <div className=" border border-n-1 p-0 px-1">
                                <Icon name="send" className="-mt-0.5" />
                            </div>
                            Make a request yourself!
                        </Button>
                    </Link>
                </div>
            </Card.Content>
        </Card>
    )
}
