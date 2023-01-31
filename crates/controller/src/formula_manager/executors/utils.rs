use logisheets_base::{CubeId, RangeId};
use std::collections::HashSet;

use crate::{formula_manager::Vertex, SheetId};

pub fn add_dirty_vertices_from_ranges(
    result: &mut HashSet<Vertex>,
    ranges: HashSet<(SheetId, RangeId)>,
) {
    ranges
        .into_iter()
        .map(|(sheet_id, range_id)| Vertex::Range(sheet_id, range_id))
        .for_each(|v| {
            result.insert(v);
        });
}

pub fn add_dirty_vertices_from_cubes(result: &mut HashSet<Vertex>, cubes: HashSet<CubeId>) {
    cubes
        .into_iter()
        .map(|cube| Vertex::Cube(cube))
        .for_each(|v| {
            result.insert(v);
        });
}
