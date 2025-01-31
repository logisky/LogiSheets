import {StBorderStyle} from 'logisheets-web'

export interface PreviewLineProps {
    style: StBorderStyle
}

// export enum BorderStyleTy

export const borderStyleNames = [
    'dashDot',
    'dashDotDot',
    'dashed',
    'dotted',
    'double',
    'hair',
    'medium',
    'mediumDashDot',
    'mediumDashDotDot',
    'mediumDashed',
    // 'slantDashDot',
    'thick',
    'thin',
    'none',
]

export const PreviewLineComponent = ({style}: PreviewLineProps) => {
    if (style === 'none') return <div>(None)</div>

    return (
        <svg width="100%" height="10" xmlns="http://www.w3.org/2000/svg">
            {style === 'dashed' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                />
            )}
            {style === 'mediumDashed' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="3"
                    strokeDasharray="6,4"
                />
            )}
            {style === 'dotted' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="2"
                    strokeDasharray="2,4"
                />
            )}
            {style === 'double' && (
                <>
                    <line
                        x1="0"
                        y1="3"
                        x2="100%"
                        y2="3"
                        stroke="black"
                        strokeWidth="1"
                    />
                    <line
                        x1="0"
                        y1="7"
                        x2="100%"
                        y2="7"
                        stroke="black"
                        strokeWidth="1"
                    />
                </>
            )}
            {style === 'hair' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="1.2"
                />
            )}
            {style === 'medium' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="3"
                />
            )}
            {style === 'dashDot' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="2"
                    strokeDasharray="6,4,2,4"
                />
            )}
            {style === 'mediumDashDot' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="3"
                    strokeDasharray="6,4,2,4"
                />
            )}
            {style === 'dashDotDot' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="2"
                    strokeDasharray="6,4,2,4,2,4"
                />
            )}
            {style === 'mediumDashDotDot' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="3"
                    strokeDasharray="6,4,2,4,2,4"
                />
            )}
            {style === 'thick' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="4"
                />
            )}
            {style === 'thin' && (
                <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke="black"
                    strokeWidth="1"
                />
            )}
        </svg>
    )
}
