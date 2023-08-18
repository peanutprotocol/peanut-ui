import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'

export function Dashboard() {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { address, isConnected } = useAccount()
    const router = useRouter()
    const [localStorageData, setLocalStorageData] = useState<interfaces.ILocalStorageItem[]>([])

    useEffect(() => {
        if (address) {
            const data = utils.getAllLinksFromLocalStorage({
                address: address.toString(),
            })
            data && setLocalStorageData(data)
        }
        router.prefetch('/')
    }, [])
    return (
        <global_components.CardWrapper>
            <div className="flex flex-col gap-2">
                <div className="align-center flex w-full justify-between">
                    <div className="text-center text-xl font-bold">A list of all the links you have created.</div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                        <button
                            type="button"
                            className="brutalborder inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black sm:w-auto"
                            onClick={() => {
                                router.push('/')
                            }}
                        >
                            CREATE
                            <svg
                                className="-mr-0.5 ml-2 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 -2 15 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
                {isConnected ? (
                    <table className=" w-full table-fixed border-separate border-spacing-y-4 border-2 border-white ">
                        <thead className="bg-black text-white ">
                            <tr>
                                <th className="w-1/4 py-2">Chain</th>
                                <th className="w-3/4 py-2">Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localStorageData.map((item) => (
                                <tr key={item.hash}>
                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all">
                                        {
                                            chainDetails.find(
                                                (chain) => chain.chainId.toString() === item.link.match(/c=(\d+)/)?.[1]
                                            )?.name
                                        }
                                    </td>

                                    <td
                                        className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all"
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.link)
                                        }}
                                    >
                                        {item.link}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    'Connect your wallet to view your deposits'
                )}
            </div>
        </global_components.CardWrapper>
    )
}
