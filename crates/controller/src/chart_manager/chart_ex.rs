//! The arithmetic behind the chartEx kinds, done here rather than in a
//! renderer so every host — the grid, the Node runtime, an agent reading a
//! chart — gets the same numbers Excel draws.
//!
//! None of it is stored: a chart's values are read live on every
//! `get_charts`, and these turn them into what is plotted.

use logisheets_workbook::prelude::ChartExBinning;

/// One box of a box & whisker chart.
#[derive(Debug, Clone, PartialEq)]
pub struct BoxStats {
    /// The whisker ends: the most extreme values within 1.5 × IQR of the box,
    /// which is how Excel draws them — not the data's min and max.
    pub min: f64,
    pub q1: f64,
    pub median: f64,
    pub q3: f64,
    pub max: f64,
    pub mean: f64,
    /// Everything beyond the whiskers.
    pub outliers: Vec<f64>,
}

/// `QUARTILE.EXC` or `QUARTILE.INC` of an ascending slice.
///
/// Exclusive is Excel's box & whisker default and ranks at `p(n + 1)`;
/// inclusive ranks at `p(n − 1) + 1`. A rank outside the data clamps to its
/// end rather than erroring, which is what the chart does with tiny groups
/// where the worksheet function would return `#NUM!`.
pub fn quartile(sorted: &[f64], p: f64, inclusive: bool) -> f64 {
    let n = sorted.len();
    if n == 0 {
        return 0.0;
    }
    let rank = if inclusive {
        p * (n as f64 - 1.0) + 1.0
    } else {
        p * (n as f64 + 1.0)
    };
    if rank <= 1.0 {
        return sorted[0];
    }
    if rank >= n as f64 {
        return sorted[n - 1];
    }
    let lo = rank.floor() as usize;
    let frac = rank - lo as f64;
    sorted[lo - 1] + frac * (sorted[lo] - sorted[lo - 1])
}

pub fn box_stats(values: &[f64], inclusive: bool) -> Option<BoxStats> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let q1 = quartile(&sorted, 0.25, inclusive);
    let median = quartile(&sorted, 0.5, inclusive);
    let q3 = quartile(&sorted, 0.75, inclusive);
    let iqr = q3 - q1;
    let (lo, hi) = (q1 - 1.5 * iqr, q3 + 1.5 * iqr);
    let inside: Vec<f64> = sorted
        .iter()
        .copied()
        .filter(|v| *v >= lo && *v <= hi)
        .collect();
    Some(BoxStats {
        min: inside.first().copied().unwrap_or(q1),
        q1,
        median,
        q3,
        max: inside.last().copied().unwrap_or(q3),
        mean: sorted.iter().sum::<f64>() / sorted.len() as f64,
        outliers: sorted.into_iter().filter(|v| *v < lo || *v > hi).collect(),
    })
}

/// A histogram's bins, labelled the way Excel labels them.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Bins {
    pub labels: Vec<String>,
    pub counts: Vec<f64>,
}

/// More bins than this is a wall of slivers; it only arises from a tiny
/// `binSize` over a wide range, and is clamped rather than honoured.
const MAX_BINS: usize = 1000;

/// Bin `values` by `binning`, or by Excel's automatic rule when it is `None`
/// or names neither a size nor a count.
///
/// The automatic width is Scott's normal reference rule,
/// `3.5 σ / n^(1/3)` with the sample standard deviation — what Excel uses.
/// Bins are right-closed by default, `[a, b]` first and `(a, b]` after; a
/// left-closed binning mirrors that. An `underflow` / `overflow` edge gathers
/// everything beyond it into one bin labelled `≤u` / `>o`.
pub fn histogram(
    values: &[f64],
    binning: Option<&ChartExBinning>,
    fmt: impl Fn(f64) -> String,
) -> Bins {
    if values.is_empty() {
        return Bins::default();
    }
    let default = ChartExBinning::default();
    let b = binning.unwrap_or(&default);
    let min = values.iter().copied().fold(f64::INFINITY, f64::min);
    let max = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let start = b.underflow.unwrap_or(min);
    let end = b.overflow.unwrap_or(max);
    let span = end - start;

    let (width, count) = if span <= 0.0 {
        (0.0, 1)
    } else if let Some(c) = b.bin_count.filter(|c| *c > 0) {
        (span / c as f64, c as usize)
    } else {
        let w = match b.bin_size.filter(|w| *w > 0.0) {
            Some(w) => w,
            None => scott_width(values),
        };
        if w <= 0.0 {
            (span, 1)
        } else {
            (w, ((span / w).ceil() as usize).clamp(1, MAX_BINS))
        }
    };

    let mut counts = vec![0.0; count];
    let mut under = 0.0;
    let mut over = 0.0;
    for v in values.iter().copied() {
        if let Some(u) = b.underflow {
            if (b.closed_left && v < u) || (!b.closed_left && v <= u) {
                under += 1.0;
                continue;
            }
        }
        if let Some(o) = b.overflow {
            if (b.closed_left && v >= o) || (!b.closed_left && v > o) {
                over += 1.0;
                continue;
            }
        }
        let idx = if width <= 0.0 {
            0
        } else {
            let pos = (v - start) / width;
            if b.closed_left {
                pos.floor() as isize
            } else {
                pos.ceil() as isize - 1
            }
        };
        counts[idx.clamp(0, count as isize - 1) as usize] += 1.0;
    }

    let edge = |k: usize| start + width * k as f64;
    let mut labels: Vec<String> = (0..count)
        .map(|k| {
            let (a, z) = (
                fmt(edge(k)),
                fmt(if width <= 0.0 { end } else { edge(k + 1) }),
            );
            // The outermost bin is closed on both sides — unless an
            // underflow / overflow bin already owns that edge.
            let first = k == 0 && b.underflow.is_none();
            let last = k + 1 == count && b.overflow.is_none();
            match (b.closed_left, first, last) {
                (false, true, _) => format!("[{a}, {z}]"),
                (false, false, _) => format!("({a}, {z}]"),
                (true, _, true) => format!("[{a}, {z}]"),
                (true, _, false) => format!("[{a}, {z})"),
            }
        })
        .collect();
    if let Some(u) = b.underflow {
        labels.insert(
            0,
            format!("{}{}", if b.closed_left { "<" } else { "≤" }, fmt(u)),
        );
        counts.insert(0, under);
    }
    if let Some(o) = b.overflow {
        labels.push(format!(
            "{}{}",
            if b.closed_left { "≥" } else { ">" },
            fmt(o)
        ));
        counts.push(over);
    }
    Bins { labels, counts }
}

fn scott_width(values: &[f64]) -> f64 {
    let n = values.len() as f64;
    if n < 2.0 {
        return 0.0;
    }
    let mean = values.iter().sum::<f64>() / n;
    let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
    3.5 * var.sqrt() / n.cbrt()
}

/// Sum `values` per distinct category, in first-seen order — a histogram or
/// Pareto "by category". A blank category is a group of its own, as in Excel.
pub fn aggregate(categories: &[String], values: &[f64]) -> (Vec<String>, Vec<f64>) {
    let mut names: Vec<String> = Vec::new();
    let mut sums: Vec<f64> = Vec::new();
    for (c, v) in categories.iter().zip(values.iter()) {
        match names.iter().position(|n| n == c) {
            Some(i) => sums[i] += v,
            None => {
                names.push(c.clone());
                sums.push(*v);
            }
        }
    }
    (names, sums)
}

/// Sort a Pareto's bars descending (ties keep their order) and return the
/// running share of the total, in percent, that its line plots.
pub fn pareto(labels: Vec<String>, values: Vec<f64>) -> (Vec<String>, Vec<f64>, Vec<f64>) {
    let mut pairs: Vec<(String, f64)> = labels.into_iter().zip(values).collect();
    pairs.sort_by(|a, b| b.1.total_cmp(&a.1));
    let total: f64 = pairs.iter().map(|p| p.1).sum();
    let mut running = 0.0;
    let cumulative = pairs
        .iter()
        .map(|p| {
            running += p.1;
            if total == 0.0 {
                0.0
            } else {
                running / total * 100.0
            }
        })
        .collect();
    let (labels, values) = pairs.into_iter().unzip();
    (labels, values, cumulative)
}

/// A node of a treemap or sunburst hierarchy, flattened: `parent` indexes the
/// same list, and a node's value is the sum of everything beneath it.
#[derive(Debug, Clone, PartialEq)]
pub struct TreeNode {
    pub name: String,
    pub value: f64,
    pub parent: Option<usize>,
}

/// Build the hierarchy from one path per data point, outermost level first,
/// and the point's size.
///
/// Blank levels are skipped, so a point with a blank city hangs directly off
/// its region. A point with no positive size takes no area and is left out,
/// as Excel leaves it out.
pub fn tree(paths: &[Vec<String>], sizes: &[Option<f64>]) -> Vec<TreeNode> {
    let mut nodes: Vec<TreeNode> = Vec::new();
    for (path, size) in paths.iter().zip(sizes.iter()) {
        let Some(size) = size.filter(|s| *s > 0.0) else {
            continue;
        };
        let mut parent: Option<usize> = None;
        for name in path.iter().filter(|n| !n.is_empty()) {
            let at = match nodes
                .iter()
                .position(|n| n.parent == parent && &n.name == name)
            {
                Some(i) => i,
                None => {
                    nodes.push(TreeNode {
                        name: name.clone(),
                        value: 0.0,
                        parent,
                    });
                    nodes.len() - 1
                }
            };
            nodes[at].value += size;
            parent = Some(at);
        }
    }
    nodes
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fmt(n: f64) -> String {
        ssf_rs::jsnum::to_string_js(n)
    }

    #[test]
    fn quartiles_match_excel_exc_and_inc() {
        let v = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        // QUARTILE.EXC({1..8}, 1) = 2.25, QUARTILE.INC = 2.75
        assert_eq!(quartile(&v, 0.25, false), 2.25);
        assert_eq!(quartile(&v, 0.25, true), 2.75);
        assert_eq!(quartile(&v, 0.5, false), 4.5);
        assert_eq!(quartile(&v, 0.75, false), 6.75);
        assert_eq!(quartile(&v, 0.75, true), 6.25);
    }

    #[test]
    fn whiskers_stop_at_the_fences_and_the_rest_are_outliers() {
        let s = box_stats(&[12.0, 15.0, 18.0, 22.0, 25.0, 30.0, 33.0, 90.0], false).unwrap();
        assert_eq!(s.q1, 15.75);
        assert_eq!(s.median, 23.5);
        assert_eq!(s.q3, 32.25);
        assert_eq!(s.min, 12.0);
        assert_eq!(s.max, 33.0, "90 is beyond q3 + 1.5 × IQR");
        assert_eq!(s.outliers, vec![90.0]);
        assert_eq!(s.mean, 30.625);
    }

    #[test]
    fn a_bin_count_splits_the_range_evenly_and_right_closed() {
        let b = ChartExBinning {
            bin_count: Some(4),
            ..Default::default()
        };
        let bins = histogram(&[10.0, 20.0, 30.0, 40.0, 50.0], Some(&b), fmt);
        assert_eq!(
            bins.labels,
            vec!["[10, 20]", "(20, 30]", "(30, 40]", "(40, 50]"]
        );
        assert_eq!(bins.counts, vec![2.0, 1.0, 1.0, 1.0]);
    }

    #[test]
    fn a_left_closed_binning_mirrors_the_labels() {
        let b = ChartExBinning {
            bin_size: Some(10.0),
            closed_left: true,
            ..Default::default()
        };
        let bins = histogram(&[10.0, 20.0, 30.0], Some(&b), fmt);
        assert_eq!(bins.labels, vec!["[10, 20)", "[20, 30]"]);
        assert_eq!(bins.counts, vec![1.0, 2.0]);
    }

    #[test]
    fn underflow_and_overflow_gather_the_tails() {
        let b = ChartExBinning {
            bin_size: Some(10.0),
            underflow: Some(20.0),
            overflow: Some(40.0),
            ..Default::default()
        };
        let bins = histogram(&[5.0, 15.0, 25.0, 35.0, 45.0, 90.0], Some(&b), fmt);
        assert_eq!(bins.labels, vec!["≤20", "(20, 30]", "(30, 40]", ">40"]);
        assert_eq!(bins.counts, vec![2.0, 1.0, 1.0, 2.0]);
    }

    #[test]
    fn automatic_bins_cover_every_value() {
        let v = [12.0, 15.0, 18.0, 22.0, 25.0, 30.0, 33.0, 90.0];
        let bins = histogram(&v, None, fmt);
        assert_eq!(bins.counts.iter().sum::<f64>(), v.len() as f64);
        assert!(bins.labels[0].starts_with("[12, "), "{:?}", bins.labels);
    }

    #[test]
    fn identical_values_make_one_bin() {
        let bins = histogram(&[3.0, 3.0, 3.0], None, fmt);
        assert_eq!(bins.labels, vec!["[3, 3]"]);
        assert_eq!(bins.counts, vec![3.0]);
    }

    #[test]
    fn pareto_sorts_descending_and_accumulates_percent() {
        let (l, v, c) = pareto(
            vec!["a".into(), "b".into(), "c".into()],
            vec![10.0, 30.0, 10.0],
        );
        assert_eq!(l, vec!["b", "a", "c"], "ties keep their order");
        assert_eq!(v, vec![30.0, 10.0, 10.0]);
        assert_eq!(c, vec![60.0, 80.0, 100.0]);
    }

    #[test]
    fn aggregation_sums_per_category_in_first_seen_order() {
        let (n, s) = aggregate(&["x".into(), "y".into(), "x".into()], &[1.0, 2.0, 3.0]);
        assert_eq!(n, vec!["x", "y"]);
        assert_eq!(s, vec![4.0, 2.0]);
    }

    #[test]
    fn a_tree_sums_children_into_parents_and_skips_blank_levels() {
        let paths = vec![
            vec!["East".to_string(), "Shanghai".to_string()],
            vec!["East".to_string(), "Hangzhou".to_string()],
            vec!["West".to_string(), "".to_string()],
            vec!["West".to_string(), "Xian".to_string()],
        ];
        let nodes = tree(&paths, &[Some(40.0), Some(25.0), Some(5.0), None]);
        assert_eq!(
            nodes[0],
            TreeNode {
                name: "East".into(),
                value: 65.0,
                parent: None
            }
        );
        assert_eq!(nodes[1].parent, Some(0));
        let west = nodes.iter().position(|n| n.name == "West").unwrap();
        assert_eq!(nodes[west].value, 5.0, "a blank city sizes its region");
        assert!(!nodes.iter().any(|n| n.name == "Xian"), "no size, no area");
    }
}
