use imbl::HashMap;
use itertools::Itertools;
use num::{Num, NumCast};
use std::{hash::Hash, ops::AddAssign};

#[derive(Debug, Clone)]
pub struct Manager<T, I>
where
    T: Hash + Eq + Clone,
    I: Copy + Eq + AddAssign + Num + NumCast + Hash,
{
    data_to_id: HashMap<T, I>,
    id_to_data: HashMap<I, T>,
    next_available: I,
    // It helps us skip the builtin values when saving files
    init_id: I,
}

impl<T, I> Manager<T, I>
where
    T: Hash + Eq + Clone,
    I: Copy + Eq + AddAssign + Num + NumCast + Hash + Ord,
{
    pub fn new(init_id: I) -> Self {
        Manager {
            data_to_id: HashMap::<T, I>::new(),
            id_to_data: HashMap::<I, T>::new(),
            init_id,
            next_available: init_id,
        }
    }

    pub fn new_with_builtin_values(init_id: I, values: Vec<(I, T)>) -> Self {
        let mut data_to_id = HashMap::<T, I>::new();
        let mut id_to_data = HashMap::<I, T>::new();
        values.into_iter().for_each(|(k, v)| {
            data_to_id.insert(v.clone(), k.clone());
            id_to_data.insert(k, v);
        });
        Manager {
            data_to_id,
            id_to_data,
            init_id,
            next_available: init_id,
        }
    }

    pub fn get_id(&mut self, data: &T) -> I {
        let r = self.data_to_id.get(&data);
        match r {
            Some(id) => id.clone(),
            None => self.registry(data.clone()),
        }
    }

    pub fn get_item(&self, id: I) -> Option<&T> {
        self.id_to_data.get(&id)
    }

    // return the vector of the data whose id is larger than init_id and sort them by id.
    pub fn get_data_sorted_by_id(&self) -> Vec<T> {
        let id_data = self.id_to_data.clone();
        id_data
            .into_iter()
            .filter(|(i, _)| *i >= self.init_id)
            .sorted_by(|(a, _), (b, _)| Ord::cmp(a, b))
            .map(|(_, v)| v)
            .collect()
    }

    pub fn get_data_with_id_sorted_by_id(&self) -> Vec<(I, T)> {
        let id_data = self.id_to_data.clone();
        id_data
            .into_iter()
            .filter(|(i, _)| *i >= self.init_id)
            .sorted_by(|(a, _), (b, _)| Ord::cmp(a, b))
            .collect()
    }

    fn registry(&mut self, data: T) -> I {
        let r = self.next_available;
        self.data_to_id.insert(data.clone(), self.next_available);
        self.id_to_data.insert(self.next_available, data);
        let _1: I = NumCast::from(1usize).unwrap();
        self.next_available += _1;
        r
    }
}
