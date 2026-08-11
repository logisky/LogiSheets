// Build-time constants injected by Vite's `define` from crafts.config.json
// (see resolveCraftTools() in vite.config.ts). They select which crafts the
// panel offers, per the CRAFT_DIST distribution.
declare const __CRAFT_TOOLS__: {label: string; value: string}[]
declare const __DEFAULT_CRAFT__: string
