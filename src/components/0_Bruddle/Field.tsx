'use client'

import { twMerge } from 'tailwind-merge'
import Icon from '../Global/Icon'
import { useFormContext } from 'react-hook-form'
import classNames from 'classnames'
import React from 'react'
import { DetailedHTMLProps, InputHTMLAttributes, useState } from 'react'

type FieldProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
    containerClassname?: HTMLDivElement['className']
    label?: string
    icon?: string
}

export const Field = React.forwardRef(
    ({ label, icon, containerClassname, ...props }: FieldProps, ref: React.Ref<HTMLInputElement>) => {
        const { type, className } = props
        const { formState } = useFormContext()

        const error = formState?.errors[props.name ?? '']
        const success = !error && props.value

        const [visiblePassword, setVisiblePassword] = useState<boolean>(false)

        return (
            <div className={classNames('w-full', containerClassname)}>
                <div className="">
                    {label && <div className="mb-3 text-xs font-bold">{label}</div>}
                    <div className="relative">
                        <input
                            ref={ref}
                            className={twMerge(
                                `h-16 w-full rounded-sm border border-n-1 bg-white px-5 text-sm font-bold text-n-1 outline-none transition-colors placeholder:text-n-3 focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1 ${
                                    icon || type === 'password' ? 'pr-15' : ''
                                } ${success ? '!border-green-1 pr-15' : ''} ${error ? '!border-pink-1 pr-15' : ''} ${className}`
                            )}
                            type={(type === 'password' && (visiblePassword ? 'text' : 'password')) || type || 'text'}
                            {...props}
                        />
                        {icon && type !== 'password' && !success && !error && (
                            <Icon
                                className="icon-20 pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 fill-n-1 dark:fill-white"
                                name={icon}
                            />
                        )}
                        {type === 'password' && !success && !error && (
                            <button
                                className="group absolute bottom-0 right-0 top-0 w-15 outline-none"
                                type="button"
                                onClick={() => setVisiblePassword(!visiblePassword)}
                            >
                                <Icon
                                    className="icon-20 fill-n-2 transition-colors group-hover:fill-n-1 dark:fill-white/75 dark:group-hover:fill-white"
                                    name={visiblePassword ? 'eye' : 'eye-slash'}
                                />
                            </button>
                        )}
                        {(success || error) && (
                            <Icon
                                className={`icon-20 pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 ${
                                    success ? 'fill-green-1' : 'fill-pink-1'
                                }`}
                                name={success ? 'check-circle' : 'info-circle'}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    }
)
