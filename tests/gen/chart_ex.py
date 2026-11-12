"""Build tests/chart_ex.xlsx: tests/graph.xlsx plus a waterfall chartEx.

openpyxl cannot write the chartEx family (treemap, waterfall, histogram, …), so
the part is injected by hand, shaped the way Excel writes it:

  - the drawing anchor wraps its graphicFrame in `mc:AlternateContent`, with a
    `Requires="cx1"` Choice holding `<cx:chart r:id>` and a Fallback text box
    for readers that do not know chartEx;
  - the drawing reaches the part through the 2014 `chartEx` relationship type;
  - the part has its own style/colors satellites and content-type overrides.

The classic chart in graph.xlsx stays, so a test can check the two coexist and
that neither drags the other's parts along.

Run: python3 tests/gen/chart_ex.py
"""

import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "graph.xlsx"
DST = ROOT / "chart_ex.xlsx"

CHART_EX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cx:chartSpace xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"><cx:chartData><cx:data id="0"><cx:strDim type="cat"><cx:f>Sheet1!$A$2:$A$4</cx:f><cx:lvl ptCount="3"><cx:pt idx="0">E</cx:pt><cx:pt idx="1">F</cx:pt><cx:pt idx="2">G</cx:pt></cx:lvl></cx:strDim><cx:numDim type="val"><cx:f>Sheet1!$B$2:$B$4</cx:f><cx:lvl ptCount="3" formatCode="General"><cx:pt idx="0">11</cx:pt><cx:pt idx="1">3</cx:pt><cx:pt idx="2">23</cx:pt></cx:lvl></cx:numDim></cx:data></cx:chartData><cx:chart><cx:title pos="t" align="ctr" overlay="0"><cx:tx><cx:txData><cx:v>Waterfall</cx:v></cx:txData></cx:tx></cx:title><cx:plotArea><cx:plotAreaRegion><cx:series layoutId="waterfall" uniqueId="{6F1A2B3C-0000-4000-8000-000000000001}"><cx:tx><cx:txData><cx:f>Sheet1!$B$1</cx:f><cx:v>A</cx:v></cx:txData></cx:tx><cx:dataId val="0"/><cx:layoutPr><cx:subtotals><cx:idx val="2"/></cx:subtotals></cx:layoutPr></cx:series></cx:plotAreaRegion><cx:axis id="0"><cx:catScaling gapWidth="0.5"/><cx:tickLabels/></cx:axis><cx:axis id="1"><cx:valScaling/><cx:majorGridlines/><cx:tickLabels/></cx:axis></cx:plotArea><cx:legend pos="t" align="ctr" overlay="0"/></cx:chart></cx:chartSpace>"""

CHART_EX_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors2.xml"/><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style2.xml"/></Relationships>"""

ANCHOR = """<xdr:twoCellAnchor><xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>16</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>13</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>30</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" Requires="cx1"><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="6" name="Chart 5"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/drawing/2014/chartex"><cx:chart xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId2"/></a:graphicData></a:graphic></xdr:graphicFrame></mc:Choice><mc:Fallback><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="0" name=""/><xdr:cNvSpPr><a:spLocks noTextEdit="1"/></xdr:cNvSpPr></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="4800600" y="2743200"/><a:ext cx="4572000" cy="2743200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr><xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1100"/><a:t>This chart isn't available in your version of Excel.</a:t></a:r></a:p></xdr:txBody></xdr:sp></mc:Fallback></mc:AlternateContent><xdr:clientData/></xdr:twoCellAnchor>"""

DRAWING_REL = '<Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2014/relationships/chartEx" Target="../charts/chartEx1.xml"/>'

OVERRIDES = (
    '<Override PartName="/xl/charts/chartEx1.xml" ContentType="application/vnd.ms-office.chartex+xml"/>'
    '<Override PartName="/xl/charts/style2.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>'
    '<Override PartName="/xl/charts/colors2.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>'
)


def main() -> None:
    with zipfile.ZipFile(SRC) as src, zipfile.ZipFile(
        DST, "w", zipfile.ZIP_DEFLATED
    ) as dst:
        originals = {}
        for item in src.infolist():
            data = src.read(item.filename)
            originals[item.filename] = data
            name = item.filename
            if name == "xl/drawings/drawing1.xml":
                data = data.replace(b"</xdr:wsDr>", ANCHOR.encode() + b"</xdr:wsDr>")
            elif name == "xl/drawings/_rels/drawing1.xml.rels":
                data = data.replace(
                    b"</Relationships>", DRAWING_REL.encode() + b"</Relationships>"
                )
            elif name == "[Content_Types].xml":
                data = data.replace(b"</Types>", OVERRIDES.encode() + b"</Types>")
            dst.writestr(item, data)
        dst.writestr("xl/charts/chartEx1.xml", CHART_EX)
        dst.writestr("xl/charts/_rels/chartEx1.xml.rels", CHART_EX_RELS)
        dst.writestr("xl/charts/style2.xml", originals["xl/charts/style1.xml"])
        dst.writestr("xl/charts/colors2.xml", originals["xl/charts/colors1.xml"])


if __name__ == "__main__":
    main()
