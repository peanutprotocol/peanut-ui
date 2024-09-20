import { useState } from 'react'
import Icon from '@/components/Global/Icon'

type SortingProps = {
    title: string
}

const Sorting = ({ title }: SortingProps) => {
    const [active, setActive] = useState<boolean>(false)
    return (
        <button
            className={`group inline-flex items-center text-xs font-bold transition-colors hover:text-purple-2 sm:text-sm ${
                active ? 'text-purple-2' : ''
            }`}
            onClick={() => setActive(!active)}
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
