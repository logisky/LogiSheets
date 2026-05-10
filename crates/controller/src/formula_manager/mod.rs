pub mod ctx;
mod executors;
pub mod graph;

use graph::Graph;
use imbl::HashMap;
use logisheets_base::{BlockFieldId, BlockId, CubeId, ExtRefId, NameId, RangeId, SheetId};
use logisheets_parser::ast;

use crate::CellId;

use self::executors::add_ast_node;
pub use executors::FormulaExecutor;

#[derive(Debug, Clone)]
pub struct FormulaManager {
    pub graph: Graph<Vertex>,
    pub formulas: HashMap<(SheetId, CellId), ast::Node>,
    pub names: HashMap<NameId, ast::Node>,
}

impl FormulaManager {
    pub fn new() -> Self {
        FormulaManager {
            graph: Graph::<Vertex>::new(),
            formulas: HashMap::new(),
            names: HashMap::new(),
        }
    }

    // Only used in loading a file. In a loading file process, we do not
    // need to find out the dirty vertex.
    pub fn add_ast_node(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        range_id: RangeId,
        ast: ast::Node,
    ) {
        add_ast_node(self, sheet_id, cell_id, range_id, ast)
    }
}

/// Vertex of the formula dependency graph.
///
/// `Block`, `BlockKey`, `BlockAll` are virtual nodes — they don't correspond
/// to a cell that gets recomputed. Instead they fan dirty propagation into
/// the BlockRef formulas that depend on them. Dirtying happens at the
/// formula-executor level, side-channel from cell writes (see
/// `executors/mod.rs::execute`), because the set of cells in a block can
/// change dynamically and we don't want to maintain explicit graph edges for
/// each block-cell.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Vertex {
    Range(SheetId, RangeId),
    Cube(CubeId),
    Ext(ExtRefId),
    Name(NameId),
    /// One field-column (or field-row) of a single block. Dirtied when any
    /// cell in that field changes.
    Block(SheetId, BlockId, BlockFieldId),
    /// The key column/row of a block. Dirtied when any key cell changes —
    /// reorders or relabels can flip which row a `BLOCKREF(_, key, _)`
    /// resolves to.
    BlockKey(SheetId, BlockId),
    /// The entire block. Dirtied on structural changes (bind/rebind, row
    /// or field added/removed). Also used as the catch-all dependency for
    /// `BLOCKREFS` since its filters scan multiple fields.
    BlockAll(SheetId, BlockId),
}

impl Ord for Vertex {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (Vertex::Range(_, r1), Vertex::Range(_, r2)) => r1.cmp(r2),
            (Vertex::Cube(c1), Vertex::Cube(c2)) => c1.cmp(c2),
            (Vertex::Ext(e1), Vertex::Ext(e2)) => e1.cmp(e2),
            (Vertex::Name(n1), Vertex::Name(n2)) => n1.cmp(n2),
            (Vertex::Range(_, _), _) => std::cmp::Ordering::Less,
            (Vertex::Name(_), _) => std::cmp::Ordering::Less,
            (Vertex::Cube(_), _) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        }
    }
}

impl PartialOrd for Vertex {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
