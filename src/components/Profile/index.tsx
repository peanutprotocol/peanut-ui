'use client'

import Icon from '../Global/Icon'
import * as consts from '@/constants'
import { createAvatar } from '@dicebear/core'
import { identicon } from '@dicebear/collection'
import * as components from './Components'
import { useContext, useEffect, useRef, useState } from 'react'
import { Divider, ToastId, useToast } from '@chakra-ui/react'
import { useDashboard } from '../Dashboard/useDashboard'
import * as interfaces from '@/interfaces'
import { useAccount, useSignMessage } from 'wagmi'
import TablePagination from '../Global/TablePagination'
import * as utils from '@/utils'
import Modal from '../Global/Modal'
import { useAuth } from '@/context/authContext'
import ImageEdit from '../Global/ImageEdit'
import TextEdit from '../Global/TextEdit'
import Link from 'next/link'
import * as context from '@/context'
import Loading from '../Global/Loading'

const tabs = [
    {
        title: 'History',
        value: 'history',
    },
    {
        title: 'Contacts',
        value: 'contacts',
    },
    {
        title: 'Accounts',
        value: 'accounts',
    },
]

export const Profile = () => {
    const [selectedTab, setSelectedTab] = useState<'contacts' | 'history' | 'accounts' | undefined>(undefined)
    const { user, fetchUser, isFetchingUser, updateUserName, submitProfilePhoto, logoutUser } = useAuth()
    const avatar = createAvatar(identicon, {
        seed: user?.user?.username ?? user?.user?.email ?? '',
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const svg = avatar.toDataUri()
    const { address, isConnected } = useAccount()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const { signMessageAsync } = useSignMessage()
    const [tableData, setTableData] = useState<interfaces.IProfileTableData[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const { composeLinkDataArray, fetchLinkDetailsAsync, removeRequestLinkFromLocalStorage } = useDashboard()
    const [dashboardData, setDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [contactsData, setContactsData] = useState<
        {
            userName: string
            address: string
            txs: number
            avatar: string | undefined
        }[]
    >([])
    const [accountsData, setAccountData] = useState<
        {
            type: string
            accountIdentifier: string
        }[]
    >([])

    const [modalVisible, setModalVisible] = useState(false)
    const [modalType, setModalType] = useState<'Boost' | 'Invites' | undefined>(undefined)

    const [initialUserName, setInitialUserName] = useState(
        user?.user?.username ??
            user?.user?.email ??
            (user?.accounts ? utils.printableAddress(user?.accounts[0]?.account_identifier) : '')
    )
    const toastIdRef = useRef<ToastId | undefined>(undefined)
    const toast = useToast({
        position: 'bottom-right',
        duration: 5000,
        isClosable: true,
        icon: '🥜',
    })

    // Calculate the number of items that can be displayed on the page
    // Calculate the number of items that can be displayed on the page
    const calculateItemsPerPage = () => {
        const itemHeight = 100
        const availableHeight = window.innerHeight - 300
        const calculatedItems = Math.floor(availableHeight / itemHeight)
        // Only update if the change is significant
        if (Math.abs(calculatedItems - itemsPerPage) > 1) {
            setItemsPerPage(Math.max(calculatedItems, 1))
        }
    }

    const [_isLoading, _setIsLoading] = useState(false)
    const handleSiwe = async () => {
        try {
            _setIsLoading(true)
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            if (!address) return

            const userIdResponse = await fetch('/api/peanut/user/get-user-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountIdentifier: address,
                }),
            })

            const response = await userIdResponse.json()

            const siwemsg = utils.createSiweMessage({
                address: address ?? '',
                statement: `Sign in to peanut.to. This is your unique user identifier! ${response.userId}`,
            })

            const signature = await signMessageAsync({
                message: siwemsg,
            })

            await fetch('/api/peanut/user/get-jwt-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    signature: signature,
                    message: siwemsg,
                }),
            })

            fetchUser()
        } catch (error) {
            console.error('Authentication error:', error)
            setErrorState({
                showError: true,
                errorMessage: 'Error while authenticating. Please try again later.',
            })
        } finally {
            _setIsLoading(false)
        }
    }

    const handleLogout = async () => {
        try {
            setLoadingState('Logging out')
            await logoutUser()
        } catch (error) {
            console.error('Error logging out', error)
            setErrorState({
                showError: true,
                errorMessage: 'Error logging out',
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleDeleteLink = async (link: string) => {
        const url = new URL(link ?? '')
        const id = url.searchParams.get('id')

        removeRequestLinkFromLocalStorage(link)

        setTableData((prevData) =>
            prevData.filter((item) => {
                return item.dashboardItem?.link !== link
            })
        )
        await fetch(`${consts.PEANUT_API_URL}/request-links/${id}/cancel`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: process.env.PEANUT_API_KEY,
            }),
        })
    }

    useEffect(() => {
        calculateItemsPerPage()
        window.addEventListener('resize', calculateItemsPerPage)
        return () => {
            window.removeEventListener('resize', calculateItemsPerPage)
        }
    }, [])

    // UseEffect hook to set the contacts and account once the user is fetched
    useEffect(() => {
        if (!user) return

        const dashboardData = composeLinkDataArray(address ?? '')
        setDashboardData(dashboardData)

        const contactsData =
            user?.contacts &&
            user.contacts.map((contact) => ({
                userName: contact.nickname ?? contact.username ?? contact.ens_name ?? '-',
                address: contact.account_identifier,
                txs: contact.n_interactions,
                avatar: contact.profile_picture ?? '',
            }))
        setContactsData(contactsData)
        const accountsData =
            user?.accounts &&
            user.accounts.map((account) => ({
                type:
                    account.account_type === 'iban'
                        ? 'Bank account (iban)'
                        : account.account_type === 'us'
                          ? 'Bank account (US account)'
                          : 'Wallet',
                accountIdentifier: account.account_identifier,
            }))
        setAccountData(accountsData)

        setSelectedTab('history')
    }, [user])

    // UseEffect hook to set the table data based on the selected tab
    useEffect(() => {
        switch (selectedTab) {
            case 'history':
                setTotalPages(Math.ceil(dashboardData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    dashboardData.map((data) => ({
                        primaryText: data.type,
                        secondaryText: utils.formatDate(new Date(data.date)) ?? '',
                        tertiaryText: `${data.amount} ${data.tokenSymbol} - [${data.chain}]`,
                        quaternaryText: data.status ?? '',
                        itemKey: (data.link ?? data.txHash ?? '') + Math.random(),
                        type: 'history',
                        avatar: {
                            iconName: undefined,
                            avatarUrl: undefined,
                        },
                        dashboardItem: data,
                    }))
                )
                break
            case 'contacts':
                setTotalPages(Math.ceil(contactsData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    contactsData.map((data) => {
                        const avatarUrl = data.avatar
                            ? data.avatar.length > 0
                                ? data.avatar
                                : createAvatar(identicon, {
                                      seed: data.address,
                                  }).toDataUri()
                            : createAvatar(identicon, {
                                  seed: data.address,
                              }).toDataUri()

                        return {
                            primaryText: data.userName,
                            address: data.address,
                            secondaryText: '',
                            tertiaryText: utils.printableAddress(data.address) ?? '',
                            quaternaryText: data.txs.toString(),
                            itemKey: data.userName + Math.random(),
                            type: 'contacts',
                            avatar: {
                                iconName: undefined,
                                avatarUrl: avatarUrl,
                            },
                        }
                    })
                )
                break
            case 'accounts':
                setTotalPages(Math.ceil(accountsData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    accountsData.map((data) => ({
                        primaryText: data.type,
                        secondaryText: '',
                        tertiaryText: data.type.includes('Bank')
                            ? utils.formatIban(data.accountIdentifier)
                            : data.accountIdentifier,
                        quaternaryText: '',
                        itemKey: data.accountIdentifier + Math.random(),
                        type: 'accounts',
                        avatar: {
                            iconName: undefined,
                            avatarUrl: undefined,
                        },
                    }))
                )
                break
            default:
                break
        }
        async function _fetchLinkDetailsAsync(dashboardData: interfaces.IDashboardItem[]) {
            const data = await fetchLinkDetailsAsync(dashboardData)
            setTableData((prevData) =>
                prevData.map((item) => {
                    const _item = data.find((d) => d.link === item.itemKey)
                    if (_item) {
                        item.quaternaryText = _item.status ?? 'pending'
                    }
                    return item
                })
            )
        }
        const visibleData = tableData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.quaternaryText === undefined)
        if (visibleData.length > 0) {
            _fetchLinkDetailsAsync(dashboardData)
        }
    }, [selectedTab])

    // UseEffect hook to fetch the link details for the visible data
    useEffect(() => {
        async function _fetchLinkDetailsAsync(visibleData: interfaces.IDashboardItem[]) {
            console.log('visibleData', visibleData)
            const data = await fetchLinkDetailsAsync(visibleData)
            setDashboardData((prevData) =>
                prevData.map((item) => {
                    const updatedItem = data.find((updated) => updated.link === item.link)
                    return updatedItem && item.status === undefined ? { ...item, status: updatedItem.status } : item
                })
            )
        }

        const visibleData = dashboardData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.status === undefined)
        if (selectedTab === 'history' && visibleData.length > 0) {
            _fetchLinkDetailsAsync(visibleData)
        }
    }, [currentPage, selectedTab])

    // UseEffect hook to set the initial user name
    useEffect(() => {
        setInitialUserName(user?.user?.username ?? '')
    }, [user])

    if (!user) {
        return (
            <components.ProfileSkeleton
                onClick={() => {
                    handleSiwe()
                }}
                showOverlay={!isFetchingUser}
                errorState={errorState}
                isLoading={_isLoading}
            />
        )
    } else
        return (
            <div className="flex h-full w-full flex-row flex-col items-center justify-start gap-4 px-4">
                <div className={`flex w-full flex-col items-center justify-center gap-2 `}>
                    <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between ">
                        <div className="flex flex-col gap-2">
                            <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-max sm:flex-row">
                                <span className="flex flex-col items-center  justify-center gap-1 ">
                                    <ImageEdit
                                        initialProfilePicture={
                                            user?.user?.profile_picture ? user?.user?.profile_picture : svg
                                        }
                                        onImageChange={(file) => {
                                            if (!file) return
                                            submitProfilePhoto(file)
                                        }}
                                    />
                                </span>
                                <div className="flex flex-col items-start justify-center gap-1">
                                    <TextEdit
                                        initialText={initialUserName ?? ''}
                                        onTextChange={(text) => {
                                            setInitialUserName(text)
                                            updateUserName(text)
                                        }}
                                    />

                                    <span className="flex justify-center gap-1 text-h8 font-normal">
                                        {user?.user?.email ??
                                            utils.printableAddress(user.accounts?.[0]?.account_identifier)}
                                        <div className={`flex flex-row items-center justify-center `}>
                                            <div
                                                className={`kyc-badge select-none ${user?.user?.kycStatus === 'verified' ? 'bg-kyc-green px-2 py-1 text-black' : 'bg-gray-1 text-white hover:ring-2 hover:ring-gray-2'} w-max`}
                                            >
                                                {user?.user?.kycStatus === 'verified' ? (
                                                    'KYC'
                                                ) : (
                                                    <Link className="px-2 py-1" href={'/kyc'}>
                                                        NO KYC
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </span>
                                </div>
                            </div>
                            <button className="btn btn-xl h-8 w-full" onClick={handleLogout}>
                                {isLoading ? (
                                    <div className="flex w-full flex-row items-center justify-center gap-2">
                                        <Loading /> {loadingState}
                                    </div>
                                ) : (
                                    'Log out'
                                )}
                            </button>
                        </div>
                        <div className="flex w-full flex-col items-start justify-center gap-2 border border-n-1 bg-background px-4 py-2 text-h7 sm:w-96 ">
                            <span className="text-h5">{user?.totalPoints} points</span>
                            {/* <span className="flex items-center justify-center gap-1">
                                <Icon name={'arrow-up-right'} />
                                Boost 1.4X
                                <Icon
                                    name={'info'}
                                    className={`cursor-pointer transition-transform dark:fill-white`}
                                    onClick={() => {
                                        setModalVisible(true)
                                        setModalType('Boost')
                                    }}
                                />
                            </span> */}
                            <span className="flex items-center justify-center gap-1">
                                <Icon name={'heart'} />
                                Invites {user?.referredUsers}
                                {user?.referredUsers > 0 && (
                                    <Icon
                                        name={'info'}
                                        className={`cursor-pointer transition-transform dark:fill-white`}
                                        onClick={() => {
                                            setModalVisible(true)
                                            setModalType('Invites')
                                        }}
                                    />
                                )}
                            </span>
                            {/* <span className="flex items-center justify-center gap-1">
                        <Icon name={'peanut'} />7 day streak
                        <MoreInfo text="More info streak" />
                    </span> */}
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-2 pb-2">
                        <components.Tabs
                            items={tabs}
                            value={selectedTab}
                            setValue={setSelectedTab}
                            className="mx-0 w-full gap-0 px-0"
                            classButton="w-1/3 mx-0 px-0 ml-0 !rounded-none"
                        />
                        <Divider borderColor={'black'}></Divider>
                        <div className="block w-full sm:hidden">
                            {tableData
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((data) => (
                                    <div key={(data.itemKey ?? '') + Math.random()}>
                                        <components.MobileTableComponent
                                            itemKey={(data.itemKey ?? '') + Math.random()}
                                            primaryText={data.primaryText}
                                            secondaryText={data.secondaryText}
                                            tertiaryText={data.tertiaryText}
                                            quaternaryText={data.quaternaryText}
                                            address={data.address}
                                            type={data.type}
                                            avatar={data.avatar}
                                            dashboardItem={data.dashboardItem}
                                        />
                                    </div>
                                ))}{' '}
                        </div>
                        <div className="hidden w-full sm:block">
                            <components.TableComponent
                                data={tableData}
                                selectedTab={selectedTab}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                handleDeleteLink={handleDeleteLink}
                            />
                        </div>
                        {dashboardData.length > 0 && totalPages > 1 && (
                            <TablePagination
                                onNext={() => {
                                    if (currentPage < totalPages) {
                                        setCurrentPage(currentPage + 1)
                                    }
                                }}
                                onPrev={() => {
                                    if (currentPage > 1) {
                                        setCurrentPage(currentPage - 1)
                                    }
                                }}
                                totalPages={totalPages}
                                currentPage={currentPage}
                            />
                        )}
                    </div>
                    <Modal
                        visible={modalVisible}
                        onClose={() => {
                            setModalVisible(false)
                        }}
                        title={modalType}
                        classNameWrapperDiv="px-5 pb-7 pt-8"
                    >
                        {modalType === 'Boost' ? (
                            <div className="flex w-full flex-col items-center justify-center gap-2 text-h7">
                                {/* <div className="flex w-full items-center justify-between">
                                    <label>Streak</label>
                                    <label>1.4X</label>
                                </div> */}
                                <div className="flex w-full items-center justify-between">
                                    <label>Early frend</label>
                                    <label>1.4X</label>
                                </div>
                                <Divider borderColor={'black'}></Divider>
                                <div className="flex w-full items-center justify-between">
                                    <label>Total</label>
                                    <label>1.4X</label>
                                </div>
                            </div>
                        ) : modalType === 'Invites' ? (
                            <div className="flex w-full flex-col items-center justify-center gap-2 text-h7">
                                <div className="flex w-full items-center justify-between">
                                    <label className="w-[42%] text-h9">Address</label>
                                    <label className="w-[28%] text-h9">Referred Users</label>
                                    <label className="w-[30%] text-right text-h9">Points</label>
                                </div>
                                <Divider borderColor={'black'}></Divider>
                                {user?.referredUsers > 0 &&
                                    user?.pointsPerReferral.map((referral, index) => (
                                        <div key={index} className="flex w-full items-center justify-between">
                                            <label
                                                className="w-[40%] cursor-pointer truncate text-h8"
                                                onClick={() => {
                                                    window.open(
                                                        `https://debank.com/profile/${referral.address}/history`,
                                                        '_blank'
                                                    )
                                                }}
                                            >
                                                <Icon
                                                    name={'external'}
                                                    className="mb-1 cursor-pointer"
                                                    onClick={() => {
                                                        window.open(
                                                            `https://debank.com/profile/${referral.address}/history`,
                                                            '_blank'
                                                        )
                                                    }}
                                                />
                                                {utils.printableAddress(referral.address)}
                                            </label>
                                            <label className="w-[30%] text-center text-h8">
                                                {referral?.totalReferrals ?? 0}
                                            </label>
                                            <label className="w-[30%] text-right text-h8">
                                                {Math.floor(
                                                    user.pointsPerReferral?.find((ref) =>
                                                        utils.areTokenAddressesEqual(ref.address, referral.address)
                                                    )?.points ?? 0
                                                )}
                                            </label>
                                        </div>
                                    ))}

                                <Divider borderColor={'black'}></Divider>
                                <div className="flex w-full items-center justify-between">
                                    <label className="w-[40%]">Total</label>
                                    <label className="w-[30%] text-center">{user?.totalReferralConnections}</label>
                                    <label className="w-[30%] text-right">{user?.totalReferralPoints}</label>
                                </div>
                            </div>
                        ) : (
                            ''
                        )}
                    </Modal>
                </div>
            </div>
        )
}
