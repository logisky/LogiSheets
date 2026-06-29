<script lang="ts">
    import { Spreadsheet, ContextMenu } from '$lib/index'
    import type { ContextMenuItem, ContextMenuContext } from '$lib/index'
    import type { Grid } from '$types/index'
    import type { SelectedData } from 'logisheets-web'

    let spreadsheetComponent: Spreadsheet | undefined = $state()

    // The engine renders no menu of its own — it emits `onContextMenu` and the
    // host renders whatever it likes. This demo renders the engine's optional
    // <ContextMenu> helper, but a host could use any menu UI here.
    let menuVisible = $state(false)
    let menuX = $state(0)
    let menuY = $state(0)
    let menuContext: ContextMenuContext | null = $state(null)
    let selectedData: SelectedData = $state({ source: 'none' })
    let activeSheet = $state(0)
    let grid: Grid | null = $state(null)
    let sheetNames: string[] = $state(['Sheet1'])
    let isLoading = $state(false)
    let fileName = $state('')

    // Debug log for context menu actions
    let debugLog: string[] = $state([])
    function addLog(message: string) {
        const timestamp = new Date().toLocaleTimeString()
        debugLog = [`[${timestamp}] ${message}`, ...debugLog.slice(0, 19)]
    }

    // Custom context menu items demo
    const contextMenuItems: ContextMenuItem[] = [
        {
            id: 'copy',
            label: 'Copy',
            icon: '📋',
            shortcut: '⌘C',
        },
        {
            id: 'paste',
            label: 'Paste',
            icon: '📄',
            shortcut: '⌘V',
        },
        {
            id: 'cut',
            label: 'Cut',
            icon: '✂️',
            shortcut: '⌘X',
            separator: true,
        },
        {
            id: 'insert',
            label: 'Insert',
            icon: '➕',
            children: [
                { id: 'insert-row-above', label: 'Row Above', icon: '⬆️' },
                { id: 'insert-row-below', label: 'Row Below', icon: '⬇️', separator: true },
                { id: 'insert-col-left', label: 'Column Left', icon: '⬅️' },
                { id: 'insert-col-right', label: 'Column Right', icon: '➡️' },
            ]
        },
        {
            id: 'delete',
            label: 'Delete',
            icon: '🗑️',
            children: [
                { id: 'delete-row', label: 'Delete Row', icon: '🗑️' },
                { id: 'delete-col', label: 'Delete Column', icon: '🗑️' },
                { id: 'clear-content', label: 'Clear Content', icon: '🧹' },
            ],
            separator: true,
        },
        {
            id: 'format',
            label: 'Format Cells...',
            icon: '🎨',
        },
        {
            id: 'comment',
            label: 'Add Comment',
            icon: '💬',
        },
    ]

    function handleContextMenuClick(item: ContextMenuItem, context: ContextMenuContext | null) {
        // Build target info string
        let targetInfo = ''
        if (context?.target === 'cell') {
            if (context.row !== undefined && context.col !== undefined) {
                targetInfo = ` [CELL R${context.row + 1}C${context.col + 1}]`
            } else {
                targetInfo = ' [CELL]'
            }
        } else if (context?.target === 'column') {
            targetInfo = ` [COLUMN ${context.col !== undefined ? String.fromCharCode(65 + context.col) : '?'}]`
        } else if (context?.target === 'row') {
            targetInfo = ` [ROW ${context.row !== undefined ? context.row + 1 : '?'}]`
        }

        // Get selection info
        let selectionInfo = ''
        if (context?.selectedData?.data?.ty === 'cellRange') {
            const { startRow, startCol, endRow, endCol } = context.selectedData.data.d
            if (startRow === endRow && startCol === endCol) {
                selectionInfo = ` (selected: R${startRow + 1}C${startCol + 1})`
            } else {
                selectionInfo = ` (selected: R${startRow + 1}C${startCol + 1}:R${endRow + 1}C${endCol + 1})`
            }
        }

        addLog(`"${item.label}"${targetInfo}${selectionInfo}`)

        // Demo: handle specific actions based on target
        switch (item.id) {
            case 'copy':
                addLog('→ Copy action: Would copy selected cells to clipboard')
                break
            case 'paste':
                addLog('→ Paste action: Would paste from clipboard')
                break
            case 'insert-row-above':
                if (context?.target === 'row') {
                    addLog(`→ Insert row above: Would insert row before row ${(context?.row ?? 0) + 1}`)
                } else {
                    addLog(`→ Insert row above: Would insert row at index ${context?.row ?? 0}`)
                }
                break
            case 'insert-row-below':
                if (context?.target === 'row') {
                    addLog(`→ Insert row below: Would insert row after row ${(context?.row ?? 0) + 1}`)
                } else {
                    addLog(`→ Insert row below: Would insert row at index ${(context?.row ?? 0) + 1}`)
                }
                break
            case 'insert-col-left':
                if (context?.target === 'column') {
                    const colName = context.col !== undefined ? String.fromCharCode(65 + context.col) : '?'
                    addLog(`→ Insert column left: Would insert column before column ${colName}`)
                }
                break
            case 'insert-col-right':
                if (context?.target === 'column') {
                    const colName = context.col !== undefined ? String.fromCharCode(65 + context.col) : '?'
                    addLog(`→ Insert column right: Would insert column after column ${colName}`)
                }
                break
            case 'delete-row':
                if (context?.target === 'row') {
                    addLog(`→ Delete row: Would delete row ${(context?.row ?? 0) + 1}`)
                } else {
                    addLog(`→ Delete row: Would delete row ${(context?.row ?? 0) + 1}`)
                }
                break
            case 'delete-col':
                if (context?.target === 'column') {
                    const colName = context.col !== undefined ? String.fromCharCode(65 + context.col) : '?'
                    addLog(`→ Delete column: Would delete column ${colName}`)
                }
                break
            case 'clear-content':
                addLog('→ Clear content: Would clear selected cells')
                break
        }
    }

    async function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement
        if (!input.files || !input.files[0]) return

        const file = input.files[0]
        fileName = file.name
        isLoading = true

        try {
            const buffer = await file.arrayBuffer()
            const data = new Uint8Array(buffer)
            await spreadsheetComponent?.loadWorkbook(data, file.name)

            // Get sheet names from data service
            const service = spreadsheetComponent?.getDataService()
            if (service) {
                const sheets = service.getCacheAllSheetInfo()
                sheetNames = sheets.map(s => s.name)
            }
        } catch (err) {
            console.error('Failed to load workbook:', err)
        } finally {
            isLoading = false
        }
    }

    function handleSheetChange(idx: number) {
        activeSheet = idx
        spreadsheetComponent?.setActiveSheet(idx)
    }

    function formatSelectedCell(): string {
        const data = selectedData.data
        if (!data) return ''
        if (data.ty === 'cellRange') {
            const { startRow, startCol, endRow, endCol } = data.d
            if (startRow === endRow && startCol === endCol) {
                return `R${startRow + 1}C${startCol + 1}`
            }
            return `R${startRow + 1}C${startCol + 1}:R${endRow + 1}C${endCol + 1}`
        }
        return ''
    }
</script>

<div class="app">
    <header class="toolbar">
        <div class="toolbar-left">
            <h1 class="logo">LogiSheets Engine</h1>
            <label class="file-input-label">
                <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onchange={handleFileSelect}
                />
                Open File
            </label>
            {#if fileName}
                <span class="file-name">{fileName}</span>
            {/if}
        </div>
        <div class="toolbar-right">
            <span class="cell-reference">{formatSelectedCell()}</span>
        </div>
    </header>

    <div class="spreadsheet-area">
        {#if isLoading}
            <div class="loading">Loading...</div>
        {/if}
        <Spreadsheet
            bind:this={spreadsheetComponent}
            bind:selectedData
            bind:activeSheet
            showSheetTabs={false}
            onSelectedDataChange={(data) => selectedData = data}
            onGridChange={(g) => grid = g}
            onContextMenu={(context, x, y) => {
                menuContext = context
                menuX = x
                menuY = y
                menuVisible = true
            }}
        />
        <ContextMenu
            visible={menuVisible}
            x={menuX}
            y={menuY}
            items={contextMenuItems}
            context={menuContext}
            onItemClick={handleContextMenuClick}
            onClose={() => (menuVisible = false)}
        />
    </div>

    <!-- Debug Panel for Context Menu -->
    <aside class="debug-panel">
        <div class="debug-header">
            <span class="debug-title">🐛 Debug Log</span>
            <button class="debug-clear" onclick={() => debugLog = []}>Clear</button>
        </div>
        <div class="debug-content">
            {#if debugLog.length === 0}
                <div class="debug-hint">Right-click on cells to see context menu actions here</div>
            {:else}
                {#each debugLog as log}
                    <div class="debug-log-item">{log}</div>
                {/each}
            {/if}
        </div>
    </aside>

    <footer class="sheet-tabs">
        {#each sheetNames as name, idx}
            <button
                class="sheet-tab"
                class:active={idx === activeSheet}
                onclick={() => handleSheetChange(idx)}
            >
                {name}
            </button>
        {/each}
    </footer>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
        padding: 0 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
    }

    .toolbar-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .toolbar-right {
        display: flex;
        align-items: center;
    }

    .logo {
        font-size: 18px;
        font-weight: 600;
        color: #1a73e8;
    }

    .file-input-label {
        padding: 8px 16px;
        background: #1a73e8;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    }

    .file-input-label:hover {
        background: #1557b0;
    }

    .file-input-label input {
        display: none;
    }

    .file-name {
        font-size: 14px;
        color: #666;
    }

    .cell-reference {
        font-size: 14px;
        color: #333;
        font-family: monospace;
        background: #fff;
        padding: 4px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        min-width: 120px;
        text-align: center;
    }

    .spreadsheet-area {
        flex: 1;
        position: relative;
        overflow: hidden;
    }

    .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 18px;
        color: #666;
        z-index: 100;
    }

    .sheet-tabs {
        display: flex;
        height: 32px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
        padding: 0 8px;
        gap: 4px;
        align-items: flex-end;
    }

    .sheet-tab {
        padding: 6px 16px;
        background: #e8e8e8;
        border: none;
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        transition: background 0.2s;
    }

    .sheet-tab:hover {
        background: #ddd;
    }

    .sheet-tab.active {
        background: white;
        box-shadow: 0 -1px 2px rgba(0,0,0,0.1);
    }

    /* Debug Panel Styles */
    .debug-panel {
        position: fixed;
        right: 16px;
        top: 60px;
        width: 320px;
        max-height: 300px;
        background: #1e1e1e;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 11px;
    }

    .debug-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #2d2d2d;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #3d3d3d;
    }

    .debug-title {
        color: #fff;
        font-weight: 600;
    }

    .debug-clear {
        padding: 2px 8px;
        background: #404040;
        color: #ccc;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
    }

    .debug-clear:hover {
        background: #505050;
    }

    .debug-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        max-height: 240px;
    }

    .debug-hint {
        color: #666;
        font-style: italic;
        padding: 8px 0;
    }

    .debug-log-item {
        color: #4fc3f7;
        padding: 4px 0;
        border-bottom: 1px solid #333;
        word-break: break-word;
    }

    .debug-log-item:last-child {
        border-bottom: none;
    }
</style>
