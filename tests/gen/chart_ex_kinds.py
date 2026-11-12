"""Build tests/chart_ex_kinds.xlsx: one chart of every drawable chartEx kind.

Written from scratch (openpyxl cannot write chartEx), shaped the way Excel
writes these parts. Sheet1 holds the data; each chart reads a slice of it:

  A:B  Region / City     hierarchy for treemap and sunburst, sized by C
  C    Sales             also the Pareto measure, by city
  D    Score             box & whisker (grouped by region) and histogram
  F:G  Stage / Count     funnel
  I:J  Item / Amount     waterfall, row 6 ("End") marked as a total

Every chart carries its cached values too, as Excel writes them, so a reader
that cannot resolve the formulas still has something to draw.

Run: python3 tests/gen/chart_ex_kinds.py
"""

import pathlib
import zipfile
from xml.sax.saxutils import escape

DST = pathlib.Path(__file__).resolve().parent.parent / "chart_ex_kinds.xlsx"

ROWS = [
    ("East", "Shanghai", 40, 12, "Visits", 1000, "Start", 100),
    ("East", "Hangzhou", 25, 15, "Signups", 600, "Sales", 40),
    ("East", "Nanjing", 15, 18, "Trials", 300, "Refunds", -15),
    ("West", "Chengdu", 30, 22, "Paid", 120, "Costs", -30),
    ("West", "Xian", 10, 25, "Renewed", 80, "End", 95),
    ("North", "Beijing", 50, 30, None, None, None, None),
    ("North", "Tianjin", 20, 33, None, None, None, None),
    ("South", "Shenzhen", 35, 90, None, None, None, None),
]
HEADERS = {"A": "Region", "B": "City", "C": "Sales", "D": "Score",
           "F": "Stage", "G": "Count", "I": "Item", "J": "Amount"}
COLS = ["A", "B", "C", "D", "F", "G", "I", "J"]

NS_CX = "http://schemas.microsoft.com/office/drawing/2014/chartex"


def col_values(col):
    i = COLS.index(col)
    return [r[i] for r in ROWS if r[i] is not None]


def str_dim(ty, ref, levels):
    """`levels` is innermost first, as Excel orders `cx:lvl`."""
    lvls = "".join(
        f'<cx:lvl ptCount="{len(lv)}">'
        + "".join(f'<cx:pt idx="{i}">{escape(v)}</cx:pt>' for i, v in enumerate(lv))
        + "</cx:lvl>"
        for lv in levels
    )
    return f'<cx:strDim type="{ty}"><cx:f>{ref}</cx:f>{lvls}</cx:strDim>'


def num_dim(ty, ref, values):
    pts = "".join(f'<cx:pt idx="{i}">{v}</cx:pt>' for i, v in enumerate(values))
    return (
        f'<cx:numDim type="{ty}"><cx:f>{ref}</cx:f>'
        f'<cx:lvl ptCount="{len(values)}" formatCode="General">{pts}</cx:lvl></cx:numDim>'
    )


def series(layout, name_ref, name, data_id, layout_pr="", extra=""):
    return (
        f'<cx:series layoutId="{layout}"{extra}>'
        f"<cx:tx><cx:txData><cx:f>{name_ref}</cx:f><cx:v>{name}</cx:v></cx:txData></cx:tx>"
        f'<cx:dataId val="{data_id}"/>'
        + (f"<cx:layoutPr>{layout_pr}</cx:layoutPr>" if layout_pr else "")
        + "</cx:series>"
    )


def chart_space(title, data, series_xml, axes=True):
    axes_xml = (
        '<cx:axis id="0"><cx:catScaling gapWidth="0.5"/><cx:tickLabels/></cx:axis>'
        '<cx:axis id="1"><cx:valScaling/><cx:majorGridlines/><cx:tickLabels/></cx:axis>'
        if axes
        else ""
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<cx:chartSpace xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:cx="{NS_CX}">'
        f"<cx:chartData>{data}</cx:chartData>"
        f'<cx:chart><cx:title pos="t" align="ctr" overlay="0"><cx:tx><cx:txData><cx:v>{title}</cx:v>'
        f"</cx:txData></cx:tx></cx:title>"
        f"<cx:plotArea><cx:plotAreaRegion>{series_xml}</cx:plotAreaRegion>{axes_xml}</cx:plotArea>"
        '<cx:legend pos="t" align="ctr" overlay="0"/></cx:chart></cx:chartSpace>'
    )


cities = col_values("B")
regions = col_values("A")
sales = col_values("C")
scores = col_values("D")

CHARTS = [
    # (layout label, Requires, xml)
    ("treemap", "cx1", chart_space(
        "Sales by region",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$A$2:$B$9", [cities, regions])
        + num_dim("size", "Sheet1!$C$2:$C$9", sales)
        + "</cx:data>",
        series("treemap", "Sheet1!$C$1", "Sales", 0,
               '<cx:parentLabelLayout val="overlapping"/>'),
        axes=False,
    )),
    ("sunburst", "cx1", chart_space(
        "Sales by region",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$A$2:$B$9", [cities, regions])
        + num_dim("size", "Sheet1!$C$2:$C$9", sales)
        + "</cx:data>",
        series("sunburst", "Sheet1!$C$1", "Sales", 0),
        axes=False,
    )),
    ("funnel", "cx2", chart_space(
        "Conversion",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$F$2:$F$6", [col_values("F")])
        + num_dim("val", "Sheet1!$G$2:$G$6", col_values("G"))
        + "</cx:data>",
        series("funnel", "Sheet1!$G$1", "Count", 0),
        axes=False,
    )),
    ("boxWhisker", "cx1", chart_space(
        "Scores",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$A$2:$A$9", [regions])
        + num_dim("val", "Sheet1!$D$2:$D$9", scores)
        + "</cx:data>",
        series("boxWhisker", "Sheet1!$D$1", "Score", 0,
               '<cx:visibility meanLine="0" meanMarker="1" nonoutliers="0" outliers="1"/>'
               '<cx:statistics quartileMethod="exclusive"/>'),
    )),
    ("histogram", "cx1", chart_space(
        "Score distribution",
        '<cx:data id="0">' + num_dim("val", "Sheet1!$D$2:$D$9", scores) + "</cx:data>",
        series("clusteredColumn", "Sheet1!$D$1", "Score", 0,
               '<cx:binning intervalClosed="r"><cx:binCount val="4"/></cx:binning>'),
    )),
    ("pareto", "cx1", chart_space(
        "Sales by city",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$B$2:$B$9", [cities])
        + num_dim("val", "Sheet1!$C$2:$C$9", sales)
        + "</cx:data>",
        series("clusteredColumn", "Sheet1!$C$1", "Sales", 0, "<cx:aggregation/>")
        + series("paretoLine", "Sheet1!$C$1", "Sales", 0, "", ' ownerIdx="0"'),
    )),
    ("waterfall", "cx1", chart_space(
        "Cash flow",
        '<cx:data id="0">'
        + str_dim("cat", "Sheet1!$I$2:$I$6", [col_values("I")])
        + num_dim("val", "Sheet1!$J$2:$J$6", col_values("J"))
        + "</cx:data>",
        series("waterfall", "Sheet1!$J$1", "Amount", 0,
               '<cx:subtotals><cx:idx val="4"/></cx:subtotals>'),
    )),
]

REQUIRES_NS = {
    "cx1": "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex",
    "cx2": "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex",
}


def anchor(i, requires):
    col = 11 + (i % 2) * 7
    row = (i // 2) * 16
    ns = REQUIRES_NS[requires]
    return (
        f"<xdr:twoCellAnchor><xdr:from><xdr:col>{col}</xdr:col><xdr:colOff>0</xdr:colOff>"
        f"<xdr:row>{row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>"
        f"<xdr:to><xdr:col>{col + 6}</xdr:col><xdr:colOff>0</xdr:colOff>"
        f"<xdr:row>{row + 15}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>"
        '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
        f'<mc:Choice xmlns:{requires}="{ns}" Requires="{requires}">'
        f'<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="{i + 2}" name="Chart {i + 1}"/>'
        "<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>"
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
        f'<a:graphic><a:graphicData uri="{NS_CX}"><cx:chart xmlns:cx="{NS_CX}" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        f'r:id="rId{i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame></mc:Choice>'
        '<mc:Fallback><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="0" name=""/>'
        "<xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr/><xdr:txBody><a:bodyPr/><a:p><a:r>"
        "<a:t>This chart isn't available in your version of Excel.</a:t></a:r></a:p>"
        "</xdr:txBody></xdr:sp></mc:Fallback></mc:AlternateContent><xdr:clientData/>"
        "</xdr:twoCellAnchor>"
    )


def sheet_xml(strings):
    def s(v):
        if v not in strings:
            strings.append(v)
        return strings.index(v)

    rows = []
    hdr = "".join(f'<c r="{c}1" t="s"><v>{s(v)}</v></c>' for c, v in HEADERS.items())
    rows.append(f'<row r="1">{hdr}</row>')
    for n, r in enumerate(ROWS, start=2):
        cells = []
        for c, v in zip(COLS, r):
            if v is None:
                continue
            if isinstance(v, str):
                cells.append(f'<c r="{c}{n}" t="s"><v>{s(v)}</v></c>')
            else:
                cells.append(f'<c r="{c}{n}"><v>{v}</v></c>')
        rows.append(f'<row r="{n}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheetData>{"".join(rows)}</sheetData><drawing r:id="rId1"/></worksheet>'
    )


def main() -> None:
    strings: list[str] = []
    sheet = sheet_xml(strings)
    sst = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(strings)}" uniqueCount="{len(strings)}">'
        + "".join(f"<si><t>{escape(v)}</t></si>" for v in strings)
        + "</sst>"
    )
    drawing = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        + "".join(anchor(i, req) for i, (_, req, _) in enumerate(CHARTS))
        + "</xdr:wsDr>"
    )
    drawing_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(
            f'<Relationship Id="rId{i + 1}" Type="http://schemas.microsoft.com/office/2014/relationships/chartEx" '
            f'Target="../charts/chartEx{i + 1}.xml"/>'
            for i in range(len(CHARTS))
        )
        + "</Relationships>"
    )
    ct_charts = "".join(
        f'<Override PartName="/xl/charts/chartEx{i + 1}.xml" ContentType="application/vnd.ms-office.chartex+xml"/>'
        for i in range(len(CHARTS))
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
        f"{ct_charts}</Types>"
    )
    files = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="xl/workbook.xml"/></Relationships>'
        ),
        "xl/workbook.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            'Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
            'Target="sharedStrings.xml"/></Relationships>'
        ),
        "xl/worksheets/sheet1.xml": sheet,
        "xl/worksheets/_rels/sheet1.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" '
            'Target="../drawings/drawing1.xml"/></Relationships>'
        ),
        "xl/sharedStrings.xml": sst,
        "xl/drawings/drawing1.xml": drawing,
        "xl/drawings/_rels/drawing1.xml.rels": drawing_rels,
    }
    for i, (_, _, xml) in enumerate(CHARTS):
        files[f"xl/charts/chartEx{i + 1}.xml"] = xml
    with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)


if __name__ == "__main__":
    main()
