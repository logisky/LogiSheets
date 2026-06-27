<script module lang="ts">
    // Re-export types from the types file for consumers
    export type { ContextMenuItem, ContextMenuContext } from './contextMenuTypes'
</script>

<script lang="ts">
    import { onMount } from 'svelte'
    import type { ContextMenuItem, ContextMenuContext } from './contextMenuTypes'

    // ========================================================================
    // Props
    // ========================================================================

    interface Props {
        /** Whether the menu is visible */
        visible: boolean
        /** X position of the menu */
        x: number
        /** Y position of the menu */
        y: number
        /** Menu items to display */
        items: ContextMenuItem[]
        /** Context when menu was triggered */
        context: ContextMenuContext | null
        /** Called when a menu item is clicked */
        onItemClick?: (item: ContextMenuItem, context: ContextMenuContext | null) => void
        /** Called when menu should close */
        onClose?: () => void
    }

    let {
        visible,
        x,
        y,
        items,
        context,
        onItemClick,
        onClose,
    }: Props = $props()

    // ========================================================================
    // State
    // ========================================================================

    let menuEl: HTMLDivElement | null = $state(null)
    let adjustedX = $state(0)
    let adjustedY = $state(0)
    let activeSubmenu: string | null = $state(null)

    // ========================================================================
    // Position adjustment to keep menu in viewport
    // ========================================================================

    $effect(() => {
        if (visible && menuEl) {
            const rect = menuEl.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            let newX = x
            let newY = y

            // Adjust horizontal position
            if (x + rect.width > viewportWidth - 10) {
                newX = viewportWidth - rect.width - 10
            }

            // Adjust vertical position
            if (y + rect.height > viewportHeight - 10) {
                newY = viewportHeight - rect.height - 10
            }

            adjustedX = Math.max(10, newX)
            adjustedY = Math.max(10, newY)
        }
    })

    // ========================================================================
    // Event Handlers
    // ========================================================================

    function handleItemClick(item: ContextMenuItem, e: MouseEvent) {
        e.stopPropagation()
        if (item.disabled) return
        if (item.children && item.children.length > 0) {
            // Toggle submenu
            activeSubmenu = activeSubmenu === item.id ? null : item.id
            return
        }
        onItemClick?.(item, context)
        onClose?.()
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            onClose?.()
        }
    }

    function handleClickOutside(e: MouseEvent) {
        if (menuEl && !menuEl.contains(e.target as Node)) {
            onClose?.()
        }
    }

    onMount(() => {
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    })
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if visible}
    <div
        bind:this={menuEl}
        class="context-menu"
        style="left: {adjustedX}px; top: {adjustedY}px;"
        role="menu"
        tabindex="-1"
    >
        {#each items as item (item.id)}
            <div class="menu-item-wrapper">
                <button
                    class="menu-item"
                    class:disabled={item.disabled}
                    class:has-children={item.children && item.children.length > 0}
                    role="menuitem"
                    aria-disabled={item.disabled}
                    onclick={(e) => handleItemClick(item, e)}
                    onmouseenter={() => {
                        if (item.children && item.children.length > 0) {
                            activeSubmenu = item.id
                        }
                    }}
                >
                    {#if item.icon}
                        <span class="menu-icon">{item.icon}</span>
                    {:else}
                        <span class="menu-icon-placeholder"></span>
                    {/if}
                    <span class="menu-label">{item.label}</span>
                    {#if item.shortcut}
                        <span class="menu-shortcut">{item.shortcut}</span>
                    {/if}
                    {#if item.children && item.children.length > 0}
                        <span class="menu-arrow">▶</span>
                    {/if}
                </button>

                <!-- Submenu -->
                {#if item.children && item.children.length > 0 && activeSubmenu === item.id}
                    <div class="submenu">
                        {#each item.children as child (child.id)}
                            <button
                                class="menu-item"
                                class:disabled={child.disabled}
                                role="menuitem"
                                aria-disabled={child.disabled}
                                onclick={(e) => handleItemClick(child, e)}
                            >
                                {#if child.icon}
                                    <span class="menu-icon">{child.icon}</span>
                                {:else}
                                    <span class="menu-icon-placeholder"></span>
                                {/if}
                                <span class="menu-label">{child.label}</span>
                                {#if child.shortcut}
                                    <span class="menu-shortcut">{child.shortcut}</span>
                                {/if}
                            </button>
                            {#if child.separator}
                                <div class="menu-separator"></div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
            {#if item.separator}
                <div class="menu-separator"></div>
            {/if}
        {/each}
    </div>
{/if}

<style>
    .context-menu {
        position: fixed;
        min-width: 180px;
        max-width: 300px;
        background: #ffffff;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 4px 0;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
    }

    .menu-item-wrapper {
        position: relative;
    }

    .menu-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 6px 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: #333;
        gap: 8px;
        transition: background 0.1s;
    }

    .menu-item:hover:not(.disabled) {
        background: #f0f0f0;
    }

    .menu-item.disabled {
        color: #999;
        cursor: not-allowed;
    }

    .menu-icon {
        width: 16px;
        text-align: center;
        flex-shrink: 0;
    }

    .menu-icon-placeholder {
        width: 16px;
        flex-shrink: 0;
    }

    .menu-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-shortcut {
        color: #888;
        font-size: 11px;
        margin-left: 16px;
    }

    .menu-arrow {
        font-size: 10px;
        color: #666;
        margin-left: 8px;
    }

    .menu-separator {
        height: 1px;
        background: #e0e0e0;
        margin: 4px 8px;
    }

    .submenu {
        position: absolute;
        left: 100%;
        top: 0;
        min-width: 160px;
        background: #ffffff;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 4px 0;
        z-index: 10001;
    }
</style>
