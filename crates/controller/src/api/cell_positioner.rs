use itertools::Itertools;

use super::worksheet::Worksheet;
use crate::errors::Result;

#[derive(Debug, Clone)]
pub struct CellPositioner<const INTERVAL: usize> {
    cache_height: Vec<(usize, f64)>,
    cache_width: Vec<(usize, f64)>,
}

impl<const INTERVAL: usize> CellPositioner<INTERVAL> {
    pub fn new() -> Self {
        CellPositioner {
            cache_height: vec![],
            cache_width: vec![],
        }
    }

    pub fn clear(&mut self) {
        self.cache_height = vec![];
        self.cache_width = vec![];
    }

    pub fn get_row_start_y(&mut self, row: usize, ws: &Worksheet) -> Result<f64> {
        let (mut curr, mut result) = self.find_closest_cache_height(row);
        if curr == row {
            return Ok(result);
        }
        let reverse = curr > row;

        while curr != row {
            if ws.is_row_hidden(row) {
                curr = advance(reverse, curr);
                continue;
            }
            let h = ws.get_row_height(curr)?;
            result = if reverse { result - h } else { result + h };
            curr = advance(reverse, curr);
            self.add_cache(true, curr, result);
        }
        Ok(result)
    }

    pub fn get_col_start_x(&mut self, col: usize, ws: &Worksheet) -> Result<f64> {
        let (mut curr, mut result) = self.find_closest_cache_width(col);
        if curr == col {
            return Ok(result);
        }
        let reverse = curr > col;

        while curr != col {
            if ws.is_col_hidden(col) {
                curr = advance(reverse, curr);
                continue;
            }
            let w = ws.get_col_width(curr)?;
            result = if reverse { result - w } else { result + w };
            curr = advance(reverse, curr);
            self.add_cache(true, curr, result);
        }
        Ok(result)
    }

    pub fn get_nearest_row_with_given_y(
        &mut self,
        y: f64,
        before: bool,
        ws: &Worksheet,
    ) -> Result<(usize, f64)> {
        let (mut curr_idx, mut curr_h) = self.find_closest_cache_before_y(y);
        let mut h = 0.;
        while curr_h < y {
            if ws.is_row_hidden(curr_idx) {
                curr_idx += 1;
                continue;
            }
            h = ws.get_row_height(curr_idx)?;
            curr_idx += 1;
            curr_h += h;
            self.add_cache(true, curr_idx, curr_h);
        }

        if before {
            if curr_idx > 1 && curr_h > h {
                curr_idx -= 1;
                curr_h -= h;
            }
        }
        return Ok((curr_idx, curr_h));
    }

    pub fn get_nearest_col_with_given_x(
        &mut self,
        x: f64,
        before: bool,
        ws: &Worksheet,
    ) -> Result<(usize, f64)> {
        let (mut curr_idx, mut curr_w) = self.find_closest_cache_before_x(x);
        let mut w = 0.;
        while curr_w < x {
            if ws.is_col_hidden(curr_idx) {
                curr_idx += 1;
                continue;
            }
            w = ws.get_col_width(curr_idx)?;
            curr_idx += 1;
            curr_w += w;
            self.add_cache(false, curr_idx, curr_w);
        }

        if before {
            if curr_idx > 1 && curr_w > w {
                curr_idx -= 1;
                curr_w -= w;
            }
        }
        return Ok((curr_idx, curr_w));
    }

    fn find_closest_cache_before_x(&self, x: f64) -> (usize, f64) {
        if self.cache_width.is_empty() {
            return (0, 0.);
        }

        let r = self.cache_width.iter().find_position(|(_, v)| *v > x);
        if let Some((idx, _)) = r {
            if idx > 0 {
                self.cache_width.get(idx - 1).unwrap().clone()
            } else {
                (0, 0.)
            }
        } else {
            self.cache_width.last().unwrap().clone()
        }
    }

    fn find_closest_cache_before_y(&self, y: f64) -> (usize, f64) {
        if self.cache_height.is_empty() {
            return (0, 0.);
        }

        let r = self.cache_height.iter().find_position(|(_, v)| *v > y);
        if let Some((idx, _)) = r {
            if idx > 0 {
                self.cache_height.get(idx - 1).unwrap().clone()
            } else {
                (0, 0.)
            }
        } else {
            self.cache_height.last().unwrap().clone()
        }
    }

    fn find_closest_cache_width(&self, col: usize) -> (usize, f64) {
        if self.cache_width.is_empty() {
            return (0, 0.);
        }

        for (c, x) in self.cache_width.iter() {
            if c.abs_diff(col) <= INTERVAL / 2 {
                return (*c, *x);
            }
        }
        let result = self.cache_width.last().unwrap();
        *result
    }

    fn find_closest_cache_height(&self, row: usize) -> (usize, f64) {
        if self.cache_height.is_empty() {
            return (0, 0.);
        }

        for (r, y) in self.cache_height.iter() {
            if r.abs_diff(row) <= usize::from(INTERVAL / 2) {
                return (*r, *y);
            }
        }
        let result = self.cache_height.last().unwrap();
        *result
    }

    fn add_cache(&mut self, height: bool, k: usize, v: f64) -> bool {
        let cache = if height {
            &mut self.cache_height
        } else {
            &mut self.cache_width
        };
        if cache.is_empty() {
            cache.push((k, v));
            return true;
        }

        let last = cache.last().unwrap();
        if k - last.0 >= INTERVAL {
            cache.push((k, v));
            return true;
        }
        return false;
    }
}

#[inline]
fn advance(reverse: bool, curr: usize) -> usize {
    if reverse {
        curr - 1
    } else {
        curr + 1
    }
}
