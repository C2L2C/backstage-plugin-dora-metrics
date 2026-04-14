import React from 'react';
export declare function Card({ children, style, onClick, onMouseEnter, onMouseLeave, }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}): import("react/jsx-runtime").JSX.Element;
export declare function CardLabel({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function CardValue({ value, unit }: {
    value: number | string;
    unit: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function CardFooter({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function CardDescription({ children, muted, }: {
    children: React.ReactNode;
    muted?: boolean;
}): import("react/jsx-runtime").JSX.Element;
