/**
 * Every craft has a standalone iframe, which is used to render the craft
 * and implement the craft's logic. Crafts can be built from different origins,
 * which means the iframe must use the `postMessage` API to communicate with the parent.
 *
 * The CraftClient is used to send messages to the parent in the iframe.
 */
export class CraftClient {
    public constructor() {}
}
