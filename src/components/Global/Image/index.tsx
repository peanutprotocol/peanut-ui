'use client'
import { useState } from "react";
import { default as NextImage, ImageProps } from "next/image";

const Image = ({ className, ...props }: ImageProps) => {
    const [loaded, setLoaded] = useState(false);

    return (
        <NextImage
            className={`inline-block align-top opacity-0 transition-opacity ${
                loaded ? "opacity-100" : ""
            } ${className}`}
            onLoad={() => setLoaded(true)}
            {...props}
        />
    );
};

export default Image;
