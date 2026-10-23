// Data connections: SQL against Postgres / MySQL / SQLite for the
// `dataConnections` craft capability (docs/craft/data-connections.md).
//
// A webview cannot open raw TCP, so the database wire protocols run here, the
// same way `llm_fetch` (net.rs) runs HTTP natively. Three pieces:
//
// - Connection METADATA (name, kind, host, port, database, user, SSL mode) is
//   one JSON file in the app-data directory, like craft-storage.json.
// - The PASSWORD is in the OS keychain, keyed by connection id. It is
//   write-only from JS: `db_conn_save` takes one, nothing returns one.
// - A QUERY opens one connection, runs one statement inside a read-only
//   transaction with a row cap and a deadline, maps every value to a cell by a
//   fixed rule (see `ColumnType` / `CellValue`), rolls back and disconnects.
//
// Trust: installed crafts are full trust and can invoke these commands
// directly, so the keychain protects the secret, not its use. Read-only is a
// guardrail, not a security boundary.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use base64::Engine as _;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use futures_util::{Stream, TryStreamExt};
use serde::{Deserialize, Serialize};
use sqlx::mysql::{MySqlConnectOptions, MySqlConnection, MySqlRow, MySqlSslMode};
use sqlx::postgres::types::Oid;
use sqlx::postgres::{PgConnectOptions, PgConnection, PgRow, PgSslMode, PgTypeInfo, PgTypeKind};
use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection, SqliteRow};
use sqlx::types::BigDecimal;
use sqlx::{Column as _, Connection, Executor, Row, Statement, TypeInfo, ValueRef};
use tauri::{AppHandle, Manager, State};

const FILE_NAME: &str = "data-connections.json";
const CURRENT_VERSION: u32 = 1;
const KEYCHAIN_SERVICE: &str = "logisheets.data-connections";

const DEFAULT_MAX_ROWS: u32 = 10_000;
const MAX_MAX_ROWS: u32 = 100_000;
const DEFAULT_TIMEOUT_MS: u32 = 30_000;
const MAX_TIMEOUT_MS: u32 = 600_000;
const TEST_TIMEOUT_MS: u32 = 10_000;

/// The largest integer a JS number holds exactly (Number.MAX_SAFE_INTEGER).
const MAX_SAFE_INT: i64 = (1 << 53) - 1;

// ---------------------------------------------------------------------------
// Wire types (camelCase, mirrored in packages/core/src/craft/data-connections.ts)
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DbKind {
    Postgres,
    Mysql,
    Sqlite,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SslMode {
    Disable,
    #[default]
    Prefer,
    Require,
}

/// A saved connection, as JS sees it. Never carries the password; on the way
/// in, `hasPassword` is ignored (the store owns it).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    /// Empty on a save means "new connection".
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub kind: DbKind,
    /// Empty for sqlite.
    #[serde(default)]
    pub host: String,
    /// 0 for sqlite; 0 for a server kind means the default port.
    #[serde(default)]
    pub port: u16,
    /// The database name, or the file path for sqlite.
    #[serde(default)]
    pub database: String,
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub ssl_mode: SslMode,
    #[serde(default)]
    pub has_password: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ColumnType {
    Number,
    Text,
    Boolean,
    Date,
    Datetime,
    Time,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: ColumnType,
    /// The database's own name for the type, for display.
    pub db_type: String,
}

/// One cell. `Null` is an EMPTY cell, which is not the same as `Text("")`.
/// Exact numbers a JS number cannot hold (DECIMAL, BIGINT beyond 2^53) come
/// back as `Text` in a `number` column.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum CellValue {
    Null,
    Bool(bool),
    Num(f64),
    Text(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<CellValue>>,
    /// More rows existed than `maxRows`.
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct TestResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A bound parameter, typed by its JS type.
#[derive(Clone, Debug, PartialEq)]
pub enum Param {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
}

impl Param {
    fn from_json(v: &serde_json::Value) -> Result<Self, String> {
        use serde_json::Value;
        Ok(match v {
            Value::Null => Param::Null,
            Value::Bool(b) => Param::Bool(*b),
            Value::Number(n) => match n.as_i64() {
                Some(i) => Param::Int(i),
                None => Param::Float(n.as_f64().ok_or("parameter is not a finite number")?),
            },
            Value::String(s) => Param::Text(s.clone()),
            _ => return Err("parameters must be strings, numbers, booleans or null".into()),
        })
    }
}

// ---------------------------------------------------------------------------
// Value mapping. Every rule lives here so every craft sees the same thing.
// ---------------------------------------------------------------------------

/// An integer as a cell: a JS number while it is exact, else a decimal string.
pub fn int_cell(i: i64) -> CellValue {
    if (-MAX_SAFE_INT..=MAX_SAFE_INT).contains(&i) {
        CellValue::Num(i as f64)
    } else {
        CellValue::Text(i.to_string())
    }
}

pub fn uint_cell(u: u64) -> CellValue {
    if u <= MAX_SAFE_INT as u64 {
        CellValue::Num(u as f64)
    } else {
        CellValue::Text(u.to_string())
    }
}

/// JSON has no NaN/Infinity, so those come back as text.
pub fn float_cell(f: f64) -> CellValue {
    if f.is_finite() {
        CellValue::Num(f)
    } else {
        CellValue::Text(f.to_string())
    }
}

/// Through the shortest decimal text, so 0.1f32 is 0.1 and not 0.10000000149.
pub fn f32_cell(f: f32) -> CellValue {
    float_cell(f.to_string().parse::<f64>().unwrap_or(f as f64))
}

/// Exact, in plain notation (never `1E+3`), keeping the server's scale.
pub fn decimal_cell(d: &BigDecimal) -> CellValue {
    CellValue::Text(d.to_plain_string())
}

pub fn date_cell(d: NaiveDate) -> CellValue {
    CellValue::Text(d.format("%Y-%m-%d").to_string())
}

pub fn time_cell(t: NaiveTime) -> CellValue {
    CellValue::Text(t.format("%H:%M:%S%.f").to_string())
}

/// A timestamp WITHOUT a zone: the wall clock as stored, no offset.
pub fn naive_datetime_cell(dt: NaiveDateTime) -> CellValue {
    CellValue::Text(dt.format("%Y-%m-%dT%H:%M:%S%.f").to_string())
}

/// A timestamp WITH a zone: converted to UTC, `Z` suffix.
pub fn utc_datetime_cell(dt: DateTime<Utc>) -> CellValue {
    CellValue::Text(dt.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string())
}

pub fn bytes_cell(b: &[u8]) -> CellValue {
    CellValue::Text(format!(
        "base64:{}",
        base64::engine::general_purpose::STANDARD.encode(b)
    ))
}

fn unsupported(column: &str, ty: &str) -> String {
    format!(
        "column \"{column}\" has type {ty}, which has no cell mapping; cast it to text in the query"
    )
}

fn decode_err(column: &str, ty: &str, e: sqlx::Error) -> String {
    format!("cannot read column \"{column}\" ({ty}): {e}")
}

pub fn pg_column_type(name: &str) -> ColumnType {
    match name {
        "BOOL" => ColumnType::Boolean,
        "INT2" | "INT4" | "INT8" | "FLOAT4" | "FLOAT8" | "NUMERIC" | "OID" => ColumnType::Number,
        "DATE" => ColumnType::Date,
        "TIME" => ColumnType::Time,
        "TIMESTAMP" | "TIMESTAMPTZ" => ColumnType::Datetime,
        _ => ColumnType::Text,
    }
}

pub fn mysql_column_type(name: &str) -> ColumnType {
    match name {
        "BOOLEAN" => ColumnType::Boolean,
        "DATE" => ColumnType::Date,
        "TIME" => ColumnType::Time,
        "DATETIME" | "TIMESTAMP" => ColumnType::Datetime,
        "FLOAT" | "DOUBLE" | "DECIMAL" | "YEAR" => ColumnType::Number,
        n if n.contains("INT") => ColumnType::Number,
        _ => ColumnType::Text,
    }
}

/// SQLite is dynamically typed: the column type comes from the DECLARED type
/// by SQLite's own affinity rules, with BOOL/DATE/TIME names recognised since
/// that is how people declare them. `None` = no declared type (an expression);
/// the caller then infers from the first non-NULL value.
pub fn sqlite_column_type(declared: &str) -> Option<ColumnType> {
    let d = declared.to_ascii_uppercase();
    if d.is_empty() || d == "NULL" {
        return None;
    }
    Some(if d.contains("BOOL") {
        ColumnType::Boolean
    } else if d.contains("DATETIME") || d.contains("TIMESTAMP") {
        ColumnType::Datetime
    } else if d.contains("DATE") {
        ColumnType::Date
    } else if d.contains("TIME") {
        ColumnType::Time
    } else if d.contains("INT")
        || d.contains("REAL")
        || d.contains("FLOA")
        || d.contains("DOUB")
        || d.contains("NUMERIC")
        || d.contains("DECIMAL")
    {
        ColumnType::Number
    } else {
        ColumnType::Text
    })
}

// Domains are their base type for decoding purposes.
fn pg_base(ti: &PgTypeInfo) -> &PgTypeInfo {
    match ti.kind() {
        PgTypeKind::Domain(base) => pg_base(base),
        _ => ti,
    }
}

fn pg_cell(row: &PgRow, i: usize) -> Result<CellValue, String> {
    let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
    if raw.is_null() {
        return Ok(CellValue::Null);
    }
    let col = row.columns()[i].name();
    let ti = pg_base(row.columns()[i].type_info()).clone();
    let ty = ti.name();
    let err = |e| decode_err(col, ty, e);
    Ok(match ty {
        "BOOL" => CellValue::Bool(row.try_get_unchecked::<bool, _>(i).map_err(err)?),
        "INT2" => int_cell(row.try_get_unchecked::<i16, _>(i).map_err(err)? as i64),
        "INT4" => int_cell(row.try_get_unchecked::<i32, _>(i).map_err(err)? as i64),
        "INT8" => int_cell(row.try_get_unchecked::<i64, _>(i).map_err(err)?),
        "OID" => int_cell(row.try_get_unchecked::<Oid, _>(i).map_err(err)?.0 as i64),
        "FLOAT4" => f32_cell(row.try_get_unchecked::<f32, _>(i).map_err(err)?),
        "FLOAT8" => float_cell(row.try_get_unchecked::<f64, _>(i).map_err(err)?),
        "NUMERIC" => decimal_cell(&row.try_get_unchecked::<BigDecimal, _>(i).map_err(err)?),
        "DATE" => date_cell(row.try_get_unchecked::<NaiveDate, _>(i).map_err(err)?),
        "TIME" => time_cell(row.try_get_unchecked::<NaiveTime, _>(i).map_err(err)?),
        "TIMESTAMP" => {
            naive_datetime_cell(row.try_get_unchecked::<NaiveDateTime, _>(i).map_err(err)?)
        }
        "TIMESTAMPTZ" => {
            utc_datetime_cell(row.try_get_unchecked::<DateTime<Utc>, _>(i).map_err(err)?)
        }
        "TEXT" | "VARCHAR" | "BPCHAR" | "CHAR" | "NAME" | "CITEXT" | "UNKNOWN" => {
            CellValue::Text(row.try_get_unchecked::<String, _>(i).map_err(err)?)
        }
        "UUID" => CellValue::Text(
            row.try_get_unchecked::<sqlx::types::Uuid, _>(i)
                .map_err(err)?
                .to_string(),
        ),
        "JSON" | "JSONB" => CellValue::Text(
            row.try_get_unchecked::<serde_json::Value, _>(i)
                .map_err(err)?
                .to_string(),
        ),
        "BYTEA" => bytes_cell(&row.try_get_unchecked::<Vec<u8>, _>(i).map_err(err)?),
        // A user-defined enum's binary form is its label.
        _ if matches!(ti.kind(), PgTypeKind::Enum(_)) => {
            CellValue::Text(row.try_get_unchecked::<String, _>(i).map_err(err)?)
        }
        _ => return Err(unsupported(col, ty)),
    })
}

fn mysql_cell(row: &MySqlRow, i: usize) -> Result<CellValue, String> {
    let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
    if raw.is_null() {
        return Ok(CellValue::Null);
    }
    let col = row.columns()[i].name();
    let ty = row.columns()[i].type_info().name();
    let err = |e| decode_err(col, ty, e);
    // The integer decoders read whatever width the server sent, so unchecked
    // i64/u64 cover TINYINT..BIGINT and YEAR alike.
    Ok(match ty {
        "BOOLEAN" => CellValue::Bool(row.try_get_unchecked::<i64, _>(i).map_err(err)? != 0),
        "FLOAT" => f32_cell(row.try_get_unchecked::<f32, _>(i).map_err(err)?),
        "DOUBLE" => float_cell(row.try_get_unchecked::<f64, _>(i).map_err(err)?),
        "DECIMAL" => decimal_cell(&row.try_get_unchecked::<BigDecimal, _>(i).map_err(err)?),
        "YEAR" => uint_cell(row.try_get_unchecked::<u64, _>(i).map_err(err)?),
        "DATE" => date_cell(row.try_get_unchecked::<NaiveDate, _>(i).map_err(err)?),
        "TIME" => time_cell(row.try_get_unchecked::<NaiveTime, _>(i).map_err(err)?),
        "DATETIME" => {
            naive_datetime_cell(row.try_get_unchecked::<NaiveDateTime, _>(i).map_err(err)?)
        }
        // The connection's time_zone is +00:00 (sqlx's default), so the
        // server hands TIMESTAMP over in UTC.
        "TIMESTAMP" => {
            utc_datetime_cell(row.try_get_unchecked::<DateTime<Utc>, _>(i).map_err(err)?)
        }
        "CHAR" | "VARCHAR" | "TINYTEXT" | "TEXT" | "MEDIUMTEXT" | "LONGTEXT" | "ENUM" | "SET"
        | "JSON" => CellValue::Text(row.try_get_unchecked::<String, _>(i).map_err(err)?),
        "BINARY" | "VARBINARY" | "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" => {
            bytes_cell(&row.try_get_unchecked::<Vec<u8>, _>(i).map_err(err)?)
        }
        t if t.contains("INT") && t.ends_with("UNSIGNED") => {
            uint_cell(row.try_get_unchecked::<u64, _>(i).map_err(err)?)
        }
        t if t.contains("INT") => int_cell(row.try_get_unchecked::<i64, _>(i).map_err(err)?),
        _ => return Err(unsupported(col, ty)),
    })
}

/// `declared` is the column's declared type; a value is read by its RUNTIME
/// storage class, since SQLite lets any column hold anything.
fn sqlite_cell(
    row: &SqliteRow,
    i: usize,
    declared: Option<ColumnType>,
) -> Result<CellValue, String> {
    let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
    if raw.is_null() {
        return Ok(CellValue::Null);
    }
    let storage = raw.type_info().name().to_string();
    drop(raw);
    let col = row.columns()[i].name();
    let err = |e| decode_err(col, &storage, e);
    Ok(match storage.as_str() {
        "INTEGER" | "BOOLEAN" => {
            let v = row.try_get_unchecked::<i64, _>(i).map_err(err)?;
            if declared == Some(ColumnType::Boolean) {
                CellValue::Bool(v != 0)
            } else {
                int_cell(v)
            }
        }
        "REAL" => float_cell(row.try_get_unchecked::<f64, _>(i).map_err(err)?),
        "BLOB" => bytes_cell(&row.try_get_unchecked::<Vec<u8>, _>(i).map_err(err)?),
        _ => CellValue::Text(row.try_get_unchecked::<String, _>(i).map_err(err)?),
    })
}

// ---------------------------------------------------------------------------
// Running a query
// ---------------------------------------------------------------------------

pub struct QueryRequest<'a> {
    pub sql: &'a str,
    pub params: &'a [Param],
    pub max_rows: usize,
    pub timeout: Duration,
}

fn sql_err(e: sqlx::Error) -> String {
    match e.as_database_error() {
        Some(db) => db.message().to_string(),
        None => e.to_string(),
    }
}

/// Read at most `max_rows` rows, plus one more to learn whether it truncated.
async fn collect<R, S, F>(
    stream: S,
    max_rows: usize,
    mut cell: F,
) -> Result<(Vec<Vec<CellValue>>, bool), String>
where
    R: Row,
    S: Stream<Item = Result<R, sqlx::Error>>,
    F: FnMut(&R, usize) -> Result<CellValue, String>,
{
    futures_util::pin_mut!(stream);
    let mut rows = Vec::new();
    while let Some(row) = stream.try_next().await.map_err(sql_err)? {
        if rows.len() == max_rows {
            return Ok((rows, true));
        }
        let n = row.len();
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            out.push(cell(&row, i)?);
        }
        rows.push(out);
    }
    Ok((rows, false))
}

/// Run one statement read-only against `conn`. The deadline covers connecting
/// too; when it passes, the connection is dropped mid-flight.
pub async fn run_query(
    conn: &ConnectionInfo,
    password: Option<&str>,
    req: QueryRequest<'_>,
) -> Result<QueryResult, String> {
    let ms = req.timeout.as_millis();
    let work = async {
        match conn.kind {
            DbKind::Postgres => run_pg(conn, password, &req).await,
            DbKind::Mysql => run_mysql(conn, password, &req).await,
            DbKind::Sqlite => run_sqlite(conn, &req).await,
        }
    };
    tokio::time::timeout(req.timeout, work)
        .await
        .map_err(|_| format!("query timed out after {ms} ms"))?
}

fn pg_param_type(p: &Param) -> PgTypeInfo {
    match p {
        // OID 0 leaves the type to the server, so a NULL fits any column.
        Param::Null => PgTypeInfo::with_oid(Oid(0)),
        Param::Bool(_) => PgTypeInfo::with_name("bool"),
        Param::Int(_) => PgTypeInfo::with_name("int8"),
        Param::Float(_) => PgTypeInfo::with_name("float8"),
        Param::Text(_) => PgTypeInfo::with_name("text"),
    }
}

macro_rules! bind_params {
    ($query:expr, $params:expr) => {{
        let mut q = $query;
        for p in $params {
            q = match p {
                Param::Null => q.bind(None::<String>),
                Param::Bool(b) => q.bind(*b),
                Param::Int(i) => q.bind(*i),
                Param::Float(f) => q.bind(*f),
                Param::Text(s) => q.bind(s.as_str()),
            };
        }
        q
    }};
}

async fn run_pg(
    c: &ConnectionInfo,
    password: Option<&str>,
    req: &QueryRequest<'_>,
) -> Result<QueryResult, String> {
    let mut opts = PgConnectOptions::new()
        .host(&c.host)
        .port(if c.port == 0 { 5432 } else { c.port })
        .username(&c.user)
        .database(&c.database)
        .application_name("LogiSheets")
        .ssl_mode(match c.ssl_mode {
            SslMode::Disable => PgSslMode::Disable,
            SslMode::Prefer => PgSslMode::Prefer,
            SslMode::Require => PgSslMode::Require,
        });
    if let Some(p) = password {
        opts = opts.password(p);
    }
    let mut conn = PgConnection::connect_with(&opts).await.map_err(sql_err)?;
    conn.execute("BEGIN READ ONLY").await.map_err(sql_err)?;
    conn.execute(format!("SET LOCAL statement_timeout = {}", req.timeout.as_millis()).as_str())
        .await
        .map_err(sql_err)?;

    let types: Vec<PgTypeInfo> = req.params.iter().map(pg_param_type).collect();
    let stmt = (&mut conn)
        .prepare_with(req.sql, &types)
        .await
        .map_err(sql_err)?;
    let columns: Vec<ColumnInfo> = stmt
        .columns()
        .iter()
        .map(|col| {
            let ti = pg_base(col.type_info());
            ColumnInfo {
                name: col.name().to_string(),
                ty: pg_column_type(ti.name()),
                db_type: col.type_info().name().to_string(),
            }
        })
        .collect();
    let query = bind_params!(stmt.query(), req.params);
    let (rows, truncated) = collect(query.fetch(&mut conn), req.max_rows, pg_cell).await?;

    let _ = conn.execute("ROLLBACK").await;
    let _ = conn.close().await;
    Ok(QueryResult {
        columns,
        rows,
        truncated,
    })
}

async fn run_mysql(
    c: &ConnectionInfo,
    password: Option<&str>,
    req: &QueryRequest<'_>,
) -> Result<QueryResult, String> {
    let mut opts = MySqlConnectOptions::new()
        .host(&c.host)
        .port(if c.port == 0 { 3306 } else { c.port })
        .username(&c.user)
        .database(&c.database)
        .ssl_mode(match c.ssl_mode {
            SslMode::Disable => MySqlSslMode::Disabled,
            SslMode::Prefer => MySqlSslMode::Preferred,
            SslMode::Require => MySqlSslMode::Required,
        });
    if let Some(p) = password {
        opts = opts.password(p);
    }
    let mut conn = MySqlConnection::connect_with(&opts)
        .await
        .map_err(sql_err)?;
    // Server-side deadline. MySQL and MariaDB name it differently and each
    // rejects the other's; whichever fails, the client deadline still holds.
    let ms = req.timeout.as_millis();
    let _ = conn
        .execute(format!("SET SESSION max_execution_time = {ms}").as_str())
        .await;
    let _ = conn
        .execute(format!("SET SESSION max_statement_time = {}", ms as f64 / 1000.0).as_str())
        .await;
    // DDL commits implicitly in MySQL and would run OUTSIDE the transaction
    // below, so the session itself is made read-only too: that refuses
    // CREATE/DROP/ALTER as well.
    conn.execute("SET SESSION TRANSACTION READ ONLY")
        .await
        .map_err(sql_err)?;
    conn.execute("START TRANSACTION READ ONLY")
        .await
        .map_err(sql_err)?;

    let stmt = (&mut conn).prepare(req.sql).await.map_err(sql_err)?;
    let columns: Vec<ColumnInfo> = stmt
        .columns()
        .iter()
        .map(|col| ColumnInfo {
            name: col.name().to_string(),
            ty: mysql_column_type(col.type_info().name()),
            db_type: col.type_info().name().to_string(),
        })
        .collect();
    let query = bind_params!(stmt.query(), req.params);
    let (rows, truncated) = collect(query.fetch(&mut conn), req.max_rows, mysql_cell).await?;

    let _ = conn.execute("ROLLBACK").await;
    let _ = conn.close().await;
    Ok(QueryResult {
        columns,
        rows,
        truncated,
    })
}

async fn run_sqlite(c: &ConnectionInfo, req: &QueryRequest<'_>) -> Result<QueryResult, String> {
    // A read-only file handle, so nothing can write whatever the SQL says;
    // query_only on top makes the error message say so plainly.
    let opts = SqliteConnectOptions::new()
        .filename(&c.database)
        .read_only(true)
        .create_if_missing(false)
        .pragma("query_only", "ON");
    let mut conn = SqliteConnection::connect_with(&opts)
        .await
        .map_err(sql_err)?;

    let stmt = (&mut conn).prepare(req.sql).await.map_err(sql_err)?;
    let declared: Vec<Option<ColumnType>> = stmt
        .columns()
        .iter()
        .map(|col| sqlite_column_type(col.type_info().name()))
        .collect();
    let mut columns: Vec<ColumnInfo> = stmt
        .columns()
        .iter()
        .zip(&declared)
        .map(|(col, d)| ColumnInfo {
            name: col.name().to_string(),
            ty: d.unwrap_or(ColumnType::Text),
            db_type: col.type_info().name().to_string(),
        })
        .collect();
    let query = bind_params!(stmt.query(), req.params);
    let (rows, truncated) = collect(query.fetch(&mut conn), req.max_rows, |row, i| {
        sqlite_cell(row, i, declared.get(i).copied().flatten())
    })
    .await?;
    let _ = conn.close().await;

    // An expression column has no declared type: infer it from the first
    // non-NULL value.
    for (i, col) in columns.iter_mut().enumerate() {
        if declared[i].is_none() {
            let first = rows.iter().map(|r| &r[i]).find(|v| **v != CellValue::Null);
            if let Some(CellValue::Num(_)) = first {
                col.ty = ColumnType::Number;
            }
        }
    }
    Ok(QueryResult {
        columns,
        rows,
        truncated,
    })
}

// ---------------------------------------------------------------------------
// Saved connections: metadata in a JSON file, password in the keychain
// ---------------------------------------------------------------------------

#[derive(Default, Serialize, Deserialize)]
struct ConnFile {
    version: u32,
    connections: Vec<ConnectionInfo>,
}

/// Managed Tauri state: the metadata file, loaded once and rewritten after
/// each change (as craft-storage does).
pub struct DbState {
    inner: Mutex<ConnFile>,
    path: PathBuf,
}

impl DbState {
    pub fn load(app: &AppHandle) -> Self {
        let dir = app
            .path()
            .app_data_dir()
            .expect("no app-data directory for this platform");
        let _ = fs::create_dir_all(&dir);
        Self::load_from(dir.join(FILE_NAME))
    }

    pub fn load_from(path: PathBuf) -> Self {
        let inner = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<ConnFile>(&bytes).ok())
            .unwrap_or(ConnFile {
                version: CURRENT_VERSION,
                connections: Vec::new(),
            });
        DbState {
            inner: Mutex::new(inner),
            path,
        }
    }

    fn flush(&self, file: &ConnFile) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(file).map_err(|e| e.to_string())?;
        fs::write(&self.path, bytes).map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Vec<ConnectionInfo> {
        self.inner.lock().unwrap().connections.clone()
    }

    pub fn get(&self, id: &str) -> Option<ConnectionInfo> {
        self.inner
            .lock()
            .unwrap()
            .connections
            .iter()
            .find(|c| c.id == id)
            .cloned()
    }

    pub fn upsert(&self, conn: ConnectionInfo) -> Result<(), String> {
        let mut file = self.inner.lock().unwrap();
        match file.connections.iter_mut().find(|c| c.id == conn.id) {
            Some(slot) => *slot = conn,
            None => file.connections.push(conn),
        }
        self.flush(&file)
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut file = self.inner.lock().unwrap();
        file.connections.retain(|c| c.id != id);
        self.flush(&file)
    }
}

/// Validate a connection from the form and clear the fields its kind ignores.
pub fn normalize(mut c: ConnectionInfo) -> Result<ConnectionInfo, String> {
    c.name = c.name.trim().to_string();
    c.host = c.host.trim().to_string();
    c.database = c.database.trim().to_string();
    c.user = c.user.trim().to_string();
    if c.name.is_empty() {
        return Err("a connection needs a name".into());
    }
    match c.kind {
        DbKind::Sqlite => {
            if c.database.is_empty() {
                return Err("a SQLite connection needs a database file path".into());
            }
            c.host.clear();
            c.port = 0;
            c.user.clear();
            c.ssl_mode = SslMode::Disable;
        }
        DbKind::Postgres | DbKind::Mysql => {
            if c.host.is_empty() {
                return Err("a connection needs a host".into());
            }
            if c.port == 0 {
                c.port = if c.kind == DbKind::Postgres {
                    5432
                } else {
                    3306
                };
            }
        }
    }
    Ok(c)
}

fn keychain_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, id).map_err(|e| format!("keychain: {e}"))
}

fn keychain_get(id: &str) -> Result<Option<String>, String> {
    match keychain_entry(id)?.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keychain: {e}")),
    }
}

fn keychain_set(id: &str, password: &str) -> Result<(), String> {
    keychain_entry(id)?
        .set_password(password)
        .map_err(|e| format!("keychain: {e}"))
}

fn keychain_delete(id: &str) -> Result<(), String> {
    match keychain_entry(id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keychain: {e}")),
    }
}

fn stored_password(c: &ConnectionInfo) -> Result<Option<String>, String> {
    if c.kind == DbKind::Sqlite || !c.has_password {
        return Ok(None);
    }
    keychain_get(&c.id)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_conn_list(state: State<DbState>) -> Vec<ConnectionInfo> {
    state.list()
}

/// Create (empty `id`) or update a connection. `password` absent keeps the
/// stored one; `clearPassword` removes it. The password goes to the keychain
/// only and is never returned.
#[tauri::command]
pub fn db_conn_save(
    conn: ConnectionInfo,
    password: Option<String>,
    clear_password: Option<bool>,
    state: State<DbState>,
) -> Result<ConnectionInfo, String> {
    let mut conn = normalize(conn)?;
    let existing = if conn.id.is_empty() {
        conn.id = uuid::Uuid::new_v4().to_string();
        None
    } else {
        state.get(&conn.id)
    };
    conn.has_password = existing.map(|e| e.has_password).unwrap_or(false);

    if conn.kind == DbKind::Sqlite || clear_password == Some(true) {
        if conn.has_password {
            keychain_delete(&conn.id)?;
        }
        conn.has_password = false;
    } else if let Some(p) = password.filter(|p| !p.is_empty()) {
        keychain_set(&conn.id, &p)?;
        conn.has_password = true;
    }
    state.upsert(conn.clone())?;
    Ok(conn)
}

#[tauri::command]
pub fn db_conn_delete(conn_id: String, state: State<DbState>) -> Result<(), String> {
    if state.get(&conn_id).is_some_and(|c| c.has_password) {
        keychain_delete(&conn_id)?;
    }
    state.remove(&conn_id)
}

/// Check that a connection works, from the form's (possibly unsaved) values.
/// Without a `password`, a saved connection's keychain entry is used.
#[tauri::command]
pub async fn db_conn_test(
    conn: ConnectionInfo,
    password: Option<String>,
    state: State<'_, DbState>,
) -> Result<TestResult, String> {
    let outcome = async {
        let conn = normalize(conn)?;
        let password = match password.filter(|p| !p.is_empty()) {
            Some(p) => Some(p),
            None => match state.get(&conn.id) {
                Some(saved) => stored_password(&saved)?,
                None => None,
            },
        };
        let req = QueryRequest {
            sql: "SELECT 1",
            params: &[],
            max_rows: 1,
            timeout: Duration::from_millis(TEST_TIMEOUT_MS as u64),
        };
        run_query(&conn, password.as_deref(), req).await.map(|_| ())
    }
    .await;
    Ok(match outcome {
        Ok(()) => TestResult {
            ok: true,
            error: None,
        },
        Err(e) => TestResult {
            ok: false,
            error: Some(e),
        },
    })
}

#[tauri::command]
pub async fn db_query(
    conn_id: String,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
    max_rows: Option<u32>,
    timeout_ms: Option<u32>,
    state: State<'_, DbState>,
) -> Result<QueryResult, String> {
    let conn = state
        .get(&conn_id)
        .ok_or_else(|| format!("no data connection with id {conn_id}"))?;
    let params = params
        .unwrap_or_default()
        .iter()
        .map(Param::from_json)
        .collect::<Result<Vec<_>, _>>()?;
    let password = stored_password(&conn)?;
    let req = QueryRequest {
        sql: &sql,
        params: &params,
        max_rows: max_rows.unwrap_or(DEFAULT_MAX_ROWS).clamp(1, MAX_MAX_ROWS) as usize,
        timeout: Duration::from_millis(
            timeout_ms
                .unwrap_or(DEFAULT_TIMEOUT_MS)
                .clamp(1, MAX_TIMEOUT_MS) as u64,
        ),
    };
    run_query(&conn, password.as_deref(), req).await
}

#[cfg(test)]
mod tests;
