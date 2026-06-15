// Re-export everything the host HTML wires up at runtime. Keep this
// thin — the wiring (DOM, events, API key persistence) lives in
// index.html so the craft follows the same pattern as factory-simulator.
export {
    Agent,
    BUILDER_TOOLS,
    INSPECT_TOOLS,
    EDIT_TOOLS,
    ToolRegistry,
    toUiBubbles,
    toLlmMessages,
} from 'logician'

export type {
    AgentOptions,
    ChatBubble,
    Conversation,
    ConversationEvent,
    ConversationStore,
    ConversationSummary,
    LlmClient,
} from 'logician'

export {IdbConversationStore} from './storage-idb'
export {AnthropicBrowserClient, LlmError} from './llm-anthropic'
export type {LlmErrorCode, RequestInfo} from './llm-anthropic'

export const name = 'watson'
