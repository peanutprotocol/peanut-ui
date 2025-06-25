import { FC, SVGProps } from 'react'

interface ChevronDownIconProps extends SVGProps<SVGSVGElement> {
    size?: number | string
}

export const ChevronDownIcon: FC<ChevronDownIconProps> = (props) => (
    <svg viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M4.938 7.562L8 10.624l3.062-3.062.938.937-4 4-4-4z" fill="currentColor" />
    </svg>
)
