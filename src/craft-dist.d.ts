// Build-time constants injected by Vite's `define` from crafts.config.json
// (see resolveCraftTools() in vite.config.ts). They select which bundled
// crafts the panel offers and which registry crafts get installed, per the
// CRAFT_DIST distribution.
// `label` carries every language the registry knows for that craft — the
// panel picks one at render, so the list follows a runtime language switch.
declare const __CRAFT_TOOLS__: {
    label: Record<string, string>
    value: string
}[]
declare const __DEFAULT_CRAFT__: string
// Every BUNDLED craft id (crafts.config.json → `registry`), whichever
// distribution this is. An installed craft may not reuse one.
declare const __RESERVED_CRAFT_IDS__: string[]
// Registry craft ids this distribution installs on the app's first online
// start (crafts.config.json → distribution `install`, plus `devInstall` in dev).
declare const __CRAFT_AUTO_INSTALL__: string[]
// Base URL of the craft registry (crafts.config.json → `craftRegistry`): where
// `index.json` and the `.craft` packages it lists are served.
declare const __CRAFT_REGISTRY_URL__: string
// True in the dev server: Browse also lists registry crafts marked unlisted.
declare const __SHOW_UNLISTED_CRAFTS__: boolean

// The locale this distribution is built for (crafts.config.json → `locale`).
// It is the DEFAULT only: a language the user picked explicitly outranks it.
// See src/core/i18n/i18n.tsx.
declare const __APP_LOCALE__: string
