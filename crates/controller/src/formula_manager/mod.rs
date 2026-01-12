pub mod ctx;
mod executors;
pub mod graph;

use graph::Graph;
use imbl::HashMap;
use logisheets_base::{CubeId, ExtRefId, NameId, RangeId, SheetId};
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

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Vertex {
    Range(SheetId, RangeId),
    Cube(CubeId),
    Ext(ExtRefId),
    Name(NameId),
    BlockSchema(String),
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
