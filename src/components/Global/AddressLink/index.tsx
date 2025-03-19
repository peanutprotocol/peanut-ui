import { RecipientType } from '@/lib/url-parser/types/payment'
import * as utils from '@/utils'
import { usePrimaryName } from '@justaname.id/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isAddress } from 'viem'
import { printableAddress } from '@/utils'

interface AddressLinkProps {
    address: string
    className?: string
    children?: React.ReactNode
}

const AddressLink = ({ address, className = '' }: AddressLinkProps) => {
    const [displayAddress, setDisplayAddress] = useState<string>(
        isAddress(address) ? printableAddress(address) : address
    )

    // Look up ENS name only for Ethereum addresses
    const { primaryName: ensName } = usePrimaryName({
        address: isAddress(address) ? (address as `0x${string}`) : undefined,
        chainId: 1, // Mainnet for ENS lookups
        priority: 'onChain',
    })

    useEffect(() => {
        // Update display: prefer ENS name for addresses, otherwise use as-is
        if (isAddress(address) && ensName) {
            setDisplayAddress(ensName)
            // for peanut ens names, strip the domain from the displayed string!
            const ensDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
            if (ensName.endsWith(ensDomain)) {
                setDisplayAddress(ensName.slice(0, -(ensDomain.length + 1))) // include the dot
            }
        } else {
            setDisplayAddress(isAddress(address) ? printableAddress(address) : address)
        }
    }, [address, ensName])

    // Create a simple URL - all identifiers go to /{identifier}
    const url = `/${displayAddress}`

    return (
        <Link className={`cursor-pointer underline ${className}`} href={url} target="_blank">
            {displayAddress}
        </Link>
    )
}

export default AddressLink
