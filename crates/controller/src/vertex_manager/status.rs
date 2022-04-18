use im::{HashMap, HashSet};
use logisheets_base::{NameId, SheetId};
use logisheets_parser::ast;

use super::vertex::{FormulaId, SheetRangeVertex, StsRangeVertex, Vertex};

use super::graph::Graph;

// Check out this link: https://rust-lang.github.io/async-book/04_pinning/01_chapter.html
// Use Pin<T> to use the self-referential struct here.
#[derive(Debug, Clone)]
pub struct Status {
    pub graph: Graph<Vertex>,
    pub formulas: HashMap<FormulaId, ast::Node>,
    pub names: HashMap<NameId, ast::Node>,
    pub range_vertices: HashMap<SheetId, HashSet<SheetRangeVertex>>,
    pub sts_vertices: HashSet<StsRangeVertex>,
}

impl Default for Status {
    fn default() -> Self {
        Status {
            graph: Graph {
                deps: HashMap::new(),
                rdeps: HashMap::new(),
            },
            formulas: HashMap::new(),
            names: HashMap::new(),
            range_vertices: HashMap::new(),
            sts_vertices: HashSet::new(),
        }
    }
}
