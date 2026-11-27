<script lang="ts">
    interface Props {
        x?: number
        y?: number
        width?: number
        height?: number
        /**
         * Whether typing goes to this view. Blue when it does, grey when the
         * keyboard is elsewhere, so the highlight never promises input that
         * would land somewhere else.
         */
        active?: boolean
    }

    let { x = 0, y = 0, width = 0, height = 0, active = true }: Props = $props()
</script>

<div
    class="selector"
    class:inactive={!active}
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

    .selector.inactive {
        border-color: #9aa0a6;
        background: rgba(60, 64, 67, 0.06);
    }
</style>
