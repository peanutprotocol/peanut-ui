'use client'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import './carousel.css'

import Slider from 'react-slick'
import Card from '../Card'

const Carousel = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="carousel-container">
            <Slider dots={true} infinite={true} speed={500} slidesToShow={1} slidesToScroll={1}>
                {children}
            </Slider>
        </div>
    )
}

export default Carousel
