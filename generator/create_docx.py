# -*- coding: utf-8 -*-
"""
Publication-Grade DOCX Generator for CLOAK Monograph
Converts CLOAK_Project_2026_by_Abhijit_Kumar.md into a beautifully formatted Word (.docx) document
Author: Abhijit Kumar
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

MD_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "CLOAK_Project_2026_by_Abhijit_Kumar.md")
DOCX_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "CLOAK_Project_2026_by_Abhijit_Kumar.docx")

# Color Palette Constants
COLOR_NAVY = RGBColor(15, 23, 42)      # #0F172A - Primary Titles
COLOR_SLATE = RGBColor(30, 41, 59)     # #1E293B - Headings & Body
COLOR_MUTED = RGBColor(100, 116, 139)  # #64748B - Sub-metadata, headers
COLOR_TEAL = RGBColor(2, 132, 199)     # #0284C7 - Accent Cobalt / Teal
COLOR_DARK_TEAL = RGBColor(3, 105, 161) # #0369A1 - H3 Accent
COLOR_CODE = RGBColor(15, 23, 42)      # #0F172A - Code text

HEX_HEADER_BG = "1E293B"
HEX_ROW_ALT = "F8FAFC"
HEX_BORDER = "CBD5E1"
HEX_CODE_BG = "F8FAFC"
HEX_CALLOUT_BG = "F0F9FF"
HEX_CALLOUT_BORDER = "0284C7"

def add_xml_child(element, xml_str):
    child = parse_xml(xml_str)
    element.append(child)
    return child

def set_cell_margins(tbl, top=120, bottom=120, left=160, right=160):
    tblPr = tbl._tbl.tblPr
    tblCellMar = parse_xml(r'''
        <w:tblCellMar %s>
            <w:top w:w="%d" w:type="dxa"/>
            <w:bottom w:w="%d" w:type="dxa"/>
            <w:left w:w="%d" w:type="dxa"/>
            <w:right w:w="%d" w:type="dxa"/>
        </w:tblCellMar>
    ''' % (nsdecls('w'), top, bottom, left, right))
    tblPr.append(tblCellMar)

def set_table_borders(tbl, color="CBD5E1"):
    tblPr = tbl._tbl.tblPr
    tblBorders = parse_xml(r'''
        <w:tblBorders %s>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="%s"/>
            <w:left w:val="none"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="%s"/>
            <w:right w:val="none"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''' % (nsdecls('w'), color, color))
    tblPr.append(tblBorders)

def set_cell_shading(cell, hex_color):
    shd = parse_xml(r'<w:shd %s w:fill="%s"/>' % (nsdecls('w'), hex_color))
    cell._tc.get_or_add_tcPr().append(shd)

def prevent_row_split(row):
    trPr = row._tr.get_or_add_trPr()
    cantSplit = parse_xml(r'<w:cantSplit %s/>' % nsdecls('w'))
    trPr.append(cantSplit)

def repeat_header_row(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = parse_xml(r'<w:tblHeader %s/>' % nsdecls('w'))
    trPr.append(tblHeader)

def add_page_number_field(run):
    fld = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
    run._r.append(fld)

def add_numpages_field(run):
    fld = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
    run._r.append(fld)

def parse_markdown_inline(text):
    """
    Parses a string containing markdown inline tags into a list of run dictionaries:
    {'text': str, 'bold': bool, 'italic': bool, 'code': bool, 'url': str|None}
    """
    pattern = re.compile(
        r'(\*\*(.+?)\*\*)|'             # **bold**
        r'(\*(.+?)\*)|'                 # *italic*
        r'(`([^`]+?)`)|'                # `code`
        r'(\[([^\]]+)\]\(([^)]+)\))'    # [text](url)
    )
    
    pos = 0
    runs = []
    for m in pattern.finditer(text):
        start, end = m.span()
        if start > pos:
            runs.append({'text': text[pos:start], 'bold': False, 'italic': False, 'code': False})
        
        if m.group(1): # bold
            inner = m.group(2)
            if inner.startswith('`') and inner.endswith('`') and len(inner) >= 2:
                runs.append({'text': inner[1:-1], 'bold': True, 'italic': False, 'code': True})
            else:
                runs.append({'text': inner, 'bold': True, 'italic': False, 'code': False})
        elif m.group(3): # italic
            runs.append({'text': m.group(4), 'bold': False, 'italic': True, 'code': False})
        elif m.group(5): # code
            inner = m.group(6)
            if inner.startswith('**') and inner.endswith('**') and len(inner) >= 4:
                runs.append({'text': inner[2:-2], 'bold': True, 'italic': False, 'code': True})
            else:
                runs.append({'text': inner, 'bold': False, 'italic': False, 'code': True})
        elif m.group(7): # link
            runs.append({'text': m.group(8), 'bold': False, 'italic': False, 'code': False, 'url': m.group(9)})
        
        pos = end
    
    if pos < len(text):
        runs.append({'text': text[pos:], 'bold': False, 'italic': False, 'code': False})
        
    return runs

def append_inline_runs(paragraph, inline_tokens, base_font_size=10.0, base_color=COLOR_SLATE):
    """
    Appends formatted runs to a paragraph according to parsed inline tokens.
    """
    for token in inline_tokens:
        t_text = token['text']
        if not t_text:
            continue
        run = paragraph.add_run(t_text)
        run.bold = token.get('bold', False)
        run.italic = token.get('italic', False)
        
        if token.get('code', False):
            run.font.name = "Consolas"
            run.font.size = Pt(base_font_size * 0.9)
            run.font.color.rgb = COLOR_CODE
        elif token.get('url'):
            run.font.name = "Segoe UI"
            run.font.size = Pt(base_font_size)
            run.font.color.rgb = COLOR_TEAL
            run.underline = True
        else:
            run.font.name = "Segoe UI"
            run.font.size = Pt(base_font_size)
            run.font.color.rgb = base_color

def compute_col_widths(headers, rows, total_width_inches=6.9):
    col_count = len(headers)
    max_lens = [len(h) for h in headers]
    for row in rows:
        for j, cell in enumerate(row):
            if j < col_count:
                max_lens[j] = max(max_lens[j], len(cell))
    
    # Square root damping
    damped = [l ** 0.6 for l in max_lens]
    total_damped = sum(damped) if sum(damped) > 0 else 1.0
    
    widths = [(d / total_damped) * total_width_inches for d in damped]
    min_w = 0.65
    for i in range(col_count):
        if widths[i] < min_w:
            widths[i] = min_w
    cur_sum = sum(widths)
    widths = [(w / cur_sum) * total_width_inches for w in widths]
    return widths

def create_document():
    print(f"Reading {MD_PATH}...")
    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = docx.Document()

    # Configure Margins: 0.8 inches on all sides for optimal table & layout presentation
    section = doc.sections[0]
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)
    section.page_width = Inches(8.5)
    section.page_height = Inches(11.0)
    section.different_first_page_header_footer = True

    # Configure Header & Footer for pages 2+
    header = section.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hrun1 = hp.add_run("CLOAK Monograph (2026 Edition) — Sovereign Financial Infrastructure   |   ")
    hrun1.font.name = "Segoe UI"
    hrun1.font.size = Pt(8.5)
    hrun1.font.color.rgb = COLOR_MUTED
    hrun2 = hp.add_run("Abhijit Kumar")
    hrun2.font.name = "Segoe UI"
    hrun2.font.size = Pt(8.5)
    hrun2.font.bold = True
    hrun2.font.color.rgb = COLOR_TEAL

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    frun1 = fp.add_run("Confidential Engineering Reference   •   Page ")
    frun1.font.name = "Segoe UI"
    frun1.font.size = Pt(8.5)
    frun1.font.color.rgb = COLOR_MUTED
    add_page_number_field(frun1)
    frun2 = fp.add_run(" of ")
    frun2.font.name = "Segoe UI"
    frun2.font.size = Pt(8.5)
    frun2.font.color.rgb = COLOR_MUTED
    add_numpages_field(frun2)

    # ==========================================
    # 1. BUILD EXECUTIVE COVER PAGE
    # ==========================================
    print("Building Executive Cover Page...")
    
    # Top Tag
    p_tag = doc.add_paragraph()
    p_tag.paragraph_format.space_before = Pt(36)
    p_tag.paragraph_format.space_after = Pt(8)
    r_tag = p_tag.add_run("TECHNICAL MONOGRAPH & SYSTEM ARCHITECTURE REFERENCE  •  2026 EDITION")
    r_tag.font.name = "Segoe UI"
    r_tag.font.size = Pt(9.5)
    r_tag.font.bold = True
    r_tag.font.color.rgb = COLOR_TEAL

    # Main Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("CLOAK")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(44)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_NAVY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(8)
    r_sub = p_sub.add_run("Credential-Less Link for Online Auth & Keys")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(16)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_DARK_TEAL

    p_desc = doc.add_paragraph()
    p_desc.paragraph_format.space_before = Pt(0)
    p_desc.paragraph_format.space_after = Pt(20)
    r_desc = p_desc.add_run("A Sovereign, Zero-MDR, Self-Hosted Financial Verification Infrastructure for Independent Digital Engineers and Enterprise Applications")
    r_desc.font.name = "Segoe UI"
    r_desc.font.size = Pt(12)
    r_desc.font.italic = True
    r_desc.font.color.rgb = COLOR_SLATE

    # Accent Horizontal Bar (Table 1x1 2pt filled with teal)
    bar_tbl = doc.add_table(rows=1, cols=1)
    bar_tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    bar_cell = bar_tbl.rows[0].cells[0]
    bar_cell.width = Inches(6.9)
    set_cell_shading(bar_cell, "0284C7")
    bar_cell.paragraphs[0].paragraph_format.space_before = Pt(0)
    bar_cell.paragraphs[0].paragraph_format.space_after = Pt(0)
    r_b = bar_cell.paragraphs[0].add_run("")
    r_b.font.size = Pt(2)
    set_cell_margins(bar_tbl, top=20, bottom=20, left=40, right=40)

    # Executive Metadata Summary Card
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(24)
    p_spacer.paragraph_format.space_after = Pt(0)

    card_tbl = doc.add_table(rows=1, cols=1)
    card_tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    card_cell = card_tbl.rows[0].cells[0]
    card_cell.width = Inches(6.9)
    set_cell_shading(card_cell, "F8FAFC")
    set_cell_margins(card_tbl, top=180, bottom=180, left=220, right=220)
    
    # Border for metadata card
    tcPr = card_cell._tc.get_or_add_tcPr()
    card_borders = parse_xml(r'''
        <w:tcBorders %s>
            <w:top w:val="single" w:sz="6" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="18" w:color="0284C7"/>
            <w:bottom w:val="single" w:sz="6" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="6" w:color="CBD5E1"/>
        </w:tcBorders>
    ''' % nsdecls('w'))
    tcPr.append(card_borders)

    meta_items = [
        ("Author & System Architect:", "Abhijit Kumar"),
        ("Document Classification:", "Engineering Monograph & Architectural Reference"),
        ("Platform Version:", "v3.4.0-Production (2026 Edition)"),
        ("Target Protocols:", "NPCI Unified Payments Interface (UPI 2.0 / 2.1) & RFC 7519 JWT"),
        ("Settlement Switch:", "ICICI Bank Direct Gross Settlement (Zero MDR, Instant T+0 Liquidity)"),
        ("Relational Kernel:", "Enterprise PostgreSQL 16.x + Row-Level Security (RLS) + WAL Replication"),
        ("High-Availability Persistence:", "Dual-Sync Ingestion Pipeline (Supabase PostgreSQL + Google Cloud Sheets Fallback)"),
        ("Anti-Fraud Security Architecture:", "5-Layer Perimeter Defense + 3-Point Bank Cross-Check + FNV-1a/Murmur3 Seals"),
        ("Monograph Scope & Volume:", "45–50 Standard Pages | 18 Chapters | 5 Specification Appendices | 18,130 Words"),
    ]

    cp = card_cell.paragraphs[0]
    cp.paragraph_format.space_before = Pt(0)
    cp.paragraph_format.space_after = Pt(4)
    c_head = cp.add_run("ARCHITECTURAL SPECIFICATION SUMMARY")
    c_head.font.name = "Segoe UI"
    c_head.font.size = Pt(10)
    c_head.font.bold = True
    c_head.font.color.rgb = COLOR_DARK_TEAL

    for label, val in meta_items:
        p_item = card_cell.add_paragraph()
        p_item.paragraph_format.space_before = Pt(2)
        p_item.paragraph_format.space_after = Pt(2)
        r_lbl = p_item.add_run(f"•  {label} ")
        r_lbl.font.name = "Segoe UI"
        r_lbl.font.size = Pt(9.5)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = COLOR_NAVY
        r_val = p_item.add_run(val)
        r_val.font.name = "Segoe UI"
        r_val.font.size = Pt(9.5)
        r_val.font.color.rgb = COLOR_SLATE

    # Notice at bottom of cover
    p_bot = doc.add_paragraph()
    p_bot.paragraph_format.space_before = Pt(40)
    p_bot.paragraph_format.space_after = Pt(0)
    r_bot = p_bot.add_run("CONFIDENTIAL & SYSTEM REFERENCE  •  DISTRIBUTED FOR ARCHITECTURAL EVALUATION")
    r_bot.font.name = "Segoe UI"
    r_bot.font.size = Pt(8.5)
    r_bot.font.color.rgb = COLOR_MUTED

    # Page Break after Cover Page
    doc.add_page_break()

    # ==========================================
    # 2. PARSE AND RENDER MARKDOWN BODY
    # ==========================================
    print("Parsing Monograph Markdown content...")
    lines = md_text.split("\n")
    i = 0
    total_lines = len(lines)

    in_toc = False

    while i < total_lines:
        line = lines[i]
        stripped = line.strip()

        # Skip Front Matter top titles since we rendered the Cover Page
        if i < 18 and (stripped.startswith("# CLOAK:") or stripped.startswith("## An Institutional") or stripped.startswith("### Comprehensive") or stripped.startswith("**Author & Lead") or stripped.startswith("**Official") or stripped.startswith("**Document") or stripped.startswith("**Version:") or stripped.startswith("**Publication") or stripped.startswith("**License:") or stripped.startswith("**Primary Receiver") or stripped.startswith("**Database") or stripped.startswith("**Continuous") or stripped == "---"):
            i += 1
            continue

        # Skip empty lines
        if not stripped:
            i += 1
            continue

        # Detect Code / Diagram Block
        if stripped.startswith("```"):
            code_lines = []
            i += 1
            while i < total_lines and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1 # skip closing ```

            # Render Code / Diagram block in a styled single-cell card
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
            cell = tbl.rows[0].cells[0]
            cell.width = Inches(6.9)
            set_cell_shading(cell, HEX_CODE_BG)
            set_cell_margins(tbl, top=100, bottom=100, left=140, right=140)

            # Border for code block
            tcPr = cell._tc.get_or_add_tcPr()
            code_borders = parse_xml(r'''
                <w:tcBorders %s>
                    <w:top w:val="single" w:sz="4" w:color="E2E8F0"/>
                    <w:left w:val="single" w:sz="12" w:color="94A3B8"/>
                    <w:bottom w:val="single" w:sz="4" w:color="E2E8F0"/>
                    <w:right w:val="single" w:sz="4" w:color="E2E8F0"/>
                </w:tcBorders>
            ''' % nsdecls('w'))
            tcPr.append(code_borders)

            cp = cell.paragraphs[0]
            cp.paragraph_format.space_before = Pt(0)
            cp.paragraph_format.space_after = Pt(0)
            cp.paragraph_format.line_spacing = 1.05

            full_code = "\n".join(code_lines)
            r_c = cp.add_run(full_code)
            r_c.font.name = "Consolas"
            r_c.font.size = Pt(8.0)
            r_c.font.color.rgb = COLOR_CODE

            # Spacer after code box
            p_sp = doc.add_paragraph()
            p_sp.paragraph_format.space_before = Pt(4)
            p_sp.paragraph_format.space_after = Pt(2)
            continue

        # Detect Markdown Table
        if stripped.startswith("|") and stripped.endswith("|"):
            tbl_lines = []
            while i < total_lines and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1

            if len(tbl_lines) >= 2:
                # Parse header and rows
                raw_headers = [c.strip() for c in tbl_lines[0].split("|")[1:-1]]
                raw_rows = []
                for row_line in tbl_lines[1:]:
                    if "-|-" in row_line or ":---" in row_line or "---|" in row_line:
                        continue
                    cells = [c.strip() for c in row_line.split("|")[1:-1]]
                    if cells:
                        raw_rows.append(cells)

                # Compute optimal column widths
                col_widths = compute_col_widths(raw_headers, raw_rows, total_width_inches=6.9)

                table = doc.add_table(rows=len(raw_rows) + 1, cols=len(raw_headers))
                table.alignment = WD_TABLE_ALIGNMENT.LEFT
                set_table_borders(table)
                set_cell_margins(table, top=100, bottom=100, left=140, right=140)

                # Render Table Header
                header_row = table.rows[0]
                repeat_header_row(header_row)
                prevent_row_split(header_row)

                for j, h_text in enumerate(raw_headers):
                    if j < len(header_row.cells):
                        cell = header_row.cells[j]
                        cell.width = Inches(col_widths[j])
                        set_cell_shading(cell, HEX_HEADER_BG)
                        p = cell.paragraphs[0]
                        p.paragraph_format.space_before = Pt(2)
                        p.paragraph_format.space_after = Pt(2)
                        tokens = parse_markdown_inline(h_text)
                        for t in tokens:
                            run = p.add_run(t['text'])
                            run.font.name = "Segoe UI"
                            run.font.size = Pt(8.5)
                            run.font.bold = True
                            run.font.color.rgb = RGBColor(255, 255, 255)

                # Render Table Rows
                for row_idx, r_cells in enumerate(raw_rows):
                    row = table.rows[row_idx + 1]
                    prevent_row_split(row)
                    fill_color = HEX_ROW_ALT if row_idx % 2 == 1 else "FFFFFF"

                    for col_idx in range(len(raw_headers)):
                        if col_idx < len(row.cells):
                            cell = row.cells[col_idx]
                            cell.width = Inches(col_widths[col_idx])
                            if fill_color != "FFFFFF":
                                set_cell_shading(cell, fill_color)

                            cell_text = r_cells[col_idx] if col_idx < len(r_cells) else ""
                            p = cell.paragraphs[0]
                            p.paragraph_format.space_before = Pt(2)
                            p.paragraph_format.space_after = Pt(2)
                            tokens = parse_markdown_inline(cell_text)
                            append_inline_runs(p, tokens, base_font_size=8.5, base_color=COLOR_SLATE)

                # Spacer after table
                p_sp = doc.add_paragraph()
                p_sp.paragraph_format.space_before = Pt(6)
                p_sp.paragraph_format.space_after = Pt(2)
            continue

        # Detect Major Headings
        if stripped.startswith("# PART "):
            doc.add_page_break()
            p_part_tag = doc.add_paragraph()
            p_part_tag.paragraph_format.space_before = Pt(18)
            p_part_tag.paragraph_format.space_after = Pt(4)
            p_part_tag.paragraph_format.keep_with_next = True
            r_pt = p_part_tag.add_run("SYSTEM ARCHITECTURE SECTION")
            r_pt.font.name = "Segoe UI"
            r_pt.font.size = Pt(10)
            r_pt.font.bold = True
            r_pt.font.color.rgb = COLOR_TEAL

            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(0)
            p_h.paragraph_format.space_after = Pt(12)
            p_h.paragraph_format.keep_with_next = True
            r_h = p_h.add_run(stripped[2:])
            r_h.font.name = "Segoe UI"
            r_h.font.size = Pt(20)
            r_h.font.bold = True
            r_h.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if stripped.startswith("# Chapter ") or stripped.startswith("# Appendix "):
            doc.add_page_break()
            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(16)
            p_h.paragraph_format.space_after = Pt(8)
            p_h.paragraph_format.keep_with_next = True
            r_h = p_h.add_run(stripped[2:])
            r_h.font.name = "Segoe UI"
            r_h.font.size = Pt(16)
            r_h.font.bold = True
            r_h.font.color.rgb = COLOR_NAVY

            # Underline accent bar
            bar = doc.add_table(rows=1, cols=1)
            bar.alignment = WD_TABLE_ALIGNMENT.LEFT
            b_cell = bar.rows[0].cells[0]
            b_cell.width = Inches(2.5)
            set_cell_shading(b_cell, "0284C7")
            b_cell.paragraphs[0].paragraph_format.space_before = Pt(0)
            b_cell.paragraphs[0].paragraph_format.space_after = Pt(0)
            r_b = b_cell.paragraphs[0].add_run("")
            r_b.font.size = Pt(1.5)
            set_cell_margins(bar, top=10, bottom=10, left=10, right=10)

            p_sp = doc.add_paragraph()
            p_sp.paragraph_format.space_before = Pt(6)
            p_sp.paragraph_format.space_after = Pt(0)
            i += 1
            continue

        if stripped.startswith("# "):
            doc.add_page_break()
            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(16)
            p_h.paragraph_format.space_after = Pt(8)
            p_h.paragraph_format.keep_with_next = True
            r_h = p_h.add_run(stripped[2:])
            r_h.font.name = "Segoe UI"
            r_h.font.size = Pt(17)
            r_h.font.bold = True
            r_h.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if stripped.startswith("## "):
            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(14)
            p_h.paragraph_format.space_after = Pt(4)
            p_h.paragraph_format.keep_with_next = True
            tokens = parse_markdown_inline(stripped[3:])
            for t in tokens:
                r_h = p_h.add_run(t['text'])
                r_h.font.name = "Segoe UI"
                r_h.font.size = Pt(12.5)
                r_h.font.bold = True
                r_h.font.color.rgb = COLOR_SLATE
            i += 1
            continue

        if stripped.startswith("### "):
            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(10)
            p_h.paragraph_format.space_after = Pt(3)
            p_h.paragraph_format.keep_with_next = True
            tokens = parse_markdown_inline(stripped[4:])
            for t in tokens:
                r_h = p_h.add_run(t['text'])
                r_h.font.name = "Segoe UI"
                r_h.font.size = Pt(11)
                r_h.font.bold = True
                r_h.font.color.rgb = COLOR_DARK_TEAL
            i += 1
            continue

        if stripped.startswith("#### "):
            p_h = doc.add_paragraph()
            p_h.paragraph_format.space_before = Pt(8)
            p_h.paragraph_format.space_after = Pt(2)
            p_h.paragraph_format.keep_with_next = True
            tokens = parse_markdown_inline(stripped[5:])
            for t in tokens:
                r_h = p_h.add_run(t['text'])
                r_h.font.name = "Segoe UI"
                r_h.font.size = Pt(10)
                r_h.font.bold = True
                r_h.font.italic = True
                r_h.font.color.rgb = COLOR_SLATE
            i += 1
            continue

        # Horizontal Divider
        if stripped == "---":
            p_div = doc.add_paragraph()
            p_div.paragraph_format.space_before = Pt(8)
            p_div.paragraph_format.space_after = Pt(8)
            p_div.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r_d = p_div.add_run("•  •  •")
            r_d.font.name = "Segoe UI"
            r_d.font.size = Pt(8)
            r_d.font.color.rgb = COLOR_MUTED
            i += 1
            continue

        # Blockquote / Callout
        if stripped.startswith("> "):
            callout_text = stripped[2:].strip()
            # If multiple consecutive blockquote lines, combine them
            while i + 1 < total_lines and lines[i + 1].strip().startswith("> "):
                i += 1
                callout_text += " " + lines[i].strip()[2:].strip()

            c_tbl = doc.add_table(rows=1, cols=1)
            c_tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
            c_cell = c_tbl.rows[0].cells[0]
            c_cell.width = Inches(6.9)
            set_cell_shading(c_cell, HEX_CALLOUT_BG)
            set_cell_margins(c_tbl, top=100, bottom=100, left=180, right=140)

            tcPr = c_cell._tc.get_or_add_tcPr()
            c_borders = parse_xml(r'''
                <w:tcBorders %s>
                    <w:top w:val="none"/>
                    <w:left w:val="single" w:sz="20" w:color="%s"/>
                    <w:bottom w:val="none"/>
                    <w:right w:val="none"/>
                </w:tcBorders>
            ''' % (nsdecls('w'), HEX_CALLOUT_BORDER))
            tcPr.append(c_borders)

            cp = c_cell.paragraphs[0]
            cp.paragraph_format.space_before = Pt(2)
            cp.paragraph_format.space_after = Pt(2)
            tokens = parse_markdown_inline(callout_text)
            for t in tokens:
                r = cp.add_run(t['text'])
                r.font.name = "Segoe UI"
                r.font.size = Pt(9.5)
                r.font.italic = True
                r.font.bold = t.get('bold', False)
                r.font.color.rgb = COLOR_DARK_TEAL

            p_sp = doc.add_paragraph()
            p_sp.paragraph_format.space_before = Pt(4)
            p_sp.paragraph_format.space_after = Pt(2)
            i += 1
            continue

        # Bullet List Items
        if stripped.startswith("- ") or stripped.startswith("* "):
            item_text = stripped[2:].strip()
            # Check indentation level from original line
            indent_level = (len(line) - len(line.lstrip())) // 2
            left_indent = Inches(0.25 + indent_level * 0.2)

            p_li = doc.add_paragraph()
            p_li.paragraph_format.left_indent = left_indent
            p_li.paragraph_format.space_before = Pt(1.5)
            p_li.paragraph_format.space_after = Pt(2.0)
            p_li.paragraph_format.line_spacing = 1.15

            r_bullet = p_li.add_run("•  ")
            r_bullet.font.name = "Segoe UI"
            r_bullet.font.size = Pt(9.5)
            r_bullet.font.bold = True
            r_bullet.font.color.rgb = COLOR_TEAL

            tokens = parse_markdown_inline(item_text)
            append_inline_runs(p_li, tokens, base_font_size=9.5, base_color=COLOR_SLATE)
            i += 1
            continue

        # Numbered List Items
        m_num = re.match(r'^(\d+)\.\s+(.*)', stripped)
        if m_num:
            num_str = m_num.group(1)
            item_text = m_num.group(2)
            indent_level = (len(line) - len(line.lstrip())) // 2
            left_indent = Inches(0.25 + indent_level * 0.2)

            p_li = doc.add_paragraph()
            p_li.paragraph_format.left_indent = left_indent
            p_li.paragraph_format.space_before = Pt(2.0)
            p_li.paragraph_format.space_after = Pt(2.5)
            p_li.paragraph_format.line_spacing = 1.15

            r_num = p_li.add_run(f"{num_str}.  ")
            r_num.font.name = "Segoe UI"
            r_num.font.size = Pt(9.5)
            r_num.font.bold = True
            r_num.font.color.rgb = COLOR_DARK_TEAL

            tokens = parse_markdown_inline(item_text)
            append_inline_runs(p_li, tokens, base_font_size=9.5, base_color=COLOR_SLATE)
            i += 1
            continue

        # Standard Paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4.5)
        p.paragraph_format.line_spacing = 1.15
        tokens = parse_markdown_inline(stripped)
        append_inline_runs(p, tokens, base_font_size=10.0, base_color=COLOR_SLATE)
        i += 1

    print(f"Saving compiled DOCX to {DOCX_PATH}...")
    doc.save(DOCX_PATH)
    file_size_mb = os.path.getsize(DOCX_PATH) / (1024 * 1024)
    print(f"Successfully generated {DOCX_PATH} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    create_document()
