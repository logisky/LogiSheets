use im::HashMap;

pub struct MatrixValue<T>
where
    T: 'static + Default + Clone,
{
    size: (usize, usize),
    avail_size: (usize, usize),
    data: HashMap<(usize, usize), T>,
    default_value: Vec<Box<dyn Fn(&T) -> T>>,
}

impl<T> std::fmt::Debug for MatrixValue<T>
where
    T: 'static + Default + Clone,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        std::fmt::Result::Ok(())
    }
}

impl<T> Clone for MatrixValue<T>
where
    T: 'static + Default + Clone,
{
    fn clone(&self) -> Self {
        let avail_size = self.avail_size;
        let data = cross_product_usize(0, avail_size.0, 0, avail_size.1)
            .into_iter()
            .map(|(i, j)| {
                let key = (i, j);
                let v = match self.visit(i, j) {
                    Ok(t) => t.clone(),
                    Err(r) => r,
                };
                (key, v)
            })
            .collect::<HashMap<_, _>>();
        MatrixValue {
            size: self.size,
            avail_size: self.avail_size,
            data,
            default_value: vec![],
        }
    }
}

impl<T> MatrixValue<T>
where
    T: 'static + Default + Clone,
{
    pub fn new(r: usize, c: usize) -> Self {
        MatrixValue {
            size: (r, c),
            avail_size: (r, c),
            data: HashMap::new(),
            default_value: vec![],
        }
    }

    pub fn from(data: Vec<Vec<T>>) -> Self {
        let row = data.len();
        let mut col = 0;
        let mut new_data = HashMap::<(usize, usize), T>::new();
        data.into_iter().enumerate().for_each(|(i, r)| {
            r.into_iter().enumerate().for_each(|(j, e)| {
                if j > col {
                    col = j
                }
                new_data.insert((i, j), e);
            })
        });
        MatrixValue {
            size: (row, col + 1),
            avail_size: (row, col + 1),
            data: new_data,
            default_value: vec![],
        }
    }

    pub fn map<F>(self, func: F) -> Self
    where
        F: 'static + Fn(&T) -> T,
    {
        let row = self.avail_size.0;
        let col = self.avail_size.1;
        let new_data =
            cross_product_usize(0, row, 0, col)
                .into_iter()
                .fold(self.data, |prev, (i, j)| {
                    if let Some(d) = prev.get(&(i, j)) {
                        let new_d = func(d);
                        prev.update((i, j), new_d)
                    } else {
                        prev
                    }
                });
        let mut default_value = self.default_value;
        default_value.push(Box::new(func));
        MatrixValue {
            size: self.size,
            avail_size: (row, col),
            data: new_data,
            default_value,
        }
    }

    pub fn calc_scalar(self, scalar: T, func: Box<dyn Fn(&T, &T) -> T>, scalar_lhs: bool) -> Self {
        let f = func;
        let data: HashMap<(usize, usize), T> = self
            .data
            .into_iter()
            .map(|(k, v)| {
                if scalar_lhs {
                    (k, f(&scalar, &v))
                } else {
                    (k, f(&v, &scalar))
                }
            })
            .collect();
        let f = move |para: &T| {
            if scalar_lhs {
                f(&scalar, para)
            } else {
                f(para, &scalar)
            }
        };
        let mut new_default_values = self.default_value;
        new_default_values.push(Box::new(f));
        MatrixValue {
            size: self.size,
            avail_size: self.avail_size,
            data,
            default_value: new_default_values,
        }
    }

    pub fn calc_range(
        self,
        range: MatrixValue<T>,
        func: Box<dyn Fn(&T, &T) -> T>,
        range_lhs: bool,
    ) -> Self {
        let this_avail_size = self.get_avail_size();
        let rival_size = range.get_avail_size();
        let (min_row, max_row) = {
            if this_avail_size.0 > rival_size.0 {
                (rival_size.0, this_avail_size.0)
            } else {
                (this_avail_size.0, rival_size.0)
            }
        };
        let (min_col, max_col) = {
            if this_avail_size.1 > rival_size.1 {
                (rival_size.1, this_avail_size.1)
            } else {
                (this_avail_size.1, rival_size.1)
            }
        };
        let new_size = (max_row, max_col);
        let new_avail_size = (min_row, min_col);
        let new_data = {
            cross_product_usize(0, new_avail_size.0 - 1, 0, new_avail_size.1 - 1)
                .into_iter()
                .fold(HashMap::<(usize, usize), T>::new(), |mut prev, (i, j)| {
                    let v1 = match self.visit(i, j) {
                        Ok(t) => t.clone(),
                        Err(e) => e,
                    };
                    let v2 = match range.visit(i, j) {
                        Ok(t) => t.clone(),
                        Err(e) => e,
                    };
                    let v = {
                        if range_lhs {
                            func(&v2, &v1)
                        } else {
                            func(&v1, &v2)
                        }
                    };
                    prev.insert((i, j), v);
                    prev
                })
        };
        MatrixValue {
            size: new_size,
            avail_size: new_avail_size,
            data: new_data,
            default_value: vec![],
        }
    }

    pub fn get_size(&self) -> (usize, usize) {
        self.size
    }

    pub fn get_avail_size(&self) -> (usize, usize) {
        self.avail_size
    }

    pub fn visit(&self, i: usize, j: usize) -> Result<&T, T> {
        match self.raw_visit(i, j) {
            Some(r) => Ok(r),
            None => Err(self
                .default_value
                .iter()
                .fold(T::default(), |prev, f| f(&prev))),
        }
    }

    pub fn visit_and_insert(&mut self, i: usize, j: usize) -> Option<&T> {
        if self.raw_visit(i, j).is_none() {
            let v = self
                .default_value
                .iter()
                .fold(T::default(), |prev, f| f(&prev));
            self.insert(i, j, v);
        }
        self.raw_visit(i, j)
    }

    pub fn insert(&mut self, i: usize, j: usize, v: T) {
        let (new_i, new_j) = self.get_avail_index(i, j);
        self.data.insert((new_i, new_j), v);
    }

    fn get_avail_index(&self, i: usize, j: usize) -> (usize, usize) {
        let (row, col) = self.get_avail_size();
        let new_i = {
            if i >= row && row == 1 {
                0_usize
            } else {
                i
            }
        };
        let new_j = {
            if j >= col && col == 1 {
                0_usize
            } else {
                j
            }
        };
        (new_i, new_j)
    }

    fn raw_visit(&self, i: usize, j: usize) -> Option<&T> {
        let (new_i, new_j) = self.get_avail_index(i, j);
        self.data.get(&(new_i, new_j))
    }
}

impl<T> IntoIterator for MatrixValue<T>
where
    T: 'static + Default + Clone + std::fmt::Debug,
{
    type Item = T;

    type IntoIter = std::vec::IntoIter<Self::Item>;

    fn into_iter(self) -> Self::IntoIter {
        let avail_size = self.avail_size;
        if avail_size.0 == 0 || avail_size.1 == 0 {
            return vec![].into_iter();
        }
        if self.default_value.len() == 0 {
            return self
                .data
                .iter()
                .map(|(_, v)| v.clone())
                .collect::<Vec<_>>()
                .into_iter();
        }
        cross_product_usize(0, avail_size.0 - 1, 0, avail_size.1 - 1)
            .into_iter()
            .map(|(i, j)| match self.visit(i, j) {
                Ok(t) => t.clone(),
                Err(r) => r,
            })
            .collect::<Vec<_>>()
            .into_iter()
    }
}

pub fn cross_product_usize(
    start_row: usize,
    end_row: usize,
    start_col: usize,
    end_col: usize,
) -> Vec<(usize, usize)> {
    (start_row..end_row + 1)
        .map(|r| (start_col..end_col + 1).map(move |c| (r, c)))
        .flatten()
        .collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn cross_product_usize_test() {
        use super::cross_product_usize;
        let r = cross_product_usize(0, 1, 0, 3);
        assert_eq!(
            r,
            vec![
                (0, 0),
                (0, 1),
                (0, 2),
                (0, 3),
                (1, 0),
                (1, 1),
                (1, 2),
                (1, 3)
            ]
        );
    }
}
