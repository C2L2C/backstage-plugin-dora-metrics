import React from 'react';
export declare function Card({ children, style, onClick, onMouseEnter, onMouseLeave, }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}): React.JSX.Element;
export declare function CardLabel({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
export declare function CardValue({ value, unit }: {
    value: number | string;
    unit: string;
}): React.JSX.Element;
export declare function CardFooter({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
export declare function CardDescription({ children, muted, }: {
    children: React.ReactNode;
    muted?: boolean;
}): React.JSX.Element;
