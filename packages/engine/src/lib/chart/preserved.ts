/**
 * Labels for charts the core keeps but does not draw.
 *
 * `ChartInfo.preservedKind` is set for a chart that survives a save untouched
 * yet cannot be rendered or edited here — the chartEx family, named by its
 * `layoutId`, or `chart` for a classic chart whose part did not parse. The
 * layer draws a placeholder for it; this names what the placeholder stands in
 * for.
 */

const LABELS: Record<string, string> = {
    waterfall: 'Waterfall chart',
    treemap: 'Treemap chart',
    sunburst: 'Sunburst chart',
    funnel: 'Funnel chart',
    boxWhisker: 'Box & whisker chart',
    // A histogram's series is laid out as clustered columns over bins.
    clusteredColumn: 'Histogram chart',
    paretoLine: 'Pareto chart',
    regionMap: 'Map chart',
}

export function preservedChartLabel(kind: string): string {
    return LABELS[kind] ?? 'Chart'
}
