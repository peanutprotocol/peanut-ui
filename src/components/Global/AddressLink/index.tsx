import Link from 'next/link'
import { useEffect, useState } from 'react'

import * as utils from '@/utils'

const AddressLink = ({ address }: { address: string }) => {
    const [url, setUrl] = useState<string>('')
    useEffect(() => {
        if (!address) return
        if (address.endsWith('.eth')) {
            utils.resolveFromEnsName(address).then((resolvedAddress) => {
                if (!resolvedAddress) return
                setUrl(`https://debank.com/profile/${resolvedAddress}`)
            })
            return
        }
        setUrl(`https://debank.com/profile/${address}`)
    }, [address])
    return url ? (
        <Link className="cursor-pointer underline" href={url} target="_blank">
            {utils.printableAddress(address)}
        </Link>
    ) : (
        <span>{utils.printableAddress(address)}</span>
    )
}

export default AddressLink
