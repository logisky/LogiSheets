/** Where a craft's code lives. Resolved by a host's `CraftRegistry`. */
export interface CraftManifest {
    /**
     * Locator of the headless runtime JS, interpreted by the registry (a URL
     * for logisheets-runtime's HttpCraftRegistry). Empty means the craft has
     * no runtime and a headless host skips it.
     */
    readonly rtJs: string

    /**
     * URL of the craft's browser UI page (loaded in the craft panel iframe).
     */
    readonly html: string
}
