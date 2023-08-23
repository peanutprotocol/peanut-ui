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


    const createButton = (
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
                    // fill-rule="evenodd"
                    d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z"
                    // clip-rule="evenodd"
                />
            </svg>
        </button>
    )

    return (
        <global_components.CardWrapper>
            <div className="flex flex-col gap-2">
                {localStorageData.length && (
                    <div className="align-center flex w-full justify-between">
                        <div className="text-center text-xl font-bold">A list of all the links you have created.</div>
                        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                            { createButton }
                        </div>
                    </div>
                ) || null}
                {isConnected ? (
                    localStorageData.length ? (
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
                    ):(
                        <div>
                            <div className="text-center">You have not created any links yet</div>
                            <div className="flex justify-center align-center mt-4">
                                <div>
                                    { createButton }
                                </div>
                                <div className="px-8 leading-10 font-normal">OR</div>
                                <div>
                                        <button
                                        type="button"
                                        className="brutalborder inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black sm:w-auto"
                                        onClick={() => {
                                            router.push('/')
                                        }}
                                    >
                                        IMPORT BACKUP
                                        <svg className="-mr-0.5 ml-2 h-4 w-4" width="16" height="14" viewBox="0 0 16 14" fill="currentcolor" xmlns="http://www.w3.org/2000/svg">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M14.9333 8.60002C14.3445 8.60002 13.8667 9.07789 13.8667 9.66669V11.8H2.13333V9.66669C2.13333 9.07789 1.65547 8.60002 1.06667 8.60002C0.477867 8.60002 0 9.07789 0 9.66669V13.4C0 13.6555 0.277867 13.9334 0.533333 13.9334H15.4667C15.7888 13.9334 16 13.6891 16 13.4V9.66669C16 9.07789 15.5221 8.60002 14.9333 8.60002ZM5.86667 4.33335H6.93333V9.13335C6.93333 9.72215 7.4112 10.2 8 10.2C8.5888 10.2 9.06667 9.72215 9.06667 9.13335V4.33335H10.1333C10.5088 4.33335 10.8405 4.38403 11.0501 4.17336C11.2587 3.96376 11.2587 3.62295 11.0501 3.41281L8.41387 0.217631C8.30187 0.105631 8.15413 0.0576123 8.00853 0.0656123C7.8624 0.0576123 7.71466 0.105631 7.60319 0.217631L4.96693 3.41281C4.75786 3.62295 4.75786 3.96376 4.96693 4.17336C5.17599 4.38403 5.6576 4.33335 5.86667 4.33335Z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    'Connect your wallet to view your deposits'
                )}
            </div>
        </global_components.CardWrapper>
    )
}
