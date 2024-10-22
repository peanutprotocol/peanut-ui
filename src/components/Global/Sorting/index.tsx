import { useState } from 'react'
import Icon from '@/components/Global/Icon'

type SortingProps = {
    title: string
}

const Sorting = ({ title }: SortingProps) => {
    const [active, setActive] = useState<boolean>(false)
    return (
        <button
            className={`group inline-flex cursor-default items-center text-xs font-bold transition-colors ${
                active ? 'text-purple-2' : ''
            }`}
            onClick={() => console.warn('Table sorting disabled')}
            // onClick={() => setActive(!active)} // Currently disabled because the sorting doesn't work and needs to be revisited
        >
            {title}
            {/* <Icon
                className={`ml-1.5 transition-all group-hover:fill-purple-2 dark:fill-white dark:group-hover:fill-purple-2 ${
                    active ? 'rotate-180 fill-purple-2' : ''
                }`}
                name="arrow-up"
            /> */}
        </button>
    )
}

export default Sorting
