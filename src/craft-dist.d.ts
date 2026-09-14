// Build-time constants injected by Vite's `define` from crafts.config.json
// (see resolveCraftTools() in vite.config.ts). They select which crafts the
// panel offers, per the CRAFT_DIST distribution.
// `label` carries every language the registry knows for that craft — the
// panel picks one at render, so the list follows a runtime language switch.
declare const __CRAFT_TOOLS__: {
    label: Record<string, string>
    value: string
}[]
declare const __DEFAULT_CRAFT__: string

// The locale this distribution is built for (crafts.config.json → `locale`).
// It is the DEFAULT only: a language the user picked explicitly outranks it.
// See src/core/i18n/i18n.tsx.
declare const __APP_LOCALE__: string
