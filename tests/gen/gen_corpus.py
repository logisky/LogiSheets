"""Generate a differential-test corpus with openpyxl.

Why this exists
---------------
`tests/roundtrip_corpus.rs` proves we do not LOSE anything from files real
producers wrote. It says nothing about whether the numbers we compute are
right. `tests/funcs/*.script` checks functions one at a time against values a
human typed. Neither covers the case that matters most in practice: a whole
workbook arrives from other tooling with **no cached results at all**, and
every value on screen has to come from our own evaluation.

openpyxl is the right generator for exactly that reason — it writes
`<f>B2*C2</f>` and no `<v>`, because it does not evaluate. So a file it wrote
is a workbook where every number is ours.

The discipline
--------------
**Expectations are computed here, in plain Python, from the same inputs.** They
are never read back out of a spreadsheet — not Excel's, not ours. Two
independent implementations agreeing is evidence; one implementation agreeing
with itself is not.

Where Excel's semantics differ from Python's, the expected value is written out
literally with the reason, because those are the cases where a reference
quietly computed the Python answer would make the test worse than useless.

Running it
----------
    python3 -m venv .venv && .venv/bin/pip install openpyxl
    .venv/bin/python tests/gen/gen_corpus.py

Output (both committed, so CI needs no Python):
    tests/generated/*.xlsx
    tests/generated/manifest.json
"""

import json
import os
from openpyxl import Workbook

OUT = os.path.join(os.path.dirname(__file__), "..", "generated")

# --- expectation helpers ---------------------------------------------------


def num(v, note, diverges=None):
    return _exp("number", float(v), note, diverges)


def _exp(kind, value, note, diverges):
    """One expectation. `diverges` records a case where we knowingly differ
    from Excel: the Excel answer stays in `value` (it is still the truth), and
    the reason is carried alongside so the test can hold the line without
    pretending the gap is not there. The test fails if a listed divergence
    starts passing — that means it was fixed and the entry should go."""
    e = {"kind": kind, "value": value, "note": note}
    if diverges:
        e["diverges"] = diverges
    return e


def text(v, note, diverges=None):
    return _exp("text", v, note, diverges)


def boolean(v, note, diverges=None):
    return _exp("bool", bool(v), note, diverges)


def build(name, sheets):
    """`sheets` is [(title, rows, checks)]; rows is {cell: value-or-formula}."""
    wb = Workbook()
    wb.remove(wb.active)
    checks = []
    for title, rows, cs in sheets:
        ws = wb.create_sheet(title)
        for cell, value in rows.items():
            ws[cell] = value
        for cell, exp in cs.items():
            checks.append({"sheet": title, "cell": cell, **exp})
    path = os.path.join(OUT, name)
    wb.save(path)
    return {"file": name, "checks": checks}


# --- 1. operators and precedence -------------------------------------------


def arithmetic():
    rows, checks = {}, {}

    def case(cell, formula, expected, note):
        rows[cell] = formula
        checks[cell] = num(expected, note)

    case("A1", "=1+2*3", 7, "* binds tighter than +")
    case("A2", "=(1+2)*3", 9, "parens win")
    case("A3", "=10/2*5", 25, "/ and * are left-associative, not / then *")
    case("A4", "=10-2-3", 5, "- is left-associative")
    # Excel's ^ is LEFT-associative; Python's ** is right-associative, so a
    # reference that evaluated 2**3**2 in Python would expect 512 and be wrong.
    case("A5", "=2^3^2", 64, "^ is left-associative in Excel: (2^3)^2, not 2^(3^2)")
    # Excel binds unary minus tighter than ^; Python does the opposite.
    case("A6", "=-2^2", 4, "unary minus binds tighter than ^: (-2)^2, not -(2^2)")
    case("A7", "=2^-1", 0.5, "negative exponent")
    case("A8", "=7/2", 3.5, "division is not integer division")
    case("A9", "=-3--4", 1, "double unary minus")
    case("A10", "=1+2*3^2", 19, "^ then * then +")
    return build("arith.xlsx", [("ops", rows, checks)])


# --- 2. aggregation over ranges --------------------------------------------


def aggregation():
    data = [4, 8, 15, 16, 23, 42]
    rows = {f"A{i + 1}": v for i, v in enumerate(data)}
    # A blank and a text cell inside the column, to pin how they are counted.
    rows["A7"] = None
    rows["A8"] = "not a number"
    labels = ["x", "y", "x", "y", "x", "y"]
    for i, l in enumerate(labels):
        rows[f"B{i + 1}"] = l

    rows["D1"] = "=SUM(A1:A8)"
    rows["D2"] = "=AVERAGE(A1:A8)"
    rows["D3"] = "=MIN(A1:A8)"
    rows["D4"] = "=MAX(A1:A8)"
    rows["D5"] = "=COUNT(A1:A8)"
    rows["D6"] = "=COUNTA(A1:A8)"
    rows["D7"] = '=SUMIF(B1:B6,"x",A1:A6)'
    rows["D8"] = '=COUNTIF(B1:B6,"y")'
    rows["D9"] = "=PRODUCT(A1:A3)"
    rows["D10"] = "=SUMPRODUCT(A1:A3,A4:A6)"

    xs = [v for v, l in zip(data, labels) if l == "x"]
    checks = {
        "D1": num(sum(data), "SUM skips blank and text"),
        "D2": num(sum(data) / len(data), "AVERAGE divides by numeric count only"),
        "D3": num(min(data), "MIN"),
        "D4": num(max(data), "MAX"),
        "D5": num(len(data), "COUNT counts numbers only, not the text cell"),
        "D6": num(len(data) + 1, "COUNTA counts the text cell too, not the blank"),
        "D7": num(sum(xs), "SUMIF over a criteria column"),
        "D8": num(labels.count("y"), "COUNTIF"),
        "D9": num(data[0] * data[1] * data[2], "PRODUCT"),
        "D10": num(sum(a * b for a, b in zip(data[:3], data[3:6])), "SUMPRODUCT pairs elementwise"),
    }
    return build("aggregate.xlsx", [("agg", rows, checks)])


# --- 3. lookup -------------------------------------------------------------


def lookup():
    keys = ["apple", "banana", "cherry", "date"]
    vals = [10, 20, 30, 40]
    rows = {}
    for i, (k, v) in enumerate(zip(keys, vals)):
        rows[f"A{i + 1}"] = k
        rows[f"B{i + 1}"] = v
    # A sorted numeric table for the approximate-match case.
    bounds = [0, 100, 200, 300]
    grades = ["F", "C", "B", "A"]
    for i, (b, g) in enumerate(zip(bounds, grades)):
        rows[f"D{i + 1}"] = b
        rows[f"E{i + 1}"] = g

    rows["G1"] = '=VLOOKUP("cherry",A1:B4,2,FALSE)'
    rows["G2"] = '=INDEX(B1:B4,MATCH("banana",A1:A4,0))'
    rows["G3"] = "=MATCH(30,B1:B4,0)"
    rows["G4"] = "=VLOOKUP(250,D1:E4,2,TRUE)"
    rows["G5"] = "=INDEX(B1:B4,4)"

    checks = {
        "G1": num(vals[keys.index("cherry")], "VLOOKUP exact match"),
        "G2": num(vals[keys.index("banana")], "INDEX+MATCH, the VLOOKUP alternative"),
        "G3": num(vals.index(30) + 1, "MATCH returns a 1-based position"),
        # Approximate match takes the largest bound <= the lookup value.
        "G4": text("B", "VLOOKUP TRUE takes the last row not greater than 250"),
        "G5": num(vals[3], "INDEX by position"),
    }
    return build("lookup.xlsx", [("tbl", rows, checks)])


# --- 4. text ---------------------------------------------------------------


def text_funcs():
    s = "LogiSheets"
    rows = {"A1": s, "A2": "  padded  ", "A3": "a,b,c"}
    rows["C1"] = "=LEN(A1)"
    rows["C2"] = "=LEFT(A1,4)"
    rows["C3"] = "=RIGHT(A1,6)"
    rows["C4"] = "=MID(A1,5,5)"
    rows["C5"] = "=UPPER(A1)"
    rows["C6"] = "=LOWER(A1)"
    rows["C7"] = "=TRIM(A2)"
    rows["C8"] = '=SUBSTITUTE(A3,",","-")'
    rows["C9"] = '=CONCATENATE(A1," ",A1)'
    rows["C10"] = '=FIND("Sheet",A1)'
    rows["C11"] = '=A1&"!"'

    checks = {
        "C1": num(len(s), "LEN"),
        "C2": text(s[:4], "LEFT"),
        "C3": text(s[-6:], "RIGHT"),
        "C4": text(s[4:9], "MID is 1-based, so MID(_,5,5) is Python [4:9]"),
        "C5": text(s.upper(), "UPPER"),
        "C6": text(s.lower(), "LOWER"),
        "C7": text("padded", "TRIM strips both ends"),
        "C8": text("a-b-c", "SUBSTITUTE replaces every occurrence"),
        "C9": text(s + " " + s, "CONCATENATE"),
        "C10": num(s.index("Sheet") + 1, "FIND is 1-based"),
        "C11": text(s + "!", "& concatenates"),
    }
    return build("text.xlsx", [("txt", rows, checks)])


# --- 5. logical, rounding, and a chained model -----------------------------


def logic_and_model():
    rows = {"A1": 10, "A2": 0, "A3": -2.5, "A4": 2.5}
    rows["C1"] = '=IF(A1>5,"big","small")'
    rows["C2"] = "=AND(A1>5,A2=0)"
    rows["C3"] = "=OR(A1<5,A2=0)"
    rows["C4"] = "=NOT(A1>5)"
    rows["C5"] = '=IFERROR(A1/A2,"div0")'
    rows["C6"] = "=ISNUMBER(A1)"
    # Excel rounds half AWAY FROM ZERO. Python's round() is banker's rounding,
    # so round(2.5) is 2 and round(-2.5) is -2 — both would be wrong here.
    rows["C7"] = "=ROUND(A4,0)"
    rows["C8"] = "=ROUND(A3,0)"
    rows["C9"] = "=ABS(A3)"
    rows["C10"] = "=INT(A3)"

    checks = {
        "C1": text("big", "IF picks the true branch"),
        "C2": boolean(True, "AND"),
        "C3": boolean(True, "OR"),
        "C4": boolean(False, "NOT"),
        "C5": text("div0", "IFERROR catches #DIV/0!"),
        "C6": boolean(True, "ISNUMBER"),
        "C7": num(3, "ROUND is half away from zero, so 2.5 -> 3 (Python gives 2)"),
        "C8": num(-3, "and -2.5 -> -3 (Python gives -2)"),
        "C9": num(2.5, "ABS"),
        "C10": num(-3, "INT floors toward negative infinity, so -2.5 -> -3"),
    }

    # A small chained model on a second sheet, plus a cross-sheet reference.
    # Nothing here is cached, so every figure is our own evaluation of a chain
    # four deep.
    units, price, cost, tax = 120, 9.5, 4.25, 0.2
    m = {"B1": units, "B2": price, "B3": cost, "B4": tax}
    m["B5"] = "=B1*B2"
    m["B6"] = "=B1*B3"
    m["B7"] = "=B5-B6"
    m["B8"] = "=B7*(1-B4)"
    m["B9"] = "=B8/B5"
    m["B10"] = "=logic!A1+B1"

    revenue = units * price
    cogs = units * cost
    gross = revenue - cogs
    net = gross * (1 - tax)
    mc = {
        "B5": num(revenue, "revenue"),
        "B6": num(cogs, "cost of goods"),
        "B7": num(gross, "gross profit, one level down the chain"),
        "B8": num(net, "after tax, two levels down"),
        "B9": num(net / revenue, "margin, three levels down"),
        "B10": num(10 + units, "a reference across sheets"),
    }
    return build("model.xlsx", [("logic", rows, checks), ("model", m, mc)])


# --- 6. coercion, blanks, and comparison -----------------------------------


def edges():
    """The places a spreadsheet stops behaving like a programming language."""
    rows = {"A1": 10, "A2": None, "A3": "5", "A4": "abc", "A5": True}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    # A blank cell is zero in arithmetic, not an error and not a skip.
    case("C1", "=A1+A2", num(10, "a blank cell reads as 0 in arithmetic"))
    # ...but it is not the same as zero everywhere: it also equals "".
    case("C2", '=IF(A2="","blank","not")', text("blank", 'a blank cell equals "" in a comparison'))
    case("C3", "=ISBLANK(A2)", boolean(True, "ISBLANK sees it"))
    # Text that looks numeric coerces in arithmetic, though not in SUM.
    case("C4", "=A3+1", num(6, 'numeric text "5" coerces to 5 in arithmetic'))
    case("C5", "=SUM(A1,A3)", num(10, "SUM ignores text, even numeric-looking text"))
    # Booleans are 1 and 0 in arithmetic.
    case("C6", "=A5+1", num(2, "TRUE is 1 in arithmetic"))
    # Excel's `=` on text is CASE-INSENSITIVE; EXACT is the case-sensitive one.
    case("C7", '="a"="A"', boolean(True, "= compares text case-insensitively"))
    case("C8", '=EXACT("a","A")', boolean(False, "EXACT is the case-sensitive comparison"))
    # Concatenation stringifies numbers.
    case("C9", "=1&2", text("12", "& concatenates, it does not add"))
    # INT floors; TRUNC chops toward zero. They differ on negatives.
    case("C10", "=INT(-2.5)", num(-3, "INT floors toward negative infinity"))
    case("C11", "=TRUNC(-2.5)", num(-2, "TRUNC chops toward zero"))
    # MOD takes the sign of the divisor (as Python's % does, unlike C).
    case("C12", "=MOD(-3,2)", num(1, "MOD takes the sign of the divisor"))
    case("C13", "=MOD(3,-2)", num(-1, "and so is negative here"))
    # Case-insensitivity is not a property of `=`; it is how a spreadsheet
    # compares text ANYWHERE. These cover the other routes, which used to
    # disagree with each other.
    rows["E1"] = "Apple"
    rows["E2"] = "banana"
    rows["E3"] = "APPLE"
    case("C14", '=COUNTIF(E1:E3,"apple")', num(2, "COUNTIF folds case"))
    case("C15", '=COUNTIF(E1:E3,"a*")', num(2, "and so does a wildcard criterion"))
    case("C16", '=MATCH("APPLE",E1:E3,0)', num(1, "MATCH folds case"))
    case("C17", '=SUMIF(E1:E3,"apple",A1:A3)', num(10, "SUMIF agrees with COUNTIF"))
    case("C18", '=COUNTIF(E1:E3,">APPLE")', num(1, "an ordering criterion folds case too"))
    case("C19", '="a"<"B"', boolean(True, 'ordering is case-insensitive: "a" sorts before "B"'))
    case("C20", '=VLOOKUP("APPLE",E1:E3,1,FALSE)', text("Apple", "VLOOKUP returns what the sheet holds"))
    # The blank/"" coercion, from both sides and without an IF around it.
    case("C21", '=A2=""', boolean(True, 'a blank cell equals ""'))
    case("C22", '=""=A2', boolean(True, "and the comparison is symmetric"))
    case("C23", '=A2="x"', boolean(False, "but it is not equal to non-empty text"))
    return build("edges.xlsx", [("edge", rows, checks)])


# --- 7. errors and their propagation ---------------------------------------


def errors():
    rows = {"A1": 1, "A2": 0, "A3": "x"}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    # An error is a value: it propagates through anything that touches it.
    rows["B1"] = "=A1/A2"
    rows["B2"] = "=B1+1"
    rows["B3"] = "=SUM(A1,B1)"
    case("C1", '=IFERROR(A1/A2,"caught")', text("caught", "IFERROR catches #DIV/0!"))
    case("C2", "=ISERROR(B1)", boolean(True, "ISERROR sees the division error"))
    case("C3", "=ISERROR(B2)", boolean(True, "an error propagates through +"))
    case("C4", "=ISERROR(B3)", boolean(True, "and is NOT skipped by SUM the way text is"))
    case("C5", '=IFERROR(VLOOKUP("nope",A1:A3,1,FALSE),"missing")',
         text("missing", "a failed exact VLOOKUP is #N/A"))
    case("C6", '=ISNA(MATCH("nope",A1:A3,0))', boolean(True, "a failed MATCH is #N/A"))
    case("C7", '=IFERROR(A3+1,"bad")', text("bad", "non-numeric text in arithmetic is #VALUE!"))
    case("C8", "=ISERROR(A1/A1)", boolean(False, "a fine division is not an error"))
    return build("errors.xlsx", [("err", rows, checks)])


# --- 8. dates as serial numbers --------------------------------------------


def dates():
    """Excel counts days from 1899-12-30, a consequence of the 1900 leap bug."""
    import datetime

    EPOCH = datetime.date(1899, 12, 30)

    def serial(y, m, d):
        return (datetime.date(y, m, d) - EPOCH).days

    rows, checks = {}, {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("A1", "=DATE(2024,1,31)", num(serial(2024, 1, 31), "a date is a day count from 1899-12-30"))
    case("A2", "=YEAR(DATE(2024,1,31))", num(2024, "YEAR"))
    case("A3", "=MONTH(DATE(2024,1,31))", num(1, "MONTH"))
    case("A4", "=DAY(DATE(2024,1,31))", num(31, "DAY"))
    case("A5", "=DATE(2024,3,1)-DATE(2024,2,1)", num(29, "2024 is a leap year, so February has 29 days"))
    case("A6", "=DATE(2023,3,1)-DATE(2023,2,1)", num(28, "2023 is not"))
    case("A7", "=EOMONTH(DATE(2024,2,10),0)", num(serial(2024, 2, 29), "EOMONTH finds the last day"))
    case("A8", "=EDATE(DATE(2024,1,31),1)", num(serial(2024, 2, 29), "EDATE clamps to a shorter month"))
    # 1900-02-29 does not exist, but Excel believes it does; day 60 is that
    # phantom, so 1900-03-01 is 61 rather than the 60 a real calendar gives.
    case(
        "A9",
        "=DATE(1900,3,1)",
        num(
            61,
            "the 1900 leap-year bug: day 61, not 60",
            diverges="we use a real calendar and return 60. Only dates before "
            "1900-03-01 are affected; every modern date on this sheet matches",
        ),
    )
    return build("dates.xlsx", [("d", rows, checks)])


# --- 9. the rounding family, especially on negatives ------------------------


def rounding():
    """Where implementations diverge most: direction on negatives, and how a
    decimal that has no exact binary form is rounded."""
    rows, checks = {}, {}

    def case(cell, formula, expected, note, diverges=None):
        rows[cell] = formula
        checks[cell] = num(expected, note, diverges)

    # Direction. Excel's names mean away-from-zero / toward-zero, NOT up/down
    # the number line, which is where a naive floor/ceil implementation breaks.
    case("A1", "=ROUNDUP(2.1,0)", 3, "ROUNDUP goes away from zero")
    case("A2", "=ROUNDUP(-2.1,0)", -3, "including for negatives")
    case("A3", "=ROUNDDOWN(2.9,0)", 2, "ROUNDDOWN goes toward zero")
    case("A4", "=ROUNDDOWN(-2.9,0)", -2, "including for negatives")
    case("A5", "=ROUND(-0.5,0)", -1, "ROUND is half away from zero")
    case("A6", "=ROUND(0.5,0)", 1, "in both directions")
    # Digits either side of the point.
    case("A7", "=ROUND(1234.5678,2)", 1234.57, "round to 2 decimals")
    case("A8", "=ROUND(1234.5678,-2)", 1200, "a negative digit count rounds left of the point")
    case("A9", "=ROUNDUP(1234.5678,-2)", 1300, "and ROUNDUP does too")
    case("A10", "=MROUND(7,2)", 8, "MROUND to the nearest multiple")
    case("A11", "=MROUND(-7,-2)", -8, "MROUND needs matching signs")
    case("A12", "=TRUNC(2.9)", 2, "TRUNC is ROUNDDOWN with a default")
    # A decimal with no exact binary form. 2.675 is really 2.67499999999999982…,
    # so a naive round-half-up on the binary value gives 2.67; Excel answers on
    # the decimal it showed you and gives 2.68.
    case("A13", "=ROUND(2.675,2)", 2.68, "Excel rounds the decimal it displayed, not the binary below it")
    case("A14", "=ROUND(1.005,2)", 1.01, "same trap, the textbook example")
    return build("rounding.xlsx", [("r", rows, checks)])


# --- 10. what a range contains, and what each function does with it ---------


def ranges():
    """A boolean in a RANGE and a boolean as an ARGUMENT are counted
    differently, which is the kind of rule nothing but a real workbook tests."""
    rows = {
        "A1": 1, "A2": 2, "A3": True, "A4": "text", "A5": None, "A6": 3,
        "B1": 10, "B2": 20, "B3": 30,
        "C1": 1, "C2": 2, "D1": 3, "D2": 4,
    }
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("F1", "=SUM(A1:A6)", num(6, "SUM ignores a boolean sitting in a range"))
    case("F2", "=SUM(A1,A2,TRUE,A6)", num(7, "but counts one passed as an argument"))
    # The neighbours of that rule, so a half-fix cannot hide here.
    case("F16", "=SUM(A1,A2,FALSE,A6)", num(6, "FALSE as an argument is 0, not a skip"))
    case("F17", "=SUMSQ(3,TRUE)", num(10, "SUMSQ takes arguments the same way"))
    case("F18", "=COUNT(A1,A2,TRUE,A6)", num(4, "COUNT counts a logical argument too"))
    case("F19", "=AVERAGE(1,TRUE,FALSE)", num(2 / 3, "AVERAGE divides by 3, having counted both"))
    case("F3", "=COUNT(A1:A6)", num(3, "COUNT ignores the boolean and the text in a range"))
    case("F4", "=COUNTA(A1:A6)", num(5, "COUNTA counts everything non-blank, including both"))
    case("F5", "=COUNTBLANK(A1:A6)", num(1, "COUNTBLANK finds the one gap"))
    case("F6", "=AVERAGE(A1:A6)", num(2, "AVERAGE divides by COUNT, not by the range size"))
    # A 2-D range, and one built from two columns.
    case("F7", "=SUM(C1:D2)", num(10, "a rectangular range sums every cell"))
    case("F8", "=MAX(C1:D2)", num(4, "MAX over two dimensions"))
    case("F9", "=SUM(B1:B3)/COUNT(B1:B3)", num(20, "the long way round to an average"))
    # A single cell is a legitimate range.
    case("F10", "=SUM(B1:B1)", num(10, "a one-cell range"))
    case("F11", "=SUMPRODUCT(C1:C2,D1:D2)", num(1 * 3 + 2 * 4, "SUMPRODUCT over two columns"))
    # Criteria forms that are easy to get wrong.
    case("F12", '=COUNTIF(B1:B3,">15")', num(2, "a comparison criterion"))
    case("F13", '=COUNTIF(B1:B3,"<>20")', num(2, "a not-equal criterion"))
    case("F14", '=SUMIF(B1:B3,">=20")', num(50, "SUMIF with no separate sum range sums the tested one"))
    case("F15", '=COUNTIFS(B1:B3,">=10",B1:B3,"<=20")', num(2, "COUNTIFS intersects its conditions"))
    return build("ranges.xlsx", [("rng", rows, checks)])


# --- 11. a long chain, and a web across sheets -----------------------------


def chain():
    """Depth and cross-sheet breadth: nothing here is cached, so a single
    mistake anywhere in the chain shows up at the end."""
    depth = 40
    rows = {"A1": 1}
    for i in range(2, depth + 1):
        # Each step is a different shape so the chain is not one operation
        # repeated: add, multiply, a function, a conditional.
        prev = f"A{i - 1}"
        if i % 4 == 0:
            rows[f"A{i}"] = f"={prev}+2"
        elif i % 4 == 1:
            rows[f"A{i}"] = f"={prev}*2"
        elif i % 4 == 2:
            rows[f"A{i}"] = f"=MAX({prev},1)"
        else:
            rows[f"A{i}"] = f"=IF({prev}>0,{prev}-1,0)"

    # The same recurrence, in Python.
    v = 1
    for i in range(2, depth + 1):
        if i % 4 == 0:
            v = v + 2
        elif i % 4 == 1:
            v = v * 2
        elif i % 4 == 2:
            v = max(v, 1)
        else:
            v = v - 1 if v > 0 else 0
    checks = {f"A{depth}": num(v, f"the end of a {depth}-deep chain of four alternating shapes")}
    # A midpoint too, so a failure says roughly where it went wrong.
    mv = 1
    for i in range(2, 21):
        if i % 4 == 0:
            mv = mv + 2
        elif i % 4 == 1:
            mv = mv * 2
        elif i % 4 == 2:
            mv = max(mv, 1)
        else:
            mv = mv - 1 if mv > 0 else 0
    checks["A20"] = num(mv, "the midpoint, so a failure localises")

    # Three sheets referring to each other.
    a = {"A1": 5}
    b = {"A1": "=one!A1*3", "A2": "=one!A1+one!A1"}
    c = {
        "A1": "=two!A1+two!A2",
        "A2": "=SUM(two!A1:A2)",
        "A3": "=one!A1*two!A1",
    }
    ac, bc = {}, {
        "A1": num(15, "a reference into another sheet"),
        "A2": num(10, "the same cell twice in one formula"),
    }
    cc = {
        "A1": num(25, "two hops: this sheet reads a sheet that reads a third"),
        "A2": num(25, "a RANGE on another sheet"),
        "A3": num(75, "two different sheets in one expression"),
    }
    return build(
        "chain.xlsx",
        [("deep", rows, checks), ("one", a, ac), ("two", b, bc), ("three", c, cc)],
    )


# --- 12. text boundaries, and how a number becomes text --------------------


def text_edges():
    rows = {"A1": "abc", "A2": 1.5, "A3": 1.0, "A4": True}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    # Asking for more than there is truncates rather than failing.
    case("C1", "=LEFT(A1,10)", text("abc", "LEFT past the end returns the whole string"))
    case("C2", "=RIGHT(A1,10)", text("abc", "and so does RIGHT"))
    case("C3", "=LEFT(A1,0)", text("", "zero characters is the empty string, not an error"))
    case("C4", "=MID(A1,10,5)", text("", "MID starting past the end is empty"))
    case("C5", "=MID(A1,2,10)", text("bc", "MID asking for too many stops at the end"))
    case("C6", "=LEN(LEFT(A1,0))", num(0, "the empty string has length 0"))
    case("C7", '=IFERROR(LEFT(A1,-1),"err")', text("err", "a negative count is #VALUE!"))
    # How values stringify when concatenated — the trap is that 1.0 is "1".
    case("C8", '=A3&""', text("1", "a whole number loses its decimal point"))
    case("C9", '=A2&""', text("1.5", "a fraction keeps it"))
    case("C10", '=A4&""', text("TRUE", "a boolean stringifies in upper case"))
    case("C11", '=1/4&""', text("0.25", "an exact binary fraction"))
    # Excel carries 15 significant digits, which is what a third stringifies to.
    case("C12", '=1/3&""', text("0.333333333333333", "15 significant digits, not 17"))
    # Every route a number takes to becoming text, since the rule was written
    # out at each of them separately.
    case("C21", '=(0.1+0.2)&""', text("0.3", "the residue is below the 15th digit and rounds away"))
    case("C22", '=(2/3)&""', text("0.666666666666667", "rounds at the 15th, not truncates"))
    case("C23", '=SQRT(2)&""', text("1.4142135623731", "a trailing zero at the 15th place is stripped"))
    case("C24", "=LEN(1/3&\"\")", num(17, "LEN agrees with what concatenation produced"))
    case("C25", '=UPPER(1/3)', text("0.333333333333333", "a text function fed a number sees the same string"))
    case("C26", '=(1/3)&"|"&(2/3)', text("0.333333333333333|0.666666666666667", "twice in one expression"))
    case("C27", '=0.0000001&""', text("0.0000001", "a small magnitude keeps decimal notation"))
    case("C28", '=1234.5678&""', text("1234.5678", "and an ordinary number is untouched"))
    case("C13", '=REPT("ab",3)', text("ababab", "REPT"))
    case("C14", '=TRIM("  a  b  ")', text("a b", "TRIM also collapses runs inside the string"))
    case("C16", '=TRIM("a")', text("a", "nothing to do"))
    case("C17", '=TRIM("   ")', text("", "all spaces collapses to nothing"))
    case("C18", '=TRIM("")', text("", "and the empty string survives"))
    case("C19", '=LEN(TRIM("a  b"))', num(3, "one space left between the words"))
    case("C20", '=TRIM("a" & CHAR(9) & "b")', text("a\tb", "a TAB is not a space; TRIM leaves it"))
    case("C15", '=SUBSTITUTE("aaa","a","b",2)', text("aba", "SUBSTITUTE with an instance number"))
    return build("textedge.xlsx", [("te", rows, checks)])


# --- 13. dynamic references -------------------------------------------------


def dynamic_refs():
    """OFFSET, INDIRECT and friends: the reference is computed, so the
    dependency is only known once the formula has run."""
    rows = {}
    for i, v in enumerate([10, 20, 30, 40, 50]):
        rows[f"A{i + 1}"] = v
    rows["B1"] = 100
    rows["B2"] = 200
    rows["C3"] = 7
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("E1", "=OFFSET(A1,2,0)", num(30, "OFFSET by rows"))
    case("E2", "=OFFSET(A1,0,1)", num(100, "OFFSET by columns"))
    case("E3", "=SUM(OFFSET(A1,1,0,3,1))", num(20 + 30 + 40, "OFFSET with a height makes a range"))
    case("E4", '=INDIRECT("A3")', num(30, "INDIRECT from a literal address"))
    case("E5", '=INDIRECT("A"&4)', num(40, "INDIRECT from a built address"))
    case("E6", '=SUM(INDIRECT("A1:A3"))', num(60, "INDIRECT can name a range"))
    # Neighbours of the range fix, so a half-fix cannot hide.
    case("E13", '=COUNT(INDIRECT("A1:A5"))', num(5, "the whole range, not its first cell"))
    case("E14", '=MAX(INDIRECT("A1:A5"))', num(50, "MAX over an INDIRECT range"))
    case("E15", '=SUM(INDIRECT("A1:B2"))', num(10 + 20 + 100 + 200, "a 2-D INDIRECT range"))
    case("E16", '=SUM(INDIRECT("A3:A1"))', num(60, "written backwards is the same rectangle"))
    case("E17", '=INDIRECT("A2:A2")', num(20, "a one-cell range is still a range"))
    case("E18", '=SUM(INDIRECT("A"&1&":A"&2))', num(30, "the range string can be built"))
    case("E7", "=ROW(A3)", num(3, "ROW of a reference"))
    case("E8", "=COLUMN(C3)", num(3, "COLUMN of a reference"))
    case("E9", "=INDEX(A1:A5,3)", num(30, "INDEX by position"))
    case(
        "E10",
        "=SUM(A1:INDEX(A1:A5,3))",
        num(
            60,
            "INDEX as one end of a range",
            diverges="we give #VALUE!. In Excel INDEX yields a REFERENCE when "
            "it is used in reference context, which is what makes the "
            "`A1:INDEX(...)` dynamic-range idiom work; ours yields a value, so "
            "the range operator has nothing to bind to",
        ),
    )
    case("E11", '=CHOOSE(2,"a","b","c")', text("b", "CHOOSE is 1-based"))
    case("E12", '=IFERROR(INDIRECT("not a ref"),"bad")', text("bad", "an unparseable address is #REF!"))
    return build("dynrefs.xlsx", [("dyn", rows, checks)])


# --- 14. nesting and short-circuiting --------------------------------------


def nesting():
    rows = {"A1": 5, "A2": 0, "A3": -3}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("C1", '=IF(A1>0,IF(A1>10,"big","mid"),"neg")', text("mid", "nested IF, inner true branch"))
    case("C2", '=IF(A3>0,"pos",IF(A3<0,"neg","zero"))', text("neg", "nested IF in the false branch"))
    # The untaken branch must not be evaluated, or this is #DIV/0!.
    case("C3", '=IF(A2=0,"safe",A1/A2)', text("safe", "IF does not evaluate the branch it did not take"))
    case("C4", "=IF(A2<>0,A1/A2,-1)", num(-1, "and the same the other way round"))
    case("C5", '=IFS(A3>0,"pos",A3<0,"neg",TRUE,"zero")', text("neg", "IFS takes the first true test"))
    case("C6", '=SWITCH(2,1,"one",2,"two","other")', text("two", "SWITCH matches a value"))
    case("C7", '=SWITCH(9,1,"one",2,"two","other")', text("other", "SWITCH falls back"))
    case("C8", "=AND(A1>0,A1<10,A2=0)", boolean(True, "AND over three tests"))
    case("C9", "=OR(A1<0,A2<0,A3<0)", boolean(True, "OR finds the one true test"))
    case("C10", "=NOT(AND(A1>0,A2>0))", boolean(True, "NOT around AND"))
    case("C11", "=XOR(TRUE,TRUE,TRUE)", boolean(True, "XOR is odd-parity, not exactly-one"))
    case("C12", "=SUM(IF(A1>0,A1,0),IF(A3>0,A3,0))", num(5, "a function call as an argument"))
    case("C13", "=MAX(MIN(A1,A3),A2)", num(0, "functions nested three deep"))
    return build("nesting.xlsx", [("n", rows, checks)])


# --- 15. numbers at the edges ----------------------------------------------


def numeric_edges():
    rows, checks = {}, {}

    def case(cell, formula, expected, note, diverges=None):
        rows[cell] = formula
        checks[cell] = num(expected, note, diverges)

    # Integers stay exact up to 2^53; past that f64 cannot tell 2^53 from
    # 2^53+1, and neither can Excel.
    case("A1", "=2^53", 9007199254740992, "the largest exactly-representable integer")
    case("A2", "=2^53+1-2^53", 0, "adding 1 past 2^53 is lost, as in every f64")
    case("A3", "=2^10", 1024, "a small power")
    case("A4", "=10^15", 1e15, "a large round number")
    # Very small and very large magnitudes.
    case("A5", "=1E-300*1E-10", 1e-310, "subnormal territory still multiplies")
    case("A6", "=1/3+1/3+1/3", 1, "three thirds come back to exactly 1 in binary64")
    # Magnified, because the residue is ~5.55e-17 and the comparison tolerance
    # near zero would wave through either answer otherwise.
    case(
        "A7",
        "=(0.1+0.2-0.3)*1E17",
        (0.1 + 0.2 - 0.3) * 1e17,
        "0.1+0.2 is not 0.3 in binary64, and the residue is the IEEE one",
    )
    # Signs and zero.
    case("A8", "=-0", 0, "negative zero is zero")
    case("A9", "=1E308*10-1E308*10", 0, "an overflow is #NUM!, so IFERROR is how this is testable")
    rows["A9"] = '=IFERROR(1E308*10,-1)'
    checks["A9"] = num(-1, "multiplying past the f64 range is #NUM!, not infinity")
    # Every arithmetic operator, since only division used to guard this.
    rows["A15"] = "=IFERROR(1E308+1E308,-1)"
    checks["A15"] = num(-1, "overflow through + is #NUM!")
    rows["A16"] = "=IFERROR(-1E308-1E308,-1)"
    checks["A16"] = num(-1, "and through -")
    rows["A17"] = "=IFERROR(1E200^2,-1)"
    checks["A17"] = num(-1, "and through ^")
    rows["A18"] = "=IFERROR(1E308/1E-308,-1)"
    checks["A18"] = num(-1, "division already guarded this")
    rows["A19"] = "=ISERROR(1E308*10)"
    checks["A19"] = boolean(True, "an overflow is testable with ISERROR, an infinity would not be")
    case("A10", "=SQRT(2)^2", 2.0000000000000004, "sqrt then square does not return exactly 2")
    case("A11", "=ABS(-1E100)", 1e100, "very large magnitudes survive ABS")
    case("A12", "=SIGN(-0.0001)", -1, "SIGN of a tiny negative")
    case("A13", "=POWER(2,0.5)", 2 ** 0.5, "POWER with a fractional exponent")
    case("A14", "=MOD(10,3)", 1, "MOD on positives")
    return build("numeric.xlsx", [("num", rows, checks)])


# --- 16. the money functions ------------------------------------------------


def financial():
    """Closed forms, computed here from the same inputs. Nothing iterative:
    IRR and RATE solve numerically and a tolerance argument would make the
    expectation a matter of opinion."""
    rate, nper, pv, fv = 0.05 / 12, 60, 20000.0, 0.0
    g = (1 + rate) ** nper
    pmt = -(rate * (pv * g + fv)) / (g - 1)

    rows = {"B1": rate, "B2": nper, "B3": pv}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("D1", "=PMT(B1,B2,B3)", num(pmt, "the level payment on a 5-year loan"))
    # FV of that annuity brings the balance back to zero.
    case("D2", "=FV(B1,B2,PMT(B1,B2,B3),B3)", num(0, "paying the PMT for NPER leaves nothing"))
    case(
        "D3",
        "=PV(B1,B2,PMT(B1,B2,B3))",
        num(pv, "PV of those payments is the principal back; PMT is negative, so this is positive"),
    )
    # NPV discounts from period 1, which is the classic off-by-one.
    flows = [-1000.0, 300.0, 400.0, 500.0]
    for i, f in enumerate(flows):
        rows[f"F{i + 1}"] = f
    r = 0.1
    npv_all = sum(f / (1 + r) ** (i + 1) for i, f in enumerate(flows))
    case("D4", "=NPV(0.1,F1:F4)", num(npv_all, "NPV discounts the FIRST value by one period"))
    npv_from_2 = flows[0] + sum(f / (1 + r) ** (i + 1) for i, f in enumerate(flows[1:]))
    case("D5", "=F1+NPV(0.1,F2:F4)", num(npv_from_2, "so an at-time-zero flow is added outside"))
    # Interest and principal split, and their sum is the payment.
    bal = pv
    ipmt1 = -bal * rate
    case("D6", "=IPMT(B1,1,B2,B3)", num(ipmt1, "the first period is all balance x rate"))
    case("D7", "=IPMT(B1,1,B2,B3)+PPMT(B1,1,B2,B3)", num(pmt, "interest plus principal is the payment"))
    case("D8", "=NPER(B1,PMT(B1,B2,B3),B3)", num(nper, "NPER inverts the payment"))
    case("D9", "=SLN(10000,1000,5)", num((10000 - 1000) / 5, "straight-line depreciation"))
    syd_total = sum(range(1, 6))
    case("D10", "=SYD(10000,1000,5,1)", num((10000 - 1000) * 5 / syd_total, "sum-of-years-digits, first year"))
    return build("financial.xlsx", [("fin", rows, checks)])


# --- 17. the time half of a serial number -----------------------------------


def times():
    """A day is 1.0, so a time is the fraction after the point."""
    rows, checks = {}, {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    noon = 0.5
    case("A1", "=TIME(12,0,0)", num(noon, "noon is half a day"))
    case("A2", "=TIME(6,0,0)", num(0.25, "a quarter past midnight in days"))
    case("A3", "=TIME(1,30,0)", num(90 / 1440, "an hour and a half"))
    case("A4", "=HOUR(TIME(13,45,30))", num(13, "HOUR"))
    case("A5", "=MINUTE(TIME(13,45,30))", num(45, "MINUTE"))
    case("A6", "=SECOND(TIME(13,45,30))", num(30, "SECOND"))
    # A time added to a date lands in the same serial.
    case("A7", "=HOUR(DATE(2024,1,1)+TIME(9,0,0))", num(9, "a time rides on a date serial"))
    case("A8", "=DAY(DATE(2024,1,1)+TIME(9,0,0))", num(1, "without moving the day"))
    # Rolling over.
    case("A9", "=HOUR(TIME(23,0,0)+TIME(2,0,0))", num(1, "adding past midnight wraps the hour"))
    case("A10", "=TIME(25,0,0)", num(1 / 24, "TIME takes hours modulo 24"))
    case("A11", "=WEEKDAY(DATE(2024,1,1))", num(2, "1 Jan 2024 was a Monday; WEEKDAY defaults to Sunday=1"))
    case("A12", "=WEEKDAY(DATE(2024,1,1),2)", num(1, "type 2 makes Monday=1"))
    case("A13", "=DATEDIF(DATE(2024,1,1),DATE(2024,3,1),\"d\")", num(60, "days between, 2024 being a leap year"))
    case("A14", "=DAYS(DATE(2024,3,1),DATE(2024,1,1))", num(60, "and DAYS agrees"))
    return build("times.xlsx", [("t", rows, checks)])


# --- 18. statistics ---------------------------------------------------------


def stats():
    import math

    data = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
    rows = {f"A{i + 1}": v for i, v in enumerate(data)}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    n = len(data)
    mean = sum(data) / n
    var_p = sum((x - mean) ** 2 for x in data) / n
    var_s = sum((x - mean) ** 2 for x in data) / (n - 1)
    srt = sorted(data)

    case("C1", "=MEDIAN(A1:A8)", num((srt[3] + srt[4]) / 2, "an even count averages the middle pair"))
    case("C2", "=VARP(A1:A8)", num(var_p, "population variance divides by n"))
    case("C3", "=VAR(A1:A8)", num(var_s, "sample variance divides by n-1"))
    case("C4", "=STDEVP(A1:A8)", num(math.sqrt(var_p), "population sd"))
    case("C5", "=STDEV(A1:A8)", num(math.sqrt(var_s), "sample sd"))
    case("C6", "=MODE(A1:A8)", num(4, "the most frequent value"))
    case("C7", "=LARGE(A1:A8,2)", num(srt[-2], "second largest"))
    case("C8", "=SMALL(A1:A8,2)", num(srt[1], "second smallest"))
    # PERCENTILE.INC interpolates at rank k*(n-1).
    k = 0.25
    pos = k * (n - 1)
    lo = int(pos)
    pct = srt[lo] + (pos - lo) * (srt[lo + 1] - srt[lo])
    case("C9", "=PERCENTILE(A1:A8,0.25)", num(pct, "linear interpolation between the bracketing values"))
    case("C10", "=QUARTILE(A1:A8,2)", num((srt[3] + srt[4]) / 2, "the second quartile is the median"))
    case("C11", "=RANK(9,A1:A8)", num(1, "RANK defaults to descending, so the largest is 1"))
    case("C12", "=RANK(2,A1:A8,1)", num(1, "ascending makes the smallest 1"))
    case("C13", "=AVEDEV(A1:A8)", num(sum(abs(x - mean) for x in data) / n, "mean absolute deviation"))
    case("C14", "=DEVSQ(A1:A8)", num(sum((x - mean) ** 2 for x in data), "sum of squared deviations"))
    case("C15", "=COUNTIF(A1:A8,4)", num(data.count(4.0), "how many fours"))
    return build("stats.xlsx", [("s", rows, checks)])


# --- 19. SUBTOTAL, which ignores its own kind -------------------------------


def subtotals():
    """SUBTOTAL's defining behaviour is that it skips nested SUBTOTALs, so a
    grand total over a column of subtotals does not double-count."""
    rows = {}
    checks = {}
    # Two groups of three, each with its own subtotal, then a grand total.
    a = [10.0, 20.0, 30.0]
    b = [40.0, 50.0, 60.0]
    for i, v in enumerate(a):
        rows[f"A{i + 1}"] = v
    rows["A4"] = "=SUBTOTAL(9,A1:A3)"
    for i, v in enumerate(b):
        rows[f"A{i + 5}"] = v
    rows["A8"] = "=SUBTOTAL(9,A5:A7)"
    rows["A9"] = "=SUBTOTAL(9,A1:A8)"
    rows["A10"] = "=SUM(A1:A8)"

    checks["A4"] = num(sum(a), "the first group's subtotal")
    checks["A8"] = num(sum(b), "the second group's")
    checks["A9"] = num(sum(a) + sum(b), "the grand total SKIPS the two subtotals in its range")
    # Neighbours of the skip, so a half-fix cannot hide.
    rows["C6"] = "=SUBTOTAL(1,A1:A8)"
    checks["C6"] = num((sum(a) + sum(b)) / 6, "AVERAGE skips them too, and divides by 6 not 8")
    rows["C7"] = "=SUBTOTAL(2,A1:A8)"
    checks["C7"] = num(6, "COUNT sees six numbers, not eight")
    rows["C8"] = "=SUBTOTAL(4,A1:A8)"
    checks["C8"] = num(max(a + b), "MAX is unaffected here but must still skip")
    rows["C9"] = "=SUBTOTAL(109,A1:A8)"
    checks["C9"] = num(sum(a) + sum(b), "the 101-111 range skips them as well")
    rows["C10"] = "=SUBTOTAL(9,A1:A3,A5:A7)"
    checks["C10"] = num(sum(a) + sum(b), "two refs, neither containing a subtotal")
    rows["C11"] = "=SUBTOTAL(9,A4)"
    checks["C11"] = num(0, "a subtotal referenced directly is skipped too, leaving nothing")
    checks["A10"] = num(sum(a) + sum(b) + sum(a) + sum(b), "a plain SUM does not, and double-counts")

    rows["C1"] = "=SUBTOTAL(1,A1:A3)"
    checks["C1"] = num(sum(a) / 3, "function 1 is AVERAGE")
    rows["C2"] = "=SUBTOTAL(2,A1:A3)"
    checks["C2"] = num(3, "2 is COUNT")
    rows["C3"] = "=SUBTOTAL(4,A1:A3)"
    checks["C3"] = num(max(a), "4 is MAX")
    rows["C4"] = "=SUBTOTAL(5,A1:A3)"
    checks["C4"] = num(min(a), "5 is MIN")
    rows["C5"] = "=SUBTOTAL(109,A1:A3)"
    checks["C5"] = num(sum(a), "109 is SUM ignoring hidden rows; none are hidden here")
    return build("subtotal.xlsx", [("sub", rows, checks)])


# --- 20. text that has to become a number -----------------------------------


def coercion():
    """The other direction from `number_to_text`: a string arriving where a
    number is wanted."""
    rows = {"A1": "5", "A2": "5.5", "A3": " 7 ", "A4": "abc", "A5": "", "A6": "1e3"}
    checks = {}

    def case(cell, formula, exp):
        rows[cell] = formula
        checks[cell] = exp

    case("C1", "=VALUE(A1)", num(5, "VALUE parses numeric text"))
    case("C2", "=VALUE(A2)", num(5.5, "including a decimal"))
    case("C3", "=VALUE(A3)", num(7, "surrounding spaces are tolerated"))
    case("C4", '=IFERROR(VALUE(A4),"bad")', text("bad", "non-numeric text is #VALUE!"))
    case("C5", "=A1*2", num(10, "numeric text coerces in arithmetic"))
    case("C6", "=A1&A2", text("55.5", "but & keeps them as text"))
    case("C7", "=N(A1)", num(0, "N does NOT parse text; it gives 0"))
    case("C8", "=N(5)", num(5, "N passes a number through"))
    case("C9", "=N(TRUE)", num(1, "and turns TRUE into 1"))
    case("C10", "=ISNUMBER(A1)", boolean(False, 'the string "5" is not a number'))
    case("C11", "=ISTEXT(A1)", boolean(True, "it is text"))
    case("C12", "=ISNUMBER(VALUE(A1))", boolean(True, "once parsed it is"))
    case("C13", "=T(A1)", text("5", "T returns text unchanged"))
    case("C14", "=T(5)", text("", "and gives empty for a number"))
    case("C15", "=TYPE(A1)", num(2, "TYPE: 1 number, 2 text, 4 logical, 16 error"))
    case("C16", "=TYPE(5)", num(1, "a number"))
    case("C17", "=TYPE(TRUE)", num(4, "a logical"))
    return build("coercion.xlsx", [("co", rows, checks)])


# --- 21. a workbook shaped like a real one ----------------------------------


def realistic():
    """Not a feature probe: a small model of the kind people actually build,
    where one wrong rule shows up as a wrong bottom line rather than a failed
    assertion about an operator."""
    products = [
        ("Widget", 120, 9.5, 4.25, "North"),
        ("Gadget", 80, 24.0, 11.0, "South"),
        ("Doohickey", 200, 3.75, 1.2, "North"),
        ("Thing", 45, 60.0, 38.5, "East"),
        ("Gizmo", 310, 2.1, 0.95, "South"),
    ]
    rows = {"A1": "product", "B1": "units", "C1": "price", "D1": "cost", "E1": "region"}
    for i, (name, units, price, cost, region) in enumerate(products):
        r = i + 2
        rows[f"A{r}"] = name
        rows[f"B{r}"] = units
        rows[f"C{r}"] = price
        rows[f"D{r}"] = cost
        rows[f"E{r}"] = region
        rows[f"F{r}"] = f"=B{r}*C{r}"
        rows[f"G{r}"] = f"=B{r}*D{r}"
        rows[f"H{r}"] = f"=F{r}-G{r}"
        rows[f"I{r}"] = f"=IF(F{r}=0,0,H{r}/F{r})"

    checks = {}
    rev = [u * p for _, u, p, _, _ in products]
    cogs = [u * c for _, u, _, c, _ in products]
    gross = [r - c for r, c in zip(rev, cogs)]

    for i in range(len(products)):
        r = i + 2
        checks[f"F{r}"] = num(rev[i], f"revenue for {products[i][0]}")
        checks[f"H{r}"] = num(gross[i], f"gross for {products[i][0]}")
        checks[f"I{r}"] = num(gross[i] / rev[i], f"margin for {products[i][0]}")

    rows["F8"] = "=SUM(F2:F6)"
    rows["G8"] = "=SUM(G2:G6)"
    rows["H8"] = "=F8-G8"
    rows["I8"] = "=H8/F8"
    checks["F8"] = num(sum(rev), "total revenue")
    checks["H8"] = num(sum(gross), "total gross")
    checks["I8"] = num(sum(gross) / sum(rev), "blended margin is NOT the average of the margins")

    # The same numbers reached a different way — a disagreement means one of
    # the two paths is wrong, which a single-path test cannot tell you.
    rows["K1"] = "=SUMPRODUCT(B2:B6,C2:C6)"
    checks["K1"] = num(sum(rev), "SUMPRODUCT agrees with the column of products")
    rows["K2"] = '=SUMIF(E2:E6,"North",F2:F6)'
    north = sum(r for r, (_, _, _, _, g) in zip(rev, products) if g == "North")
    checks["K2"] = num(north, "revenue for one region")
    rows["K3"] = '=SUMIFS(F2:F6,E2:E6,"North")'
    checks["K3"] = num(north, "SUMIFS agrees with SUMIF")
    rows["K4"] = '=COUNTIF(E2:E6,"North")'
    checks["K4"] = num(sum(1 for p in products if p[4] == "North"), "how many in that region")
    rows["K5"] = "=MAX(I2:I6)"
    checks["K5"] = num(max(g / r for g, r in zip(gross, rev)), "best margin")
    rows["K6"] = '=INDEX(A2:A6,MATCH(MAX(H2:H6),H2:H6,0))'
    best = products[gross.index(max(gross))][0]
    checks["K6"] = text(best, "the product behind the largest gross, by lookup")
    rows["K7"] = '=VLOOKUP("Gizmo",A2:I6,6,FALSE)'
    checks["K7"] = num(rev[4], "VLOOKUP into the computed columns")
    rows["K8"] = "=AVERAGE(I2:I6)"
    checks["K8"] = num(sum(g / r for g, r in zip(gross, rev)) / 5, "the unweighted average margin")
    rows["K9"] = "=ROUND(I8*100,1)"
    checks["K9"] = num(round(sum(gross) / sum(rev) * 1000) / 10, "margin as a rounded percentage")
    return build("realistic.xlsx", [("model", rows, checks)])


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = [
        arithmetic(),
        aggregation(),
        lookup(),
        text_funcs(),
        logic_and_model(),
        edges(),
        errors(),
        dates(),
        rounding(),
        ranges(),
        chain(),
        text_edges(),
        dynamic_refs(),
        nesting(),
        numeric_edges(),
        financial(),
        times(),
        stats(),
        subtotals(),
        coercion(),
        realistic(),
    ]
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")
    total = sum(len(m["checks"]) for m in manifest)
    print(f"{len(manifest)} workbooks, {total} checks -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
