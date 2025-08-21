use imbl::hashmap::HashMap;
use logisheets_base::{Addr, CellId, NameId, SheetId};
use logisheets_parser::ast;

use super::{calculator::calculator::calc, get_cell_id_from_vertex};
use crate::formula_manager::Vertex;

use super::{
    calculator::calc_vertex::{CalcValue, Value},
    connector::Connector,
};

pub struct CycleCalculator<'a, C>
where
    C: Connector,
{
    pub vertices: Vec<Vertex>,
    pub error: f32,
    pub iter_limit: u16,
    pub connector: &'a mut C,
    pub _names: &'a HashMap<NameId, ast::Node>,
    pub formulas: &'a HashMap<(SheetId, CellId), ast::Node>,
}

impl<'a, C> CycleCalculator<'a, C>
where
    C: Connector,
{
    pub fn start(self) {
        let mut times = 0_u16;
        let mut finish = false;
        let connector = self.connector;
        let formulas = self.formulas;
        let nodes = self
            .vertices
            .into_iter()
            .map(|v| get_cell_id_from_vertex(&v, connector))
            .flatten()
            .collect::<Vec<_>>();
        let error = self.error;
        let mut last_calc = vec![CalcValue::Scalar(Value::Blank); nodes.len()];
        while times < self.iter_limit && !finish {
            let mut this_calc = Vec::<CalcValue>::with_capacity(nodes.len());
            nodes.iter().for_each(|v| match formulas.get(v) {
                Some(node) => {
                    let curr_sheet = v.0;
                    let curr_addr = connector
                        .get_cell_idx(curr_sheet, &v.1)
                        .map_or(Addr::default(), |(row, col)| Addr { row, col });
                    connector.set_curr_cell(curr_sheet, curr_addr);
                    let res = calc(node, connector);
                    connector.commit_calc_values(v.clone(), res.clone());
                    this_calc.push(res);
                }
                None => this_calc.push(CalcValue::Scalar(Value::Blank)),
            });
            if last_calc
                .iter()
                .zip(this_calc.iter())
                .all(|(l, t)| meet_error(l, t, error))
            {
                finish = true;
            }
            times += 1;
            last_calc = this_calc;
        }
    }
}

fn meet_error(v1: &CalcValue, v2: &CalcValue, error: f32) -> bool {
    match (v1, v2) {
        (CalcValue::Scalar(s1), CalcValue::Scalar(s2)) => match (s1, s2) {
            (Value::Blank, Value::Blank) => true,
            (Value::Number(n1), Value::Number(n2)) => (*n1 - *n2).abs() < error as f64,
            (Value::Text(t1), Value::Text(t2)) => t1 == t2,
            (Value::Boolean(b1), Value::Boolean(b2)) => *b1 == *b2,
            (Value::Error(e1), Value::Error(e2)) => e1 == e2,
            _ => false,
        },
        (CalcValue::Range(_), CalcValue::Range(_)) => true,
        (CalcValue::Cube(_), CalcValue::Cube(_)) => true,
        _ => false,
    }
}
