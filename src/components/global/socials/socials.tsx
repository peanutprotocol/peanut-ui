import x_svg from '@/assets/icons/x-icon.svg'
import telegram_svg from '@/assets/icons/telegram-icon.svg'
import mail_svg from '@/assets/icons/mail-icon.svg'
import whatsapp_icon from '@/assets/icons/whatsapp-icon.svg'

export function socialsComponent() {
    return (
        //TODO: add redirects
        <div className={'flex flex-row gap-2 '}>
            <a href={''}>
                <img src={telegram_svg.src} className={'h-8 w-8'} />
            </a>
            <a href={''}>
                <img src={whatsapp_icon.src} className={'h-8 w-8'} />
            </a>
            <a href={''}>
                <img src={mail_svg.src} className={'h-8 w-8'} />
            </a>
            <a href={''}>
                <img src={x_svg.src} className={'h-8 w-8'} />
            </a>
        </div>
    )
}
