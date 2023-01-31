use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;
use std::fmt;
use std::hash::Hash;

pub enum CalcUnit<V>
where
    V: Clone + Hash + Eq,
{
    Cycle(Vec<V>),
    Node(V),
}

enum CalcStatus {
    Popped,
    Processed,
    OnStack,
}

pub fn calc_order<V, F>(rdeps_fetcher: &F, dirty_nodes: HashSet<V>) -> VecDeque<CalcUnit<V>>
where
    V: Clone + Hash + Eq + fmt::Debug,
    F: Fn(&V) -> Vec<V>,
{
    let mut entrance_time: HashMap<V, u32> = HashMap::new();
    let mut low: HashMap<V, u32> = HashMap::new();
    let mut node_status: HashMap<V, CalcStatus> = HashMap::new();
    let mut scc_id: u32 = 0;
    let mut scc_map: HashMap<V, u32> = HashMap::new();
    let mut time: u32 = 0;
    let orders = dirty_nodes.into_iter().map(|v| {
        let calc_status = node_status.get(&v);
        if calc_status.is_some() {
            return vec![];
        }
        let mut dfs_stack: Vec<V> = vec![v.clone()];
        let mut scc_stack: Vec<V> = vec![];
        node_status.insert(v.clone(), CalcStatus::OnStack);
        let mut calc_order_desc: Vec<CalcUnit<V>> = vec![];
        while dfs_stack.len() > 0 {
            let u = dfs_stack.get(dfs_stack.len() - 1).unwrap().clone();
            let u_status = node_status.get(&u).unwrap();
            match u_status {
                CalcStatus::OnStack => {
                    entrance_time.insert(u.clone(), time);
                    low.insert(u.clone(), time);
                    scc_stack.push(u.clone());
                    time += 1;
                    let rdeps = rdeps_fetcher(&u);
                    rdeps.iter().for_each(|e| {
                        if entrance_time.get(e).is_none() {
                            dfs_stack.push(e.clone());
                            node_status.insert(e.clone(), CalcStatus::OnStack);
                        }
                    });
                    node_status.insert(u, CalcStatus::Processed);
                }
                CalcStatus::Processed => {
                    let init_u_low = low.get(&u).unwrap().clone();
                    let u_low = rdeps_fetcher(&u).iter().fold(init_u_low, |prev, rdep| {
                        if scc_map.get(rdep).is_none() {
                            low.get(rdep)
                                .map_or(prev, |l| std::cmp::min(prev, l.clone()))
                        } else {
                            prev
                        }
                    });
                    low.insert(u.clone(), u_low);
                    let u_entrance = entrance_time.get(&u).unwrap().clone();
                    if u_entrance == u_low {
                        let mut curr_scc: Vec<V> = vec![];
                        loop {
                            let n = scc_stack.pop();
                            match n {
                                Some(scc) => {
                                    curr_scc.push(scc.clone());
                                    if scc == u {
                                        break;
                                    }
                                }
                                None => break,
                            }
                        }
                        if curr_scc.len() > 1 {
                            curr_scc.iter().for_each(|s| {
                                scc_map.insert(s.clone(), scc_id);
                            });
                            calc_order_desc.push(CalcUnit::Cycle(curr_scc));
                        } else {
                            let node = curr_scc.into_iter().next().unwrap();
                            calc_order_desc.push(CalcUnit::Node(node.clone()));
                            scc_map.insert(node, scc_id);
                        }
                        scc_id += 1;
                    }
                    node_status.insert(u, CalcStatus::Popped);
                }
                CalcStatus::Popped => {
                    dfs_stack.pop();
                }
            };
        }
        calc_order_desc
    });
    orders.fold(VecDeque::<CalcUnit<V>>::new(), |mut prev, c| {
        c.into_iter().rev().for_each(|e| {
            prev.push_back(e);
        });
        prev
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::collections::HashSet;

    use super::{calc_order, CalcUnit};
    use crate::formula_manager::graph::Graph;
    use im::OrdSet;
    use itertools::Itertools;

    #[test]
    fn node_test1() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(5, 6);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(6);
        let node = calc_order(&rdeps_fetcher, dirty_nodes);
        assert_eq!(node.len(), 2);
        let mut iter = node.into_iter();
        let calc_unit = iter.next().unwrap();
        match calc_unit {
            CalcUnit::Cycle(_) => panic!(),
            CalcUnit::Node(n) => assert_eq!(n, 6),
        }
        let calc_unit = iter.next().unwrap();
        match calc_unit {
            CalcUnit::Cycle(_) => panic!(),
            CalcUnit::Node(n) => assert_eq!(n, 5),
        }
    }

    #[test]
    fn node_test2() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(5, 6);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(4);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        assert_eq!(order.len(), 3);
        let mut iter = order.into_iter();
        let calc_unit = iter.next().unwrap();
        match calc_unit {
            CalcUnit::Cycle(_) => panic!(),
            CalcUnit::Node(n) => assert_eq!(n, 4),
        }
    }

    #[test]
    fn node_test3() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //   \ /
        //    3
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(4, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(5, 6);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(3);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        assert_eq!(order.len(), 5);
        let mut nodes_order = HashMap::<u32, usize>::new();
        order.into_iter().enumerate().for_each(|(i, u)| match u {
            CalcUnit::Cycle(_) => panic!(),
            CalcUnit::Node(n) => {
                nodes_order.insert(n, i);
            }
        });
        let get_order = |num: u32| -> usize { nodes_order.get(&num).unwrap().clone() };
        assert!(get_order(3) < get_order(2));
        assert!(get_order(3) < get_order(4));
        assert!(get_order(4) < get_order(5));
        assert!(get_order(1) < get_order(5));
    }

    #[test]
    fn node_test4() {
        //   1
        //   |
        //   2
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(2);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        assert_eq!(order.len(), 2);
        let mut iter = order.into_iter();
        let first = iter.next().unwrap();
        match first {
            CalcUnit::Cycle(_) => panic!(),
            CalcUnit::Node(n) => assert_eq!(n, 2),
        }
    }

    #[test]
    fn node_order_test() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(5, 6);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(4);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        let nodes = order
            .into_iter()
            .map(|c| match c {
                CalcUnit::Cycle(_) => todo!(),
                CalcUnit::Node(n) => n,
            })
            .collect::<Vec<_>>();
        assert_eq!(nodes, vec![4, 1, 5]);
    }

    #[test]
    fn node_order_test2() {
        // 2   1   5
        //  \  |  /
        //     4
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(2, 4);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(4);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        let nodes = order
            .into_iter()
            .map(|c| match c {
                CalcUnit::Cycle(_) => todo!(),
                CalcUnit::Node(n) => n,
            })
            .collect::<Vec<_>>();
        assert_eq!(nodes, vec![4, 1, 2, 5]);
    }

    #[test]
    fn order_set() {
        let mut ordset = OrdSet::<u32>::new();
        ordset.insert(3);
        ordset.insert(1);
        ordset.insert(5);
        ordset.insert(4);
        let nodes = ordset.into_iter().collect::<Vec<_>>();
        assert_eq!(nodes, vec![1, 3, 4, 5]);
    }

    #[test]
    fn cycle_test() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        //  |
        //  1
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(3, 1);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(5, 6);
        let rdeps_fetcher = |r: &u32| -> Vec<u32> {
            let set = match graph.get_rdeps(r) {
                Some(s) => s.clone(),
                None => HashSet::new().into(),
            };
            let mut v = set.into_iter().collect_vec();
            v.sort();
            v
        };
        let mut dirty_nodes = HashSet::<u32>::new();
        dirty_nodes.insert(4);
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        let mut nodes_order = HashMap::<u32, usize>::new();
        let mut cycles_order = HashMap::<Vec<u32>, usize>::new();
        assert_eq!(order.len(), 3);
        order
            .into_iter()
            .enumerate()
            .for_each(|(i, unit)| match unit {
                CalcUnit::Cycle(c) => {
                    cycles_order.insert(c, i);
                }
                CalcUnit::Node(n) => {
                    nodes_order.insert(n, i);
                }
            });
        let get_nodes_order = |num: u32| -> usize { nodes_order.get(&num).unwrap().clone() };
        let get_cycles_order =
            |cycle: &Vec<u32>| -> usize { cycles_order.get(cycle).unwrap().clone() };
        assert!(get_nodes_order(4) < get_nodes_order(5));
        assert!(get_nodes_order(4) < get_cycles_order(&vec![2, 3, 1]));
    }
}
