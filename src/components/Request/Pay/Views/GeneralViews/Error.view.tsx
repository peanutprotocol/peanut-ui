'use client'
import { Button, Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'

import Link from 'next/link'

export const ErrorView = ({ errorMessage }: { errorMessage: string }) => {
    return (
        <Card>
            <Card.Header>
                <Card.Title>Sorryyyy</Card.Title>
                <Card.Description>{errorMessage}</Card.Description>
            </Card.Header>
            <Card.Content className="col gap-4">
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

export default ErrorView
