<script lang="ts">
    interface Props {
        x?: number
        y?: number
        width?: number
        height?: number
    }

    let { x = 0, y = 0, width = 0, height = 0 }: Props = $props()
</script>

<div
    class="selector"
    style="
        left: {x}px;
        top: {y}px;
        width: {width}px;
        height: {height}px;
    "
></div>

<style>
    .selector {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
        border: 2px solid #1a73e8;
        background: rgba(26, 115, 232, 0.08);
        z-index: 10;
    }
</style>
