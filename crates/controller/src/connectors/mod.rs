mod calc_connector;
mod id_fetcher;
mod index_fetcher;
mod name_fetcher;
mod vertex_connector;

pub type IdFetcher<'a> = id_fetcher::IdFetcher<'a>;
pub type IndexFetcher<'a> = index_fetcher::IndexFetcher<'a>;
pub type CalcConnector<'a> = calc_connector::CalcConnector<'a>;
pub type NameFetcher<'a> = name_fetcher::NameFetcher<'a>;
pub type VertexConnector<'a> = vertex_connector::VertexConnector<'a>;
