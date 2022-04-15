mod cell;
mod sheet_range;
mod sts_range;

use controller_base::NameId;

use super::graph::Graph;

pub type FormulaId = cell::FormulaId;
pub type SheetRangeVertex = sheet_range::SheetRangeVertex;
pub type MutReferenceVertex = sheet_range::MutReferenceVertex;
pub type StsRangeVertex = sts_range::StsRangeVertex;
pub type MutRowRange = sheet_range::MutRowRange;
pub type MutColRange = sheet_range::MutColRange;
pub type MutAddrRange = sheet_range::AddrRange;

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Vertex {
    Cell(FormulaId),
    SheetRange(SheetRangeVertex),
    StsRange(StsRangeVertex),
    External,
    Name(NameId),
}

// We want to sort the vertex in the calculating process. In the calculating
// process, we need to calculate the cell vertex first because of the implicit
// dependencies.
// In the calculate graph, it is hard to record the exact the dependency between
// cell vertex and range vertex. A range vertex often contains too many cell
// vertex . For example, in this formula, SUM(A:B), we can hardly make the range
// vertex(A:B) depends on cell vetices(A1, A2...A1048576 and B1, B2...B1048576).
// We choose another way to express the dependency. When user input a formula,
// we will check all the range vertices and find those affected ranges and
// make a temporary link between them. And in the calculating process, we always
// caculate the cell vertex first.
impl PartialOrd for Vertex {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Vertex {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        let to_u32 = |v: &Self| -> u32 {
            match v {
                Vertex::Cell(_) => 1,
                Vertex::SheetRange(_) => 2,
                Vertex::StsRange(_) => 3,
                Vertex::External => 4,
                Vertex::Name(_) => 5,
            }
        };
        to_u32(self).cmp(&to_u32(other))
    }
}

impl Graph<Vertex> {
    pub fn merge_vertex(self, arg1: &SheetRangeVertex, arg2: &SheetRangeVertex) -> Self {
        let v1 = Vertex::SheetRange(arg1.clone());
        let v2 = Vertex::SheetRange(arg2.clone());
        self.convert_vertex(&v1, v2)
    }

    pub fn remove_sheetrange_vertex(self, arg: &SheetRangeVertex) -> Self {
        let v = Vertex::SheetRange(arg.clone());
        self.delete_vertex(&v)
    }

    pub fn remove_cell_vertex(self, fid: &FormulaId) -> Self {
        let v = Vertex::Cell(fid.clone());
        self.delete_vertex(&v)
    }

    pub fn erase_vertex(self, v: &Vertex) -> Self {
        let new_rdeps = {
            if let Some(deps) = self.deps.get(&v) {
                deps.iter().fold(self.rdeps, |prev, d| {
                    if let Some(rs) = prev.get(d) {
                        prev.update(d.clone(), rs.clone().without(&v))
                    } else {
                        prev
                    }
                })
            } else {
                self.rdeps
            }
        };
        let new_deps = self.deps.without(&v);
        Graph {
            deps: new_deps,
            rdeps: new_rdeps,
        }
    }
}
