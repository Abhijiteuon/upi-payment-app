# -*- coding: utf-8 -*-
"""
Master Build Script for CLOAK Monograph
Assembles all chapters, converts to formatted Markdown and Publication-Grade HTML
"""

import os
import sys
import re
import html

# Ensure generator directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from part1 import FRONT_MATTER, CHAPTER_1
from part2 import CHAPTER_3
from part3 import CHAPTER_5
from part4 import CHAPTER_8
from part5 import CHAPTER_11
from part6 import CHAPTER_13
from part7 import CHAPTER_15
from part8 import CHAPTER_17
from appendices import APPENDICES

def assemble_markdown():
    sections = [
        FRONT_MATTER,
        CHAPTER_1,
        CHAPTER_3,
        CHAPTER_5,
        CHAPTER_8,
        CHAPTER_11,
        CHAPTER_13,
        CHAPTER_15,
        CHAPTER_17,
        APPENDICES
    ]
    return "\n\n---\n\n".join(sections)

def simple_markdown_to_html(md_text):
    """
    Converts structured Markdown into elegant HTML publication markup.
    """
    lines = md_text.split("\n")
    html_lines = []
    in_code_block = False
    code_lang = ""
    code_content = []
    in_table = False

    for line in lines:
        # Code Blocks
        if line.startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lang = line[3:].strip()
                code_content = []
                continue
            else:
                in_code_block = False
                escaped_code = html.escape("\n".join(code_content))
                html_lines.append(f'<div class="code-container"><div class="code-lang-tag">{code_lang or "code"}</div><pre><code>{escaped_code}</code></pre></div>')
                continue

        if in_code_block:
            code_content.append(line)
            continue

        # Tables
        if "|" in line and ("-|-" in line or ":---" in line):
            continue
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if not in_table:
                in_table = True
                html_lines.append('<div class="table-container"><table>')
                html_lines.append("<thead><tr>" + "".join([f"<th>{html.escape(c)}</th>" for c in cells]) + "</tr></thead><tbody>")
            else:
                html_lines.append("<tr>" + "".join([f"<td>{html.escape(c)}</td>" for c in cells]) + "</tr>")
            continue
        elif in_table:
            in_table = False
            html_lines.append("</tbody></table></div>")

        # Headings
        if line.startswith("# "):
            html_lines.append(f'<h1 class="chapter-title">{html.escape(line[2:])}</h1>')
        elif line.startswith("## "):
            html_lines.append(f'<h2 class="section-title">{html.escape(line[3:])}</h2>')
        elif line.startswith("### "):
            html_lines.append(f'<h3 class="sub-section-title">{html.escape(line[4:])}</h3>')
        elif line.startswith("#### "):
            html_lines.append(f'<h4 class="sub-sub-section-title">{html.escape(line[5:])}</h4>')
        elif line.startswith("---"):
            html_lines.append('<hr class="divider" />')
        elif line.startswith("> "):
            quote_text = line[2:].strip()
            html_lines.append(f'<blockquote class="callout-quote">{html.escape(quote_text)}</blockquote>')
        elif line.startswith("- ") or line.startswith("* "):
            item_text = line[2:].strip()
            formatted_item = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html.escape(item_text))
            formatted_item = re.sub(r'`(.*?)`', r'<code>\1</code>', formatted_item)
            html_lines.append(f'<li class="list-item">{formatted_item}</li>')
        elif line.strip() == "":
            html_lines.append('<div class="spacer"></div>')
        else:
            # Paragraph
            formatted_line = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html.escape(line))
            formatted_line = re.sub(r'`(.*?)`', r'<code>\1</code>', formatted_line)
            html_lines.append(f'<p class="paragraph">{formatted_line}</p>')

    if in_table:
        html_lines.append("</tbody></table></div>")

    return "\n".join(html_lines)

def build_full_html(body_html, total_words, estimated_pages):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CLOAK Project 2026 by Abhijit Kumar - Complete Comprehensive Study</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg-page: #08090d;
    --bg-card: #0d1017;
    --border-color: rgba(255, 255, 255, 0.08);
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    --color-emerald: #10b981;
    --color-sky: #38bdf8;
    --color-indigo: #6366f1;
    --color-amber: #f59e0b;
    --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    background-color: var(--bg-page);
    color: var(--text-primary);
    font-family: var(--font-sans);
    line-height: 1.7;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }}

  /* Ambient Glow */
  .ambient-spotlight {{
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1000px;
    height: 500px;
    background: radial-gradient(ellipse at top, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }}

  .document-wrapper {{
    position: relative;
    z-index: 1;
    max-width: 1120px;
    margin: 40px auto;
    padding: 70px 90px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 18px;
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85);
  }}

  /* Cover Banner */
  .monograph-cover {{
    text-align: center;
    padding: 60px 20px 80px;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 60px;
  }}

  .cover-badge {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 9999px;
    color: var(--color-indigo);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 24px;
    font-family: var(--font-mono);
  }}

  .cover-title {{
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.2;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}

  .cover-subtitle {{
    font-size: 19px;
    color: var(--text-secondary);
    max-width: 840px;
    margin: 0 auto 32px;
    line-height: 1.5;
  }}

  .cover-meta-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 20px;
    margin-top: 40px;
    text-align: left;
    background: rgba(255, 255, 255, 0.02);
    padding: 24px 28px;
    border-radius: 14px;
    border: 1px solid var(--border-color);
  }}

  .cover-meta-item .meta-label {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-family: var(--font-mono);
    margin-bottom: 4px;
  }}

  .cover-meta-item .meta-value {{
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }}

  /* Typography */
  h1.chapter-title {{
    font-size: 28px;
    font-weight: 800;
    margin: 60px 0 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    color: #ffffff;
    letter-spacing: -0.015em;
  }}

  h2.section-title {{
    font-size: 21px;
    font-weight: 700;
    margin: 40px 0 18px;
    color: var(--color-sky);
  }}

  h3.sub-section-title {{
    font-size: 17px;
    font-weight: 600;
    margin: 28px 0 14px;
    color: var(--text-primary);
  }}

  h4.sub-sub-section-title {{
    font-size: 15px;
    font-weight: 600;
    margin: 20px 0 10px;
    color: var(--text-secondary);
  }}

  p.paragraph {{
    margin-bottom: 16px;
    color: var(--text-secondary);
    text-align: justify;
  }}

  .divider {{
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 48px 0;
  }}

  .callout-quote {{
    margin: 24px 0;
    padding: 18px 24px;
    background: rgba(99, 102, 241, 0.07);
    border-left: 4px solid var(--color-indigo);
    border-radius: 0 10px 10px 0;
    color: var(--text-primary);
    font-style: italic;
  }}

  li.list-item {{
    margin-left: 28px;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }}

  .spacer {{
    height: 14px;
  }}

  /* Code Blocks */
  .code-container {{
    position: relative;
    margin: 28px 0;
    background: #040508;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    overflow: hidden;
  }}

  .code-lang-tag {{
    position: absolute;
    top: 8px;
    right: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 8px;
    border-radius: 4px;
  }}

  pre {{
    padding: 22px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    color: #e2e8f0;
  }}

  code {{
    font-family: var(--font-mono);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    color: #f1f5f9;
  }}

  pre code {{
    background: none;
    padding: 0;
  }}

  /* Tables */
  .table-container {{
    overflow-x: auto;
    margin: 28px 0;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
  }}

  th {{
    background: rgba(255, 255, 255, 0.05);
    padding: 14px 18px;
    border-bottom: 2px solid var(--border-color);
    font-weight: 700;
    color: var(--text-primary);
  }}

  td {{
    padding: 12px 18px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-secondary);
  }}

  tr:hover td {{
    background: rgba(255, 255, 255, 0.02);
  }}

  /* Print Stylesheet for exact 45-50 Page Physical Pagination */
  @page {{
    size: A4;
    margin: 20mm;
  }}

  @media print {{
    body {{
      background: #ffffff !important;
      color: #000000 !important;
      font-size: 10pt !important;
      line-height: 1.45 !important;
    }}
    .ambient-spotlight {{
      display: none !important;
    }}
    .document-wrapper {{
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: #ffffff !important;
    }}
    .cover-title {{
      background: none !important;
      -webkit-text-fill-color: initial !important;
      color: #000000 !important;
    }}
    p.paragraph, li.list-item, td {{
      color: #1f2937 !important;
    }}
    h1.chapter-title {{
      page-break-before: always;
      color: #111827 !important;
      border-bottom: 2px solid #000000 !important;
    }}
    h2.section-title {{
      color: #1e3a8a !important;
    }}
    .code-container {{
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      page-break-inside: avoid;
    }}
    pre {{
      color: #0f172a !important;
    }}
    table {{
      page-break-inside: avoid;
    }}
    th {{
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }}
    td {{
      border-bottom: 1px solid #e2e8f0 !important;
    }}
  }}
</style>
</head>
<body>
<div class="ambient-spotlight"></div>
<div class="document-wrapper">
  <div class="monograph-cover">
    <div class="cover-badge">INSTITUTIONAL TECHNICAL MONOGRAPH · 2026 EDITION</div>
    <h1 class="cover-title">CLOAK PROTOCOL</h1>
    <p class="cover-subtitle">Credential-less Link for Online Auth & Keys: An Institutional-Grade, Privacy-First UPI Settlement & Anti-Fraud Verification Platform</p>
    
    <div class="cover-meta-grid">
      <div class="cover-meta-item">
        <div class="meta-label">Author & Architect</div>
        <div class="meta-value">Abhijit Kumar</div>
      </div>
      <div class="cover-meta-item">
        <div class="meta-label">Platform Version</div>
        <div class="meta-value">v3.4.0 Production</div>
      </div>
      <div class="cover-meta-item">
        <div class="meta-label">Volume & Extent</div>
        <div class="meta-value">{total_words:,} Words (~{estimated_pages:.0f} Pages)</div>
      </div>
      <div class="cover-meta-item">
        <div class="meta-label">Primary VPA Switch</div>
        <div class="meta-value">euonabhijit@okicici</div>
      </div>
    </div>
  </div>

  {body_html}
</div>
</body>
</html>
"""

def main():
    print("Beginning assembly of CLOAK Monograph...")
    full_markdown = assemble_markdown()

    words = len(re.findall(r'\b\w+\b', full_markdown))
    lines = len(full_markdown.splitlines())
    chars = len(full_markdown)

    page_estimate_words = words / 480
    page_estimate_chars = chars / 2600
    estimated_pages = (page_estimate_words + page_estimate_chars) / 2

    print(f"Total Words: {words:,}")
    print(f"Total Characters: {chars:,}")
    print(f"Total Lines: {lines:,}")
    print(f"Estimated Standard Book / A4 Pages: {estimated_pages:.1f} pages")

    md_filename = "CLOAK_Project_2026_by_Abhijit_Kumar.md"
    html_filename = "CLOAK_Project_2026_by_Abhijit_Kumar.html"

    print(f"Writing Markdown to {md_filename}...")
    with open(md_filename, "w", encoding="utf-8") as f:
        f.write(full_markdown)

    print(f"Converting to Publication HTML ({html_filename})...")
    body_html = simple_markdown_to_html(full_markdown)
    full_html = build_full_html(body_html, words, estimated_pages)
    with open(html_filename, "w", encoding="utf-8") as f:
        f.write(full_html)

    print("Master Build Complete! Both Markdown and HTML editions generated.")

if __name__ == "__main__":
    main()
