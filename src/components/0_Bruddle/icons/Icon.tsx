import classNames from 'classnames'
import React from 'react'

export type NavIconsName =
    | 'home'
    | 'wallet'
    | 'history'
    | 'settings'
    | 'support'
    | 'send'
    | 'request'
    | 'docs'
    | 'cashout'

interface NavIconsProps extends React.SVGProps<SVGSVGElement> {
    name: NavIconsName
    size?: number
}

export const NavIcons: React.FC<NavIconsProps> = ({ name, size = 24, className, ...props }) => {
    const renderIcon = () => {
        switch (name) {
            case 'home':
                return (
                    <>
                        <path
                            d="M5 14.1473C5 13.3198 5.34173 12.5292 5.94437 11.9622L12.6296 5.67297C13.3996 4.94856 14.6004 4.94856 15.3704 5.67296L22.0556 11.9622C22.6583 12.5292 23 13.3198 23 14.1473V21.0002C23 22.1048 22.1046 23.0002 21 23.0002H7C5.89543 23.0002 5 22.1048 5 21.0002V14.1473Z"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <path
                            d="M16.4001 22.8356H17.4001V21.8356V19.0537C17.4001 17.3969 16.057 16.0537 14.4001 16.0537H13.6001C11.9432 16.0537 10.6001 17.3969 10.6001 19.0537V21.8356V22.8356H11.6001H16.4001Z"
                            stroke="black"
                            strokeWidth="1.5"
                            className="stroke-current"
                            fill="none"
                        />
                    </>
                )

            case 'wallet':
                return (
                    <path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V7.5H19V5H5V19H19V16.5H21V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM13 17C12.45 17 11.9792 16.8042 11.5875 16.4125C11.1958 16.0208 11 15.55 11 15V9C11 8.45 11.1958 7.97917 11.5875 7.5875C11.9792 7.19583 12.45 7 13 7H20C20.55 7 21.0208 7.19583 21.4125 7.5875C21.8042 7.97917 22 8.45 22 9V15C22 15.55 21.8042 16.0208 21.4125 16.4125C21.0208 16.8042 20.55 17 20 17H13ZM20 15V9H13V15H20ZM16 13.5C16.4167 13.5 16.7708 13.3542 17.0625 13.0625C17.3542 12.7708 17.5 12.4167 17.5 12C17.5 11.5833 17.3542 11.2292 17.0625 10.9375C16.7708 10.6458 16.4167 10.5 16 10.5C15.5833 10.5 15.2292 10.6458 14.9375 10.9375C14.6458 11.2292 14.5 11.5833 14.5 12C14.5 12.4167 14.6458 12.7708 14.9375 13.0625C15.2292 13.3542 15.5833 13.5 16 13.5Z" />
                )
            case 'history':
                return (
                    <path d="M12 22C9.41672 22 7.17505 21.1417 5.27505 19.425C3.37505 17.7083 2.30005 15.5667 2.05005 13H4.07505C4.32505 15.0167 5.20422 16.6875 6.71255 18.0125C8.22088 19.3375 9.98338 20 12 20C14.2334 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2334 4 12 4C10.5667 4 9.23755 4.35417 8.01255 5.0625C6.78755 5.77083 5.81672 6.75 5.10005 8H8.00005V10H2.20005C2.68338 7.66667 3.84172 5.75 5.67505 4.25C7.50838 2.75 9.61672 2 12 2C13.3834 2 14.6834 2.2625 15.9 2.7875C17.1167 3.3125 18.175 4.025 19.075 4.925C19.975 5.825 20.6875 6.88333 21.2125 8.1C21.7375 9.31667 22 10.6167 22 12C22 13.3833 21.7375 14.6833 21.2125 15.9C20.6875 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6875 15.9 21.2125C14.6834 21.7375 13.3834 22 12 22ZM14.8 16.2L11 12.4V7H13V11.6L16.2 14.8L14.8 16.2Z" />
                )
            case 'settings':
                return (
                    <path d="M9.24995 22L8.84995 18.8C8.63328 18.7167 8.42912 18.6167 8.23745 18.5C8.04578 18.3833 7.85828 18.2583 7.67495 18.125L4.69995 19.375L1.94995 14.625L4.52495 12.675C4.50828 12.5583 4.49995 12.4458 4.49995 12.3375V11.6625C4.49995 11.5542 4.50828 11.4417 4.52495 11.325L1.94995 9.375L4.69995 4.625L7.67495 5.875C7.85828 5.74167 8.04995 5.61667 8.24995 5.5C8.44995 5.38333 8.64995 5.28333 8.84995 5.2L9.24995 2H14.75L15.15 5.2C15.3666 5.28333 15.5708 5.38333 15.7625 5.5C15.9541 5.61667 16.1416 5.74167 16.325 5.875L19.3 4.625L22.05 9.375L19.475 11.325C19.4916 11.4417 19.5 11.5542 19.5 11.6625V12.3375C19.5 12.4458 19.4833 12.5583 19.45 12.675L22.025 14.625L19.275 19.375L16.325 18.125C16.1416 18.2583 15.95 18.3833 15.75 18.5C15.55 18.6167 15.35 18.7167 15.15 18.8L14.75 22H9.24995ZM11 20H12.975L13.325 17.35C13.8416 17.2167 14.3208 17.0208 14.7625 16.7625C15.2041 16.5042 15.6083 16.1917 15.975 15.825L18.45 16.85L19.425 15.15L17.275 13.525C17.3583 13.2917 17.4166 13.0458 17.45 12.7875C17.4833 12.5292 17.5 12.2667 17.5 12C17.5 11.7333 17.4833 11.4708 17.45 11.2125C17.4166 10.9542 17.3583 10.7083 17.275 10.475L19.425 8.85L18.45 7.15L15.975 8.2C15.6083 7.81667 15.2041 7.49583 14.7625 7.2375C14.3208 6.97917 13.8416 6.78333 13.325 6.65L13 4H11.025L10.675 6.65C10.1583 6.78333 9.67912 6.97917 9.23745 7.2375C8.79578 7.49583 8.39162 7.80833 8.02495 8.175L5.54995 7.15L4.57495 8.85L6.72495 10.45C6.64162 10.7 6.58328 10.95 6.54995 11.2C6.51662 11.45 6.49995 11.7167 6.49995 12C6.49995 12.2667 6.51662 12.525 6.54995 12.775C6.58328 13.025 6.64162 13.275 6.72495 13.525L4.57495 15.15L5.54995 16.85L8.02495 15.8C8.39162 16.1833 8.79578 16.5042 9.23745 16.7625C9.67912 17.0208 10.1583 17.2167 10.675 17.35L11 20ZM12.05 15.5C13.0166 15.5 13.8416 15.1583 14.525 14.475C15.2083 13.7917 15.55 12.9667 15.55 12C15.55 11.0333 15.2083 10.2083 14.525 9.525C13.8416 8.84167 13.0166 8.5 12.05 8.5C11.0666 8.5 10.2375 8.84167 9.56245 9.525C8.88745 10.2083 8.54995 11.0333 8.54995 12C8.54995 12.9667 8.88745 13.7917 9.56245 14.475C10.2375 15.1583 11.0666 15.5 12.05 15.5Z" />
                )
            case 'support':
                return (
                    <>
                        <path
                            d="M16.2046 12.7904L16.2045 12.7918C16.0388 14.2717 16.9501 14.765 17.1987 15.176C17.4472 15.5871 17.8615 16.4915 17.7786 17.807C17.6958 19.1224 17.0329 20.1912 16.5359 20.7668C16.0721 21.3038 15.2103 22 13.9675 22C12.8904 22 12.2276 21.5067 11.5649 20.6023C11.1514 20.0381 10.6644 18.949 10.8192 17.6425C10.9849 16.2448 11.482 15.5871 11.8134 14.765C12.1448 13.9428 12.2277 13.285 11.2335 12.3807L11.2299 12.3774C10.8265 12.0106 10.0516 11.3057 10.2393 9.25646C10.4878 6.54328 13.0436 5.78357 14.5475 6.05002C16.8673 6.46103 17.1987 7.69435 17.3644 8.68095C17.5301 9.66754 16.9501 11.0652 16.5359 11.723C16.2783 12.1319 16.2143 12.7036 16.2046 12.7904Z"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <path
                            d="M9.7168 9.66783C9.7168 10.9557 9.98827 11.9997 9.19922 11.9997C8.41016 11.9997 7.77051 10.9557 7.77051 9.66783C7.77051 8.37996 8.41016 7.33594 9.19922 7.33594C9.98827 7.33594 9.7168 8.37996 9.7168 9.66783Z"
                            fill="black"
                            className="fill-current"
                        />
                        <path
                            d="M19.731 8.72984C19.731 10.0177 19.0913 11.0617 18.3023 11.0617C17.5132 11.0617 17.6986 10.0177 17.6986 8.72984C17.6986 7.44197 17.5132 6.39795 18.3023 6.39795C19.0913 6.39795 19.731 7.44197 19.731 8.72984Z"
                            fill="black"
                            className="fill-current"
                        />
                        <ellipse cx="14.189" cy="11.908" rx="1.07958" ry="0.846459" className="fill-current" />
                        <path
                            d="M14.8398 12.0001C16.371 12.5884 19.1457 12.2843 18.3633 10.5942"
                            className="stroke-current"
                            fill="none"
                        />
                    </>
                )
            case 'send':
                return (
                    <>
                        <circle
                            cx="13.9932"
                            cy="14"
                            r="9"
                            stroke="black"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <rect x="12.9932" y="10.4307" width="2" height="8.5" rx="1" className="fill-current" />
                        <rect
                            x="13.9741"
                            y="8.00977"
                            width="2"
                            height="7.43407"
                            rx="1"
                            transform="rotate(45 13.9741 8.00977)"
                            className="fill-current"
                        />
                        <rect
                            width="2"
                            height="7.09821"
                            rx="1"
                            transform="matrix(-0.707107 0.707107 0.707107 0.707107 13.9766 8)"
                            className="fill-current"
                        />
                    </>
                )
            case 'request':
                return (
                    <>
                        <circle
                            cx="13.9932"
                            cy="14"
                            r="9"
                            transform="rotate(-180 13.9932 14)"
                            stroke="black"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <rect
                            x="14.9932"
                            y="17.5693"
                            width="2"
                            height="8.5"
                            rx="1"
                            transform="rotate(-180 14.9932 17.5693)"
                            className="fill-current"
                        />
                        <rect
                            x="14.0122"
                            y="19.9897"
                            width="2"
                            height="7.43407"
                            rx="1"
                            transform="rotate(-135 14.0122 19.9897)"
                            className="fill-current"
                        />
                        <rect
                            width="2"
                            height="7.09821"
                            rx="1"
                            transform="matrix(0.707107 -0.707107 -0.707107 -0.707107 14.0098 20)"
                            className="fill-current"
                        />
                    </>
                )
            case 'docs':
                return (
                    <>
                        <path
                            d="M20.8081 23H7.17822C6.62594 23 6.17822 22.5523 6.17822 22V6C6.17822 5.44772 6.62594 5 7.17822 5H17.5382C17.7827 5 18.0187 5.08958 18.2016 5.25179L21.4716 8.15137C21.6856 8.34116 21.8081 8.61352 21.8081 8.89958V22C21.8081 22.5523 21.3604 23 20.8081 23Z"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <path
                            d="M15.9932 7.54785V10.0498C15.9932 10.602 16.4409 11.0498 16.9932 11.0498H19.3361"
                            strokeLinecap="round"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                    </>
                )
            case 'cashout':
                return (
                    <>
                        <circle
                            cx="13.9929"
                            cy="9.3"
                            r="2.425"
                            transform="rotate(-180 13.9929 9.3)"
                            stroke="black"
                            className="stroke-current"
                            strokeWidth="1.5"
                            fill="none"
                        />
                        <rect
                            x="14.9336"
                            y="22.0063"
                            width="1.8"
                            height="5.83165"
                            rx="0.9"
                            transform="rotate(-180 14.9336 22.0063)"
                            className="fill-current"
                        />
                        <rect
                            x="13.9927"
                            y="24.3276"
                            width="1.8"
                            height="6.20965"
                            rx="0.9"
                            transform="rotate(-135 13.9927 24.3276)"
                            className="fill-current"
                        />
                        <rect
                            width="1.8"
                            height="6.20965"
                            rx="0.9"
                            transform="matrix(-0.707107 0.707107 0.707107 0.707107 10.875 18.6641)"
                            className="fill-current"
                        />
                        <rect
                            x="4.79316"
                            y="4.58906"
                            width="18.4"
                            height="9.4"
                            rx="1.2"
                            stroke="black"
                            strokeWidth="1.6"
                            className="stroke-current"
                            fill="none"
                        />
                    </>
                )
        }
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            className={classNames('fill-current', className)}
            {...props}
        >
            {renderIcon()}
        </svg>
    )
}
