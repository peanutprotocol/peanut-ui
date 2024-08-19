'use client'
import Icon from '../Global/Icon'

import { createAvatar } from '@dicebear/core'
import { identicon } from '@dicebear/collection'
import MoreInfo from '../Global/MoreInfo'
import * as components from './Components'
import { useEffect, useState } from 'react'
import { Divider } from '@chakra-ui/react'
import { useDashboard } from '../Dashboard/useDashboard'
import * as interfaces from '@/interfaces'
import { useAccount, useSignMessage } from 'wagmi'
import TablePagination from '../Global/TablePagination'
import * as utils from '@/utils'
import Modal from '../Global/Modal'
import { useAuth } from '@/context/authContext'
import ImageEdit from '../Global/ImageEdit'
import TextEdit from '../Global/TextEdit'

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
    const { user, fetchUser, isFetchingUser, updateUserName, submitProfilePhoto } = useAuth()
    const avatar = createAvatar(identicon, {
        seed: user?.user?.username ?? user?.user?.email ?? '',
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const svg = avatar.toDataUri()
    const { address, isConnected } = useAccount()

    const { signMessageAsync } = useSignMessage()
    const [tableData, setTableData] = useState<interfaces.IProfileTableData[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const { composeLinkDataArray, fetchLinkDetailsAsync } = useDashboard()
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
            (user?.accounts ? utils.shortenAddressLong(user?.accounts[0]?.account_identifier) : '')
    )

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
    useEffect(() => {
        calculateItemsPerPage()
        window.addEventListener('resize', calculateItemsPerPage)
        return () => {
            window.removeEventListener('resize', calculateItemsPerPage)
        }
    }, [])

    useEffect(() => {
        if (!user) return

        const dashboardData = composeLinkDataArray(address ?? '')
        setDashboardData(dashboardData)

        console.log(user)

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
                console.log(contactsData)
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
                            tertiaryText: utils.shortenAddressLong(data.address),
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
                        tertiaryText: data.accountIdentifier,
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

    useEffect(() => {
        async function _fetchLinkDetailsAsync(visibleData: interfaces.IDashboardItem[]) {
            const data = await fetchLinkDetailsAsync(visibleData)
            setDashboardData((prevData) =>
                prevData.map((item) => {
                    const updatedItem = data.find((updated) => updated.link === item.link)
                    return updatedItem ? { ...item, status: updatedItem.status } : item
                })
            )
        }

        const visibleData = dashboardData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.status === undefined)
        if (selectedTab === 'history' && visibleData.length > 0) {
            _fetchLinkDetailsAsync(visibleData)
        }
    }, [currentPage, dashboardData])

    const [isLoading, setIsLoading] = useState(false)
    const handleSiwe = async () => {
        try {
            setIsLoading(true)
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

            console.log('userId', response)
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
            setIsLoading(false)
        }
    }

    useEffect(() => {
        setInitialUserName(
            user?.user?.username ??
                user?.user?.email ??
                (user?.accounts ? utils.shortenAddressLong(user?.accounts[0]?.account_identifier) : '')
        )
    }, [user])

    if (!user) {
        return (
            <components.ProfileSkeleton
                onClick={() => {
                    handleSiwe()
                }}
                showOverlay={!isFetchingUser}
                errorState={errorState}
                isLoading={isLoading}
            />
        )
    } else
        return (
            <div className="flex h-full w-full flex-row flex-col items-center justify-start gap-4 px-4">
                <div className={`flex w-full flex-col items-center justify-center gap-2 `}>
                    <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between ">
                        <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-max sm:flex-row">
                            <ImageEdit
                                initialProfilePicture={user?.user?.profile_picture ? user?.user?.profile_picture : svg}
                                onImageChange={(file) => {
                                    if (!file) return
                                    submitProfilePhoto(file)
                                }}
                            />

                            <TextEdit
                                initialText={initialUserName}
                                onTextChange={(text) => {
                                    setInitialUserName(text)
                                    updateUserName(text)
                                }}
                            />
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
                                <Icon
                                    name={'info'}
                                    className={`cursor-pointer transition-transform dark:fill-white`}
                                    onClick={() => {
                                        setModalVisible(true)
                                        setModalType('Invites')
                                    }}
                                />
                            </span>
                            {/* <span className="flex items-center justify-center gap-1">
                        <Icon name={'peanut'} />7 day streak
                        <MoreInfo text="More info streak" />
                    </span> */}
                        </div>
                        {/* <div>balance</div> */}
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
                                {user?.referredUsers > 0 &&
                                    user?.totalReferralConnections.map((referral, index) => (
                                        <div key={index} className="flex w-full items-center justify-between">
                                            <label>{utils.shortenAddressLong(referral.account_identifier)}</label>
                                            <label>
                                                {Math.floor(
                                                    user.pointsPerReferral?.find((ref) =>
                                                        utils.compareTokenAddresses(
                                                            ref.address,
                                                            referral.account_identifier
                                                        )
                                                    )?.points ?? 0
                                                )}
                                            </label>
                                        </div>
                                    ))}

                                <Divider borderColor={'black'}></Divider>
                                <div className="flex w-full items-center justify-between">
                                    <label>Total</label>
                                    <label>
                                        {user?.totalReferralConnections.reduce((acc, referral) => {
                                            return (
                                                acc +
                                                Math.floor(
                                                    user.pointsPerReferral?.find((ref) =>
                                                        utils.compareTokenAddresses(
                                                            ref.address,
                                                            referral.account_identifier
                                                        )
                                                    )?.points ?? 0
                                                )
                                            )
                                        }, 0)}
                                    </label>
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
