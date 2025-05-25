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

    pub fn find_closest_cache_before_x(&self, x: f64) -> (usize, f64) {
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

    pub fn find_closest_cache_before_y(&self, y: f64) -> (usize, f64) {
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

    pub fn find_closest_cache_width(&self, col: usize) -> (usize, f64) {
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

    pub fn find_closest_cache_height(&self, row: usize) -> (usize, f64) {
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

    pub fn add_cache(&mut self, height: bool, k: usize, v: f64) -> bool {
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
