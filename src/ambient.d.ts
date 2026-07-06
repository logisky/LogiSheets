// Ambient declarations for non-code imports (CSS/SCSS modules, stylesheets,
// images). These used to come from `react-scripts`' type definitions; they are
// kept explicit here now that the CRA/CRACO toolchain has been removed. Webpack
// resolves the actual files via css-loader / style-loader / asset modules.

declare module '*.module.scss' {
    const classes: {readonly [key: string]: string}
    export default classes
}

declare module '*.module.css' {
    const classes: {readonly [key: string]: string}
    export default classes
}

// Side-effect stylesheet imports, e.g. `import './App.scss'`.
declare module '*.scss'
declare module '*.css'

declare module '*.png' {
    const src: string
    export default src
}

declare module '*.jpg' {
    const src: string
    export default src
}

declare module '*.jpeg' {
    const src: string
    export default src
}

declare module '*.gif' {
    const src: string
    export default src
}

declare module '*.svg' {
    const src: string
    export default src
}
