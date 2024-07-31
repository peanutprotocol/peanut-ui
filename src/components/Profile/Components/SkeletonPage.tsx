import React from 'react'
import { Divider } from '@chakra-ui/react'
import * as assets from '@/assets'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
export const ProfileSkeleton = ({ onClick }: { onClick: () => void }) => {
    const { open } = useWeb3Modal()
    const { address } = useAccount()

    return (
        <div className="relative flex h-full w-full flex-row flex-col items-center justify-start gap-4 px-4">
            <div className="relative z-0 flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
                    <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-max sm:flex-row">
                        <div className="h-16 w-16 animate-pulse rounded-sm bg-slate-700"></div>
                        <div className="flex flex-col items-center justify-center gap-1 sm:items-start">
                            <span className="h-8 w-32 animate-pulse rounded bg-slate-700"></span>
                        </div>
                    </div>
                    <div className="flex h-24 w-full animate-pulse flex-col items-start justify-center gap-2 rounded-sm border border-n-1 bg-slate-700 px-4 py-2 text-h7 sm:w-96"></div>
                </div>
                <div className="flex w-full flex-col items-center justify-center gap-2 pb-2">
                    <div className="mx-0 flex w-full flex-row items-center justify-center gap-1 px-0">
                        <span className="h-8 w-1/3 animate-pulse rounded-none bg-slate-700"></span>
                        <span className="h-8 w-1/3  animate-pulse rounded-none bg-slate-700"></span>
                        <span className="h-8 w-1/3 animate-pulse rounded-none bg-slate-700"></span>
                    </div>
                    <Divider borderColor={'black'} />
                    <table className="table-custom bg-background sm:table">
                        <thead>
                            <tr className="h-16">
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    {' '}
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(3)].map((_, idx) => (
                                <tr key={idx}>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="absolute inset-0 -top-2 z-10 flex items-center justify-center backdrop-blur-sm">
                <button
                    onClick={() => {
                        if (address) {
                            onClick()
                        } else {
                            open()
                        }
                    }}
                    className="z-20 w-max rounded border border-black bg-white px-4 py-2 text-h6 text-black"
                >
                    {address ? (
                        <span className="flex flex-row items-center justify-center gap-2 text-h6  text-black">
                            <img src={assets.ETHEREUM_ICON.src} className="h-6 w-6" />
                            Sign in with ethereum
                        </span>
                    ) : (
                        'Connect Wallet'
                    )}
                </button>
            </div>
        </div>
    )
}
