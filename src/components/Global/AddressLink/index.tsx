import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useEnsName } from 'wagmi'
import { isAddress } from 'viem'
import * as utils from '@/utils'

const AddressLink = ({ address }: { address: string }) => {
    const [url, setUrl] = useState<string>('')
    const [displayAddress, setDisplayAddress] = useState<string>(utils.printableAddress(address))

    // Look up ENS name for any valid Ethereum address
    const { data: ensName } = useEnsName({
        address: isAddress(address) ? (address as `0x${string}`) : undefined,
        chainId: 1, // Mainnet for ENS lookups
    })

    useEffect(() => {
        // Always set debank URL
        setUrl(`https://debank.com/profile/${address}`)

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
