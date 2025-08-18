'use client'

import { DirectSendFlow } from '@/components/Payment/flows/DirectSendFlow'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { AccountType } from '@/interfaces'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { usersApi } from '@/services/users'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isAddress } from 'viem'

interface DirectSendPageProps {
    recipient: string[]
}

/**
 * Client component for direct send flow
 * Handles recipient resolution and renders DirectSendFlow
 */
export default function DirectSendPageClient({ recipient }: DirectSendPageProps) {
    const router = useRouter()
    const [parsedRecipient, setParsedRecipient] = useState<ParsedURL['recipient'] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const resolveRecipient = async () => {
            try {
                if (!recipient || recipient.length === 0) {
                    setError('No recipient specified')
                    return
                }

                const recipientIdentifier = recipient[0]

                let resolvedRecipient: ParsedURL['recipient']

                if (isAddress(recipientIdentifier)) {
                    // It's already a valid address
                    resolvedRecipient = {
                        identifier: recipientIdentifier,
                        resolvedAddress: recipientIdentifier,
                        recipientType: 'ADDRESS',
                    }
                } else {
                    // It's a username - resolve it to an address
                    console.log('🔍 Resolving username:', recipientIdentifier)
                    const user = await usersApi.getByUsername(recipientIdentifier)

                    // Find the Peanut wallet account (should be the primary one)
                    const peanutAccount = user.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)

                    if (!peanutAccount) {
                        throw new Error(`User ${recipientIdentifier} does not have a Peanut wallet`)
                    }

                    resolvedRecipient = {
                        identifier: recipientIdentifier,
                        resolvedAddress: peanutAccount.identifier, // This should be the wallet address
                        recipientType: 'USERNAME',
                    }

                    console.log('✅ Username resolved:', {
                        username: recipientIdentifier,
                        address: peanutAccount.identifier,
                    })
                }

                setParsedRecipient(resolvedRecipient)
            } catch (err) {
                console.error('Error resolving recipient:', err)
                setError('Failed to resolve recipient')
            } finally {
                setIsLoading(false)
            }
        }

        resolveRecipient()
    }, [recipient])

    const handleComplete = () => {
        router.push('/home')
    }

    if (isLoading) {
        return <PeanutLoading />
    }

    if (error || !parsedRecipient) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-red-600 text-xl font-bold">Error</h2>
                    <p className="mt-2 text-gray-600">{error || 'Invalid recipient'}</p>
                </div>
            </div>
        )
    }

    return <DirectSendFlow recipient={parsedRecipient} onComplete={handleComplete} />
}
