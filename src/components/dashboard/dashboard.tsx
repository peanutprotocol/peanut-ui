import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import DashboardLogin from './login';
import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'

export function Dashboard() {

    const syncLinks = (address): void => {
        if(!address)
            return;

        // to keep previously saved links
        // we need to re-save them in new json format
        utils.migrateAllLinksFromLocalStorageV2({
            address: address.toString(),
        })

        const data = utils.getAllLinksFromLocalStorage({
            address: address.toString(),
        })

        data && setLocalStorageData(data)
    }

    const { address, isConnected } = useAccount({
        onConnect({address}: { address?: string }) {
            // onConnect we need to load links using a new (or just assigned) address
            syncLinks(address)
        },
    })

    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const router = useRouter()
    const [localStorageData, setLocalStorageData] = useState<interfaces.ILocalStorageItem[]>([])

    useEffect(() => {
        syncLinks(address)
        router.prefetch('/')
    }, [])

    if(!isConnected) {
        return (
            <DashboardLogin />
        )
    }

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
                    d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z"
                />
            </svg>
        </button>
    )

    const importBackup = (event) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            // reads a JSON file and saves all links to localStorage
            utils.saveLinksToLocalStorage({ address: address.toString(), links: JSON.parse(event.target.result.toString())})
            syncLinks(address);
        };
        reader.readAsText(event.target.files[0]);
    }

    const importButton = (
        <div className="inline-block">
            <input className="hidden" id="upload-backup" type="file" onChange={importBackup}/>
            <label
                htmlFor="upload-backup"
                className="brutalborder inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-medium bg-white hover:bg-white hover:text-black sm:w-auto"
            >
                IMPORT
                <svg className="-mr-0.5 ml-2 h-4 w-4" width="16" height="14" viewBox="0 0 16 14" fill="currentcolor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M14.9333 8.60002C14.3445 8.60002 13.8667 9.07789 13.8667 9.66669V11.8H2.13333V9.66669C2.13333 9.07789 1.65547 8.60002 1.06667 8.60002C0.477867 8.60002 0 9.07789 0 9.66669V13.4C0 13.6555 0.277867 13.9334 0.533333 13.9334H15.4667C15.7888 13.9334 16 13.6891 16 13.4V9.66669C16 9.07789 15.5221 8.60002 14.9333 8.60002ZM5.86667 4.33335H6.93333V9.13335C6.93333 9.72215 7.4112 10.2 8 10.2C8.5888 10.2 9.06667 9.72215 9.06667 9.13335V4.33335H10.1333C10.5088 4.33335 10.8405 4.38403 11.0501 4.17336C11.2587 3.96376 11.2587 3.62295 11.0501 3.41281L8.41387 0.217631C8.30187 0.105631 8.15413 0.0576123 8.00853 0.0656123C7.8624 0.0576123 7.71466 0.105631 7.60319 0.217631L4.96693 3.41281C4.75786 3.62295 4.75786 3.96376 4.96693 4.17336C5.17599 4.38403 5.6576 4.33335 5.86667 4.33335Z"/>
                </svg>
            </label>
        </div>
    )

    // data-url to generate a downloadable backup.json
    const backupData = "text/json;charset=utf-8," + encodeURIComponent(localStorage.getItem(address.toString()) || '');

    const backupButton = (
        <a href={`data:${backupData}`} download="backup.json">
            <button
                type="button"
                className="brutalborder inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-medium bg-white text-black hover:bg-white hover:text-black sm:w-auto"
            >
                BACKUP
                <svg className="-mr-0.5 ml-2 h-4 w-4" width="16" height="16" viewBox="0 0 16 16" fill="currentcolor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M15.4667 1.06668H0.533333C0.277867 1.06668 0 1.34455 0 1.60001V5.33335C0 5.92215 0.477867 6.40001 1.06667 6.40001C1.65547 6.40001 2.13333 5.92215 2.13333 5.33335V3.20001H13.8667V5.33335C13.8667 5.92215 14.3445 6.40001 14.9333 6.40001C15.5221 6.40001 16 5.92215 16 5.33335V1.60001C16 1.31095 15.7888 1.06668 15.4667 1.06668ZM10.1333 10.6667H9.06667V5.86668C9.06667 5.27788 8.5888 4.80001 8 4.80001C7.4112 4.80001 6.93333 5.27788 6.93333 5.86668V10.6667H5.86667C5.6576 10.6667 5.176 10.616 4.96694 10.8267C4.75787 11.0363 4.75787 11.3771 4.96694 11.5872L7.60267 14.7824C7.71413 14.8944 7.8624 14.9424 8.00853 14.9344C8.15467 14.9424 8.3024 14.8944 8.41387 14.7824L11.0496 11.5872C11.2587 11.3771 11.2587 11.0363 11.0496 10.8267C10.8405 10.616 10.5093 10.6667 10.1333 10.6667Z"/>
                </svg>
            </button>
        </a>
    )

    return (
        <global_components.CardWrapper>
            <div className="flex flex-col gap-2">
                {localStorageData.length && (
                    <div className="align-center flex flex-col sm:flex-row w-full justify-between">
                        <div className="text-center text-xl font-bold">All your links</div>
                        <div className="flex mt-4 md:mt-0 gap-0 md:gap-4 items-center justify-center">
                            <div>
                                { importButton }
                            </div>
                            <div>
                                { backupButton }
                            </div>
                            <div>
                                { createButton }
                            </div>
                        </div>
                    </div>
                ) || null}

                {localStorageData.length ? (
                    <table className=" w-full table-fixed border-separate border-spacing-y-4 border-2 border-white ">
                        <thead className="bg-black text-white ">
                            <tr>
                                <th className="w-1/4 py-2">Chain</th>
                                <th className="py-2">Link</th>
                                <th className="w-6"></th>
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
                                        className="brutalborder-bottom h-8 overflow-hidden overflow-ellipsis whitespace-nowrap break-all"
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.link)
                                        }}
                                    >

                                        <a href={item.link} target="_blank" className="text-black">{item.link}</a>
                                    </td>
                                    <td>
                                        <svg className="cursor-pointer transition duration-75 active:text-green-400" width="24" height="24" viewBox="0 0 24 24" fill="currentcolor" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20.235 4.50001L16.11 0.555014C15.9386 0.378522 15.7334 0.238407 15.5066 0.143047C15.2798 0.0476865 15.0361 -0.00096041 14.79 1.43642e-05H8.79002C8.30058 0.0117643 7.83515 0.214484 7.49319 0.564849C7.15124 0.915214 6.95988 1.38543 6.96002 1.87501V18.375C6.96002 18.8723 7.15757 19.3492 7.5092 19.7008C7.86083 20.0525 8.33774 20.25 8.83502 20.25H18.915C19.4123 20.25 19.8892 20.0525 20.2408 19.7008C20.5925 19.3492 20.79 18.8723 20.79 18.375V5.82001C20.791 5.57398 20.7424 5.33028 20.647 5.10348C20.5516 4.87667 20.4115 4.67143 20.235 4.50001ZM18.915 18.375H8.83502V1.87501H12.915V5.82001C12.915 6.3173 13.1126 6.79421 13.4642 7.14584C13.8158 7.49747 14.2927 7.69502 14.79 7.69502H18.915V18.375ZM18.915 5.82001H14.79V1.87501L18.915 5.82001Z"/>
                                            <path d="M15.165 22.125H5.08502V5.625H6.00002V3.75H5.08502C4.58774 3.75 4.11083 3.94754 3.7592 4.29917C3.40757 4.65081 3.21002 5.12772 3.21002 5.625V22.125C3.21002 22.6223 3.40757 23.0992 3.7592 23.4508C4.11083 23.8025 4.58774 24 5.08502 24H15.165C15.6623 24 16.1392 23.8025 16.4908 23.4508C16.8425 23.0992 17.04 22.6223 17.04 22.125V21.18H15.165V22.125Z"/>
                                        </svg>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ):(
                    <div>
                        <div className="text-center">You have not created any links yet</div>
                        <div className="flex flex-col items-center justify-center align-center mt-4 lg:flex-row">
                            <div>
                                { createButton }
                            </div>
                            <div className="px-8 leading-10 font-normal">OR</div>
                            <div>
                                { importButton }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </global_components.CardWrapper>
    )
}
