import React from 'react';
export declare function Select({ value, onValueChange, children, }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function SelectTrigger({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function SelectValue({ placeholder }: {
    placeholder?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function SelectContent({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function SelectItem({ value, children, }: {
    value: string;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
