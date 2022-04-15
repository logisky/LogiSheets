use crate::calc_engine::calculator::calc_vertex::CalcVertex;
use parser::ast;
use rand::{thread_rng, Rng};

pub fn calc(args: Vec<CalcVertex>) -> CalcVertex {
    if args.len() > 0 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut rng = thread_rng();
    CalcVertex::from_number(rng.gen())
}
