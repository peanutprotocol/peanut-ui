import { RecipientType } from '@/lib/url-parser/types/payment'
import * as utils from '@/utils'
import { usePrimaryName } from '@justaname.id/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isAddress } from 'viem'

const AddressLink = ({ address, recipientType }: { address: string; recipientType?: RecipientType }) => {
    const [url, setUrl] = useState<string>('')
    const [displayAddress, setDisplayAddress] = useState<string>(utils.printableAddress(address))

    // Look up ENS name for any valid Ethereum address
    const { primaryName: ensName } = usePrimaryName({
        address: isAddress(address) ? (address as `0x${string}`) : undefined,
        chainId: 1, // Mainnet for ENS lookups
    })

    useEffect(() => {
        if (recipientType === 'USERNAME') {
            setUrl(`${process.env.NEXT_PUBLIC_BASE_URL}/${address}`)
        } else {
            setUrl(`https://debank.com/profile/${address}`)
        }

        // Update display: prefer ENS name, fallback to shortened address
        if (ensName) {
            setDisplayAddress(ensName)
        } else {
            setDisplayAddress(utils.printableAddress(address))
        }
    }, [address, ensName])

    return url ? (
        <Link className="cursor-pointer underline" href={url} target="_blank">
            {displayAddress}
        </Link>
    ) : (
        <span>{displayAddress}</span>
    )
}

export default AddressLink
