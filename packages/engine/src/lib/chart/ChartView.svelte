<!--
  Renders a single chart into a sized box using ECharts.

  This is a pure presentational leaf: it owns one ECharts instance, applies the
  option, and resizes/disposes with its lifecycle. Positioning (which cells the
  chart is anchored to, scroll clipping) is the caller's job — the chart layer
  passes an absolute pixel width/height computed from the grid.
-->
<script lang="ts">
    import {onDestroy} from 'svelte'
    import type {EChartsOption} from 'echarts'
    import {echarts} from './echarts'

    interface Props {
        option: EChartsOption
        width: number
        height: number
    }

    let {option, width, height}: Props = $props()

    let el = $state<HTMLDivElement>()
    let chart: ReturnType<typeof echarts.init> | undefined

    // (Re)apply the option whenever it or the mount element changes. The
    // `notMerge` flag ensures a type/series change fully replaces the prior
    // option instead of merging into it.
    $effect(() => {
        if (!el) return
        if (!chart) chart = echarts.init(el, undefined, {renderer: 'canvas'})
        chart.setOption(option, true)
    })

    // Resize follows the anchored pixel box handed down by the layer.
    $effect(() => {
        if (chart && width > 0 && height > 0)
            chart.resize({width, height})
    })

    onDestroy(() => {
        chart?.dispose()
        chart = undefined
    })
</script>

<div bind:this={el} style="width:{width}px;height:{height}px"></div>
