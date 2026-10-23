use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;

use chrono::{FixedOffset, TimeZone};
use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection};
use sqlx::{Connection, Executor};

use super::*;

// --- value mapping ----------------------------------------------------------

#[test]
fn integers_stay_numbers_while_exact() {
    assert_eq!(int_cell(42), CellValue::Num(42.0));
    assert_eq!(int_cell(MAX_SAFE_INT), CellValue::Num(MAX_SAFE_INT as f64));
    assert_eq!(
        int_cell(-MAX_SAFE_INT),
        CellValue::Num(-MAX_SAFE_INT as f64)
    );
    assert_eq!(
        int_cell(MAX_SAFE_INT + 1),
        CellValue::Text("9007199254740992".into())
    );
    assert_eq!(
        int_cell(i64::MIN),
        CellValue::Text("-9223372036854775808".into())
    );
    assert_eq!(
        uint_cell(u64::MAX),
        CellValue::Text("18446744073709551615".into())
    );
    assert_eq!(uint_cell(7), CellValue::Num(7.0));
}

#[test]
fn decimals_are_exact_plain_strings() {
    let d = BigDecimal::from_str("12345678901234567890.0100").unwrap();
    assert_eq!(
        decimal_cell(&d),
        CellValue::Text("12345678901234567890.0100".into())
    );
    let d = BigDecimal::from_str("1E+3").unwrap();
    assert_eq!(decimal_cell(&d), CellValue::Text("1000".into()));
    let d = BigDecimal::from_str("-0.000001").unwrap();
    assert_eq!(decimal_cell(&d), CellValue::Text("-0.000001".into()));
}

#[test]
fn floats() {
    assert_eq!(f32_cell(0.1), CellValue::Num(0.1));
    assert_eq!(float_cell(1.5), CellValue::Num(1.5));
    assert_eq!(float_cell(f64::NAN), CellValue::Text("NaN".into()));
    assert_eq!(float_cell(f64::INFINITY), CellValue::Text("inf".into()));
}

#[test]
fn dates_and_times() {
    let d = NaiveDate::from_ymd_opt(2026, 3, 9).unwrap();
    assert_eq!(date_cell(d), CellValue::Text("2026-03-09".into()));

    let t = NaiveTime::from_hms_opt(7, 5, 3).unwrap();
    assert_eq!(time_cell(t), CellValue::Text("07:05:03".into()));
    let t = NaiveTime::from_hms_micro_opt(7, 5, 3, 250_000).unwrap();
    assert_eq!(time_cell(t), CellValue::Text("07:05:03.250".into()));

    let dt = d.and_hms_opt(23, 30, 0).unwrap();
    assert_eq!(
        naive_datetime_cell(dt),
        CellValue::Text("2026-03-09T23:30:00".into())
    );

    // 23:30 at +08:00 is 15:30 UTC.
    let local = FixedOffset::east_opt(8 * 3600)
        .unwrap()
        .from_local_datetime(&dt)
        .unwrap();
    assert_eq!(
        utc_datetime_cell(local.with_timezone(&Utc)),
        CellValue::Text("2026-03-09T15:30:00Z".into())
    );
}

#[test]
fn bytes_are_tagged_base64() {
    assert_eq!(
        bytes_cell(&[1, 2, 255]),
        CellValue::Text("base64:AQL/".into())
    );
}

#[test]
fn null_serializes_as_json_null_not_empty_string() {
    let row = vec![
        CellValue::Null,
        CellValue::Text(String::new()),
        CellValue::Num(1.0),
        CellValue::Bool(true),
    ];
    assert_eq!(
        serde_json::to_string(&row).unwrap(),
        r#"[null,"",1.0,true]"#
    );
}

#[test]
fn column_types() {
    assert_eq!(pg_column_type("NUMERIC"), ColumnType::Number);
    assert_eq!(pg_column_type("INT8"), ColumnType::Number);
    assert_eq!(pg_column_type("TIMESTAMPTZ"), ColumnType::Datetime);
    assert_eq!(pg_column_type("BOOL"), ColumnType::Boolean);
    assert_eq!(pg_column_type("UUID"), ColumnType::Text);

    assert_eq!(mysql_column_type("BIGINT UNSIGNED"), ColumnType::Number);
    assert_eq!(mysql_column_type("BOOLEAN"), ColumnType::Boolean);
    assert_eq!(mysql_column_type("DECIMAL"), ColumnType::Number);
    assert_eq!(mysql_column_type("TIMESTAMP"), ColumnType::Datetime);
    assert_eq!(mysql_column_type("VARCHAR"), ColumnType::Text);

    assert_eq!(sqlite_column_type("INTEGER"), Some(ColumnType::Number));
    assert_eq!(sqlite_column_type("varchar(20)"), Some(ColumnType::Text));
    assert_eq!(
        sqlite_column_type("DECIMAL(10,2)"),
        Some(ColumnType::Number)
    );
    assert_eq!(sqlite_column_type("BOOLEAN"), Some(ColumnType::Boolean));
    assert_eq!(sqlite_column_type("DATETIME"), Some(ColumnType::Datetime));
    assert_eq!(sqlite_column_type("DATE"), Some(ColumnType::Date));
    assert_eq!(sqlite_column_type("NULL"), None);
}

#[test]
fn params_from_json() {
    let v: Vec<serde_json::Value> = serde_json::from_str(r#"[null, true, 3, 2.5, "x"]"#).unwrap();
    let p: Vec<Param> = v
        .iter()
        .map(Param::from_json)
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(
        p,
        vec![
            Param::Null,
            Param::Bool(true),
            Param::Int(3),
            Param::Float(2.5),
            Param::Text("x".into())
        ]
    );
    assert!(Param::from_json(&serde_json::json!([1])).is_err());
}

// --- saved connections --------------------------------------------------------

fn temp_path(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("logisheets-db-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir.join(name)
}

fn pg_conn() -> ConnectionInfo {
    ConnectionInfo {
        id: String::new(),
        name: " Sales ".into(),
        kind: DbKind::Postgres,
        host: "db.example.com".into(),
        port: 0,
        database: "sales".into(),
        user: "reader".into(),
        ssl_mode: SslMode::Require,
        has_password: true,
    }
}

#[test]
fn normalize_fills_defaults_and_validates() {
    let c = normalize(pg_conn()).unwrap();
    assert_eq!(c.name, "Sales");
    assert_eq!(c.port, 5432);

    let mut m = pg_conn();
    m.kind = DbKind::Mysql;
    assert_eq!(normalize(m).unwrap().port, 3306);

    let mut s = pg_conn();
    s.kind = DbKind::Sqlite;
    s.database = "/tmp/a.db".into();
    let s = normalize(s).unwrap();
    assert_eq!((s.host.as_str(), s.port, s.user.as_str()), ("", 0, ""));

    let mut bad = pg_conn();
    bad.host = "  ".into();
    assert!(normalize(bad).is_err());
}

#[test]
fn metadata_file_round_trips_without_secrets() {
    let path = temp_path(FILE_NAME);
    let store = DbState::load_from(path.clone());
    let mut c = normalize(pg_conn()).unwrap();
    c.id = "c1".into();
    store.upsert(c.clone()).unwrap();

    let text = std::fs::read_to_string(&path).unwrap();
    assert!(text.contains("\"hasPassword\": true"));
    assert!(!text.to_lowercase().contains("\"password\""));

    let reloaded = DbState::load_from(path.clone());
    assert_eq!(reloaded.get("c1").unwrap().host, "db.example.com");
    reloaded.remove("c1").unwrap();
    assert!(DbState::load_from(path).list().is_empty());
}

// --- sqlite end to end ----------------------------------------------------------

async fn seeded_sqlite() -> ConnectionInfo {
    let path = temp_path("seed.db");
    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);
    let mut conn = SqliteConnection::connect_with(&opts).await.unwrap();
    conn.execute(
        "CREATE TABLE t (
            id INTEGER, name TEXT, price DECIMAL(10,2), active BOOLEAN,
            born DATE, big INTEGER, note TEXT, data BLOB
        );
        INSERT INTO t VALUES (1, 'ann', 9.5, 1, '2001-02-03', 1152921504606846976, '', x'0102');
        INSERT INTO t VALUES (2, 'bob', NULL, 0, NULL, 5, NULL, NULL);
        INSERT INTO t VALUES (3, 'cy', 3, 1, '1999-12-31', -1, 'x', NULL);",
    )
    .await
    .unwrap();
    conn.close().await.unwrap();
    ConnectionInfo {
        id: "s".into(),
        name: "seed".into(),
        kind: DbKind::Sqlite,
        host: String::new(),
        port: 0,
        database: path.to_string_lossy().into_owned(),
        user: String::new(),
        ssl_mode: SslMode::Disable,
        has_password: false,
    }
}

fn req<'a>(sql: &'a str, params: &'a [Param], max_rows: usize) -> QueryRequest<'a> {
    QueryRequest {
        sql,
        params,
        max_rows,
        timeout: Duration::from_secs(10),
    }
}

#[tokio::test]
async fn sqlite_query_maps_types() {
    let c = seeded_sqlite().await;
    let r = run_query(&c, None, req("SELECT * FROM t ORDER BY id", &[], 100))
        .await
        .unwrap();
    assert!(!r.truncated);

    let types: Vec<ColumnType> = r.columns.iter().map(|c| c.ty).collect();
    use ColumnType::*;
    assert_eq!(
        types,
        vec![Number, Text, Number, Boolean, Date, Number, Text, Text]
    );
    assert_eq!(r.columns[1].name, "name");

    use CellValue as V;
    assert_eq!(
        r.rows[0],
        vec![
            V::Num(1.0),
            V::Text("ann".into()),
            V::Num(9.5),
            V::Bool(true),
            V::Text("2001-02-03".into()),
            V::Text("1152921504606846976".into()),
            V::Text(String::new()),
            V::Text("base64:AQI=".into()),
        ]
    );
    // NULL stays NULL; it is not "".
    assert_eq!(r.rows[1][2], V::Null);
    assert_eq!(r.rows[1][3], V::Bool(false));
    assert_eq!(r.rows[1][6], V::Null);
    assert_eq!(r.rows[2][5], V::Num(-1.0));
}

#[tokio::test]
async fn sqlite_expression_columns_infer_from_values() {
    let c = seeded_sqlite().await;
    let r = run_query(
        &c,
        None,
        req("SELECT count(*) AS n, upper(name) AS u FROM t", &[], 10),
    )
    .await
    .unwrap();
    assert_eq!(r.columns[0].ty, ColumnType::Number);
    assert_eq!(r.columns[1].ty, ColumnType::Text);
    assert_eq!(r.rows[0][0], CellValue::Num(3.0));
}

#[tokio::test]
async fn sqlite_row_cap_reports_truncation() {
    let c = seeded_sqlite().await;
    let r = run_query(&c, None, req("SELECT id FROM t ORDER BY id", &[], 2))
        .await
        .unwrap();
    assert_eq!(r.rows.len(), 2);
    assert!(r.truncated);

    let r = run_query(&c, None, req("SELECT id FROM t", &[], 3))
        .await
        .unwrap();
    assert_eq!(r.rows.len(), 3);
    assert!(!r.truncated);
}

#[tokio::test]
async fn sqlite_binds_params() {
    let c = seeded_sqlite().await;
    let params = [Param::Int(2), Param::Text("cy".into())];
    let r = run_query(
        &c,
        None,
        req(
            "SELECT name FROM t WHERE id >= ? AND name <> ?",
            &params,
            10,
        ),
    )
    .await
    .unwrap();
    assert_eq!(r.rows, vec![vec![CellValue::Text("bob".into())]]);
}

#[tokio::test]
async fn sqlite_empty_result_keeps_columns() {
    let c = seeded_sqlite().await;
    let r = run_query(
        &c,
        None,
        req("SELECT id, name FROM t WHERE id > 99", &[], 10),
    )
    .await
    .unwrap();
    assert!(r.rows.is_empty());
    assert_eq!(r.columns.len(), 2);
    assert_eq!(r.columns[1].name, "name");
}

#[tokio::test]
async fn sqlite_is_read_only() {
    let c = seeded_sqlite().await;
    for sql in [
        "DELETE FROM t",
        "INSERT INTO t (id) VALUES (9)",
        "CREATE TABLE u (x)",
    ] {
        assert!(
            run_query(&c, None, req(sql, &[], 10)).await.is_err(),
            "{sql} should fail"
        );
    }
    let r = run_query(&c, None, req("SELECT count(*) FROM t", &[], 10))
        .await
        .unwrap();
    assert_eq!(r.rows[0][0], CellValue::Num(3.0));
}

#[tokio::test]
async fn sqlite_missing_file_is_an_error_not_a_new_db() {
    let mut c = seeded_sqlite().await;
    c.database = temp_path("missing.db").to_string_lossy().into_owned();
    assert!(run_query(&c, None, req("SELECT 1", &[], 1)).await.is_err());
    assert!(!std::path::Path::new(&c.database).exists());
}

#[tokio::test]
async fn sql_errors_are_readable() {
    let c = seeded_sqlite().await;
    let e = run_query(&c, None, req("SELECT nope FROM t", &[], 1))
        .await
        .unwrap_err();
    assert!(e.contains("nope"), "{e}");
}

// --- live servers ---------------------------------------------------------------
//
// Ignored by default; they need a server. With Docker:
//
//   docker run -d --rm -e POSTGRES_PASSWORD=pw -e POSTGRES_USER=reader \
//       -e POSTGRES_DB=sales -p 55432:5432 postgres:16-alpine
//   docker run -d --rm -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=sales \
//       -p 53306:3306 mysql:8.4
//   LOGISHEETS_TEST_PG=127.0.0.1:55432:reader:pw:sales \
//   LOGISHEETS_TEST_MYSQL=127.0.0.1:53306:root:pw:sales \
//       cargo test --lib db:: -- --ignored

fn server_conn(var: &str, kind: DbKind) -> Option<(ConnectionInfo, String)> {
    let spec = std::env::var(var).ok()?;
    let parts: Vec<&str> = spec.splitn(5, ':').collect();
    let [host, port, user, password, database] = parts[..] else {
        panic!("{var} must be host:port:user:password:database");
    };
    let conn = ConnectionInfo {
        id: "live".into(),
        name: "live".into(),
        kind,
        host: host.into(),
        port: port.parse().unwrap(),
        database: database.into(),
        user: user.into(),
        ssl_mode: SslMode::Disable,
        has_password: true,
    };
    Some((conn, password.into()))
}

#[tokio::test]
#[ignore]
async fn postgres_live() {
    let Some((c, pw)) = server_conn("LOGISHEETS_TEST_PG", DbKind::Postgres) else {
        return;
    };
    let sql = "SELECT 1::int4 AS i, 9007199254740993::int8 AS big, 12345678901234567890.0100::numeric AS d,
                      0.1::float4 AS f, true AS b, NULL::text AS n, ''::text AS e,
                      DATE '2001-02-03' AS day, TIME '07:05:03.25' AS t,
                      TIMESTAMP '2026-03-09 23:30:00' AS naive,
                      TIMESTAMPTZ '2026-03-09 23:30:00+08' AS tz,
                      '6f1c2b8e-8c4b-4bfe-9a4e-7c1d6b0e5a11'::uuid AS u, '{\"a\":1}'::jsonb AS j,
                      '\\x01ff'::bytea AS bin, $1::int8 + 1 AS p, $2 AS nul";
    let r = run_query(&c, Some(&pw), req(sql, &[Param::Int(41), Param::Null], 10))
        .await
        .unwrap();
    use CellValue as V;
    assert_eq!(
        r.rows[0],
        vec![
            V::Num(1.0),
            V::Text("9007199254740993".into()),
            V::Text("12345678901234567890.0100".into()),
            V::Num(0.1),
            V::Bool(true),
            V::Null,
            V::Text(String::new()),
            V::Text("2001-02-03".into()),
            V::Text("07:05:03.250".into()),
            V::Text("2026-03-09T23:30:00".into()),
            V::Text("2026-03-09T15:30:00Z".into()),
            V::Text("6f1c2b8e-8c4b-4bfe-9a4e-7c1d6b0e5a11".into()),
            V::Text(r#"{"a":1}"#.into()),
            V::Text("base64:Af8=".into()),
            V::Num(42.0),
            V::Null,
        ]
    );
    use ColumnType::*;
    let types: Vec<ColumnType> = r.columns.iter().map(|c| c.ty).collect();
    assert_eq!(
        types,
        vec![
            Number, Number, Number, Number, Boolean, Text, Text, Date, Time, Datetime, Datetime,
            Text, Text, Text, Number, Text
        ]
    );

    let e = run_query(&c, Some(&pw), req("CREATE TABLE nope (x int)", &[], 1))
        .await
        .unwrap_err();
    assert!(e.contains("read-only"), "{e}");
    let e = run_query(&c, Some(&pw), req("SELECT 1; SELECT 2", &[], 1))
        .await
        .unwrap_err();
    assert!(!e.is_empty());
    let e = run_query(&c, Some(&pw), req("SELECT generate_series(1, 5)", &[], 3))
        .await
        .unwrap();
    assert!(e.truncated && e.rows.len() == 3);
    let mut slow = req("SELECT pg_sleep(5)", &[], 1);
    slow.timeout = Duration::from_millis(500);
    assert!(run_query(&c, Some(&pw), slow).await.is_err());
    assert!(run_query(&c, Some("wrong"), req("SELECT 1", &[], 1))
        .await
        .is_err());
}

#[tokio::test]
#[ignore]
async fn mysql_live() {
    let Some((c, pw)) = server_conn("LOGISHEETS_TEST_MYSQL", DbKind::Mysql) else {
        return;
    };
    let sql = "SELECT CAST(1 AS SIGNED) AS i, CAST(18446744073709551615 AS UNSIGNED) AS big,
                      CAST('12345678901234567890.0100' AS DECIMAL(30,4)) AS d, NULL AS n, '' AS e,
                      DATE '2001-02-03' AS day, TIMESTAMP '2026-03-09 23:30:00' AS ts,
                      ? + 1 AS p";
    let r = run_query(&c, Some(&pw), req(sql, &[Param::Int(41)], 10))
        .await
        .unwrap();
    use CellValue as V;
    assert_eq!(r.rows[0][0], V::Num(1.0));
    assert_eq!(r.rows[0][1], V::Text("18446744073709551615".into()));
    assert_eq!(r.rows[0][2], V::Text("12345678901234567890.0100".into()));
    assert_eq!(r.rows[0][3], V::Null);
    assert_eq!(r.rows[0][4], V::Text(String::new()));
    assert_eq!(r.rows[0][5], V::Text("2001-02-03".into()));
    assert_eq!(r.rows[0][6], V::Text("2026-03-09T23:30:00".into()));
    assert_eq!(r.rows[0][7], V::Num(42.0));

    for sql in ["CREATE TABLE nope (x int)", "DROP DATABASE sales"] {
        assert!(
            run_query(&c, Some(&pw), req(sql, &[], 1)).await.is_err(),
            "{sql} should fail"
        );
    }
    let r = run_query(
        &c,
        Some(&pw),
        req(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'nope'",
            &[],
            1,
        ),
    )
    .await
    .unwrap();
    assert_eq!(r.rows[0][0], V::Num(0.0));
    let mut slow = req("SELECT SLEEP(5)", &[], 1);
    slow.timeout = Duration::from_millis(500);
    assert!(run_query(&c, Some(&pw), slow).await.is_err());
}
