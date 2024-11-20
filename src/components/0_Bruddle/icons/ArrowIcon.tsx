import React from 'react'

interface ArrowIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number
    color?: string
}

export const ArrowIcon: React.FC<ArrowIconProps> = ({ size = 53, color = '#1C1B1F', ...props }) => {
    return (
        <svg width={size} height={size} viewBox="0 0 53 53" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <mask
                id="mask0_185_6747"
                style={{ maskType: 'alpha' }}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="53"
                height="53"
            >
                <rect width="53" height="53" fill="#D9D9D9" />
            </mask>
            <g mask="url(#mask0_185_6747)">
                <path
                    d="M24.5 42.5V18.15L13.3 29.35L10.5 26.5L26.5 10.5L42.5 26.5L39.7 29.35L28.5 18.15V42.5H24.5Z"
                    fill={color}
                />
            </g>
        </svg>
    )
}
