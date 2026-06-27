<script lang="ts">
    import type { SheetInfo, Transaction, Payload, CreateSheet } from 'logisheets-web'

    interface Props {
        sheets: readonly SheetInfo[]
        activeSheet: number
        onActiveSheetChange?: (index: number) => void
        onAddSheet?: () => void
        onDeleteSheet?: (index: number) => void
        onRenameSheet?: (index: number, newName: string) => void
        /** Optional handler to execute transactions (for add/delete/rename) */
        onTransaction?: (transaction: Transaction) => Promise<boolean>
    }

    let {
        sheets = [],
        activeSheet = 0,
        onActiveSheetChange,
        onAddSheet,
        onDeleteSheet,
        onRenameSheet,
        onTransaction,
    }: Props = $props()

    let contextMenuOpen = $state(false)
    let contextMenuX = $state(0)
    let contextMenuY = $state(0)
    let contextMenuIndex = $state(0)
    let editingIndex = $state<number | null>(null)
    let editingName = $state('')

    function handleTabClick(index: number) {
        onActiveSheetChange?.(index)
    }

    function handleContextMenu(e: MouseEvent, index: number) {
        e.preventDefault()
        e.stopPropagation()
        contextMenuIndex = index
        contextMenuX = e.clientX
        contextMenuY = e.clientY
        contextMenuOpen = true
    }

    function closeContextMenu() {
        contextMenuOpen = false
    }

    function handleAddSheet() {
        if (onAddSheet) {
            onAddSheet()
        } else if (onTransaction) {
            const newName = findNewSheetName(sheets.map(s => s.name))
            const newIdx = sheets.length
            const payload: Payload = {
                type: 'createSheet',
                value: { idx: newIdx, newName: newName } as CreateSheet,
            }
            onTransaction({ payloads: [payload], undoable: true, temp: false }).then(success => {
                if (!success) {
                    onActiveSheetChange?.(newIdx)
                }
            })
        }
    }

    function handleDeleteSheet() {
        closeContextMenu()
        onDeleteSheet?.(contextMenuIndex)
    }

    function startRename() {
        closeContextMenu()
        editingIndex = contextMenuIndex
        editingName = sheets[contextMenuIndex]?.name ?? ''
    }

    function finishRename() {
        if (editingIndex !== null && editingName.trim()) {
            onRenameSheet?.(editingIndex, editingName.trim())
        }
        editingIndex = null
        editingName = ''
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            finishRename()
        } else if (e.key === 'Escape') {
            editingIndex = null
            editingName = ''
        }
    }

    function findNewSheetName(sheetNames: readonly string[]): string {
        const sheetPattern = /^Sheet(\d+)$/
        const numbers = sheetNames
            .map(name => {
                const match = name.match(sheetPattern)
                return match ? parseInt(match[1], 10) : null
            })
            .filter((num): num is number => num !== null)
        const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
        return `Sheet${nextNumber}`
    }

    function getTabColor(sheet: SheetInfo): string | undefined {
        if (!sheet.tabColor) return undefined
        // Convert ARGB to CSS color
        const argb = Number(sheet.tabColor)
        if (isNaN(argb)) return undefined
        const a = (argb >> 24) & 0xff
        const r = (argb >> 16) & 0xff
        const g = (argb >> 8) & 0xff
        const b = argb & 0xff
        if (a === 0) return undefined
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`
    }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="sheet-tabs">
    <div class="tabs-container">
        {#each sheets as sheet, i}
            <button
                class="tab"
                class:active={i === activeSheet}
                style:background-color={getTabColor(sheet)}
                onclick={() => handleTabClick(i)}
                oncontextmenu={(e) => handleContextMenu(e, i)}
            >
                {#if editingIndex === i}
                    <input
                        type="text"
                        class="tab-input"
                        bind:value={editingName}
                        onblur={finishRename}
                        onkeydown={handleKeydown}
                    />
                {:else}
                    <span class="tab-name">{sheet.name}</span>
                {/if}
            </button>
        {/each}
    </div>
    
    <button class="add-btn" onclick={handleAddSheet} title="Add sheet">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
    </button>

    {#if contextMenuOpen}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
            class="context-menu"
            style="left: {contextMenuX}px; top: {contextMenuY}px;"
            role="menu"
            tabindex="0"
            onkeydown={(e) => e.key === 'Escape' && closeContextMenu()}
        >
            <button class="menu-item" onclick={startRename}>Rename</button>
            {#if sheets.length > 1}
                <button class="menu-item danger" onclick={handleDeleteSheet}>Delete</button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .sheet-tabs {
        display: flex;
        align-items: center;
        height: 32px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
        padding: 0 8px;
        gap: 4px;
    }

    .tabs-container {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: 1;
        overflow-x: auto;
        scrollbar-width: none;
    }

    .tabs-container::-webkit-scrollbar {
        display: none;
    }

    .tab {
        display: flex;
        align-items: center;
        padding: 4px 12px;
        border: none;
        border-radius: 4px 4px 0 0;
        background: #e8e8e8;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        white-space: nowrap;
        transition: background 0.15s;
    }

    .tab:hover {
        background: #ddd;
    }

    .tab.active {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-bottom: 1px solid #fff;
        margin-bottom: -1px;
    }

    .tab-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tab-input {
        width: 80px;
        border: 1px solid #1976d2;
        border-radius: 2px;
        padding: 2px 4px;
        font-size: 13px;
        outline: none;
    }

    .add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        color: #666;
        transition: background 0.15s, color 0.15s;
    }

    .add-btn:hover {
        background: #e0e0e0;
        color: #333;
    }

    .context-menu {
        position: fixed;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        min-width: 120px;
        padding: 4px 0;
    }

    .menu-item {
        display: block;
        width: 100%;
        padding: 8px 16px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        font-size: 13px;
        color: #333;
    }

    .menu-item:hover {
        background: #f5f5f5;
    }

    .menu-item.danger {
        color: #d32f2f;
    }

    .menu-item.danger:hover {
        background: #ffebee;
    }
</style>
