'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

const withAuthGuard = (WrappedComponent: any) => {
    return (props: any) => {
        const { address, isConnected } = useAccount()
        const [signedIn, setSignedIn] = useState(false)

        useEffect(() => {
            const checkSignedInStatus = async () => {
                if (address && isConnected) {
                    // Assume you have a function to check if the user is signed in on the backend
                    //   const user = await fetchUser(address);
                    setSignedIn(false)
                }
            }

            checkSignedInStatus()
        }, [address, isConnected])

        if (!signedIn) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-75 backdrop-blur-xl">
                    <div className="rounded-lg bg-white p-4 shadow-lg">
                        <p>Please sign in with Ethereum to access this content.</p>
                    </div>
                </div>
            )
        }

        return <WrappedComponent {...props} />
    }
}

export default withAuthGuard
