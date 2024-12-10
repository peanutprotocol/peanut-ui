'use client'
import React, {useEffect, useState} from 'react'
import { Divider } from '@chakra-ui/react'
import * as assets from '@/assets'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { errors } from 'ethers'
import Loading from '@/components/Global/Loading'
import { GlobalLoginComponent } from '@/components/Global/LoginComponent'
import { GlobalRegisterComponent } from '@/components/Global/RegisterComponent'
import { useForm } from 'react-hook-form'
import {useAddSubname, useIsSubnameAvailable} from "@justaname.id/react";
import {chainId, peanutEnsDomain} from "@/config/justweb3.config";
import {useDebounce} from "@justweb3/widget";
import {useRouter} from "next/navigation";


interface ISubnameForm {
    username: string
}

export const ClaimSubname = () => {
    const { isConnected } = useAccount()
    const { open: web3modalOpen } = useWeb3Modal()
    const router = useRouter()
    const form = useForm<ISubnameForm>({
        mode: 'onChange',
        defaultValues: {
            username: '',
        }
    })

    const { debouncedValue, isDebouncing} = useDebounce(form.watch().username, 500)
    const { isSubnameAvailable, isSubnameAvailableLoading, isSubnameAvailablePending, isSubnameAvailableFetching} = useIsSubnameAvailable({
        username: debouncedValue,
        ensDomain: peanutEnsDomain,
    })

    const { addSubname, isAddSubnamePending} = useAddSubname()

    useEffect(() => {
        if (isSubnameAvailableFetching || !debouncedValue) {
            form.clearErrors('username')
            return
        }

        if (!isSubnameAvailable?.isAvailable) {
            form.setError('username', {
                type: 'validate',
                message: 'Subname already taken',
            })
        }
    }, [isSubnameAvailable, isSubnameAvailableFetching, debouncedValue])


    const handleClaim = async (data: ISubnameForm) => {
        addSubname({
            username: data.username,
            ensDomain: peanutEnsDomain,
            chainId: chainId
        }).then(() => {
          router.push('/profile')
        })
    }

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
                    <table className="table-custom hidden bg-background sm:table">
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
                    <div className="block w-full sm:hidden">
                        {[...Array(3)].map((_, idx) => (
                            <div
                                className="flex w-full flex-row items-center justify-between gap-2 border border-n-1 bg-background px-2 py-4 text-h8 font-normal dark:bg-black"
                                key={idx}
                            >
                                <span className="block h-12 w-12 animate-pulse rounded bg-slate-700"></span>

                                <div className="flex w-full flex-col gap-2">
                                    <div className="flex flex-row items-center justify-between">
                                        <span className="block h-4 w-12 animate-pulse rounded bg-slate-700"></span>
                                        <span className="block h-4 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </div>
                                    <div className="flex w-full border-t border-dotted border-black" />
                                    <span className="block h-4 w-24 animate-pulse rounded bg-slate-700"></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


                <div className="absolute inset-0 -top-2 z-10 flex items-center justify-center backdrop-blur-sm">
                    <div
                        className="flex w-max flex-col items-center justify-center gap-2 border border-black bg-white p-4">
                        <p className={"text-xl font-bold"}>Claim your Subname!</p>

                        <form className="flex w-full flex-col items-start justify-center gap-2"
                              onSubmit={form.handleSubmit(handleClaim)}>
                            <div className={"relative w-full custom-input custom-input-xs flex items-center gap-2 focus-within:border-primary"}>
                                <input
                                    {
                                        ...form.register('username', {
                                                required: 'This field is required',
                                            }
                                        )
                                    }
                                    className={`outline-none w-full text-black`}
                                    placeholder="Username"
                                    name="username"
                                />
                                <span className="text-black uppercase font-bold text-sm">.{peanutEnsDomain}</span>
                            </div>
                            {
                                form?.formState.errors.username && (
                                    <span className="text-red-500 text-sm">{form.formState.errors.username.message}</span>
                                )
                            }
                        {
                            isConnected ? (
                                <button
                                    type="submit"
                                    disabled={isSubnameAvailableFetching || !isSubnameAvailable?.isAvailable || isAddSubnamePending}
                                    className={`z-20 w-full border border-black bg-primary px-4 py-2 text-h6 text-black ${isSubnameAvailableFetching || !isSubnameAvailable?.isAvailable ? 'cursor-not-allowed opacity-55' : ''}`}
                                >
                                    {isAddSubnamePending || isSubnameAvailableFetching || isDebouncing ?
                                        <div className="flex w-full flex-row items-center justify-center gap-2">
                                            <Loading /> Claim
                                        </div>
                                     : (
                                        'Claim'
                                    )}
                                </button>
                            ) : (
                                <button

                                    onClick={()=> {
                                        web3modalOpen()
                                    }}

                                    disabled={isSubnameAvailablePending || !isSubnameAvailable?.isAvailable}
                                    className="z-20 w-full border border-black bg-white px-4 py-2 text-h6 text-black"
                                >
                                    Connect Wallet
                                </button>
                            )
                        }

                        {' '}
                        </form>

                    </div>
                </div>

        </div>
    )
}
