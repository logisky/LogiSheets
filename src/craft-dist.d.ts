// Build-time constants injected by webpack's DefinePlugin from
// crafts.config.json (see resolveCraftTools() in webpack.config.ts). They
// select which crafts the panel offers, per the CRAFT_DIST distribution.
declare const __CRAFT_TOOLS__: {label: string; value: string}[]
declare const __DEFAULT_CRAFT__: string
