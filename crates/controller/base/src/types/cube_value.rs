use crate::matrix_value::MatrixValue;

#[derive(Debug, Clone)]
pub struct CubeValue<T>
where
    T: Clone + 'static + Default + std::fmt::Debug,
{
    pub data: Vec<MatrixValue<T>>,
}

impl<T> IntoIterator for CubeValue<T>
where
    T: Clone + 'static + Default + std::fmt::Debug,
{
    type Item = T;

    type IntoIter = std::vec::IntoIter<Self::Item>;

    fn into_iter(self) -> Self::IntoIter {
        self.data
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .into_iter()
    }
}

impl<T> CubeValue<T>
where
    T: Clone + 'static + Default + std::fmt::Debug,
{
    pub fn new(data: Vec<MatrixValue<T>>) -> Self {
        CubeValue { data }
    }
}
