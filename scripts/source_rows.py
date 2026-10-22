#!/usr/bin/env python3
"""Extract table rows from a formulary source document (PDF or MassHealth Drug List HTML).

    python3 scripts/source_rows.py <url-or-path> [<url-or-path> ...] [--out-dir data-gathering/rows] [--refresh]

Writes <out-dir>/<sha256>.json (rows) and <out-dir>/index.json ({url: {sha256, fetched_at, rows, layout}}).
Raw bytes are cached under <out-dir>/raw/<sha256>.<ext>; a re-run reuses them (no download) and reuses the
rows file too unless this script changed (signature = sha256 of this file) or --refresh is given.
Layouts are documented in docs/data-audit.md ("Adding a document layout").
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import logging
import re
import site
import subprocess
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable, Optional

sys.path.insert(0, site.getusersitepackages())

LOG = logging.getLogger("source_rows")
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
SCRIPT_SIGNATURE = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]
DEFAULT_OUT = "data-gathering/rows"
FLAG_RE = re.compile(r"(?<![A-Za-z])(PA|ST|QL|SP|AL|AGE|OTC|HCD|MC|NF|DL|LA|HD|LD|MB)(?![A-Za-z])")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def extract_flags(text: str) -> list[str]:
    seen: list[str] = []
    for m in FLAG_RE.finditer(text):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


# ---------------------------------------------------------------- fetch

def fetch(url: str, out_dir: Path, refresh: bool, index: dict[str, Any]) -> tuple[Path, str, str]:
    """Return (raw_path, sha256, fetched_at). Local paths are copied into the cache by hash."""
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    entry = index.get(url)
    if entry and not refresh:
        for cand in raw_dir.glob(entry["sha256"] + ".*"):
            LOG.info("cache hit bytes %s", url)
            return cand, entry["sha256"], entry["fetched_at"]
    if re.match(r"^https?://", url):
        tmp = raw_dir / ".download.tmp"
        cmd = ["curl", "-4", "-sSL", "--max-time", "240", "-A", USER_AGENT, "-w", "%{http_code}", "-o", str(tmp), url]
        res = subprocess.run(cmd, capture_output=True, text=True)
        status = res.stdout.strip()
        if res.returncode != 0 or status != "200":
            raise RuntimeError(f"fetch failed ({status or res.returncode}): {url} {res.stderr.strip()}")
        data = tmp.read_bytes()
        tmp.unlink()
    else:
        data = Path(url).read_bytes()
    sha = sha256_bytes(data)
    ext = "pdf" if data[:5] == b"%PDF-" else ("html" if b"<html" in data[:4096].lower() or b"<!doctype" in data[:200].lower() else "bin")
    path = raw_dir / f"{sha}.{ext}"
    if not path.exists():
        path.write_bytes(data)
    return path, sha, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------- PDF

class PageScan:
    """Text spans (y, x, text) plus horizontal separators (rules and rectangle edges), page coords."""

    def __init__(self) -> None:
        self.spans: list[tuple[float, float, str]] = []
        self.seps: list[float] = []
        # (y, x, text) per text-showing run with the PDF's own column gaps kept as runs of spaces.
        # Needed because the plain text visitor glues "drug  tier  notes" on one baseline into one
        # string, losing the column boundaries.
        self.groups: list[tuple[float, float, str]] = []


def scan_page(page: Any) -> PageScan:
    ps = PageScan()
    state: dict[str, Any] = {"m": None}

    def on_text(t: str, cm: Any, tm: Any, fd: Any, fs: Any) -> None:
        if not t.strip():
            return
        x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
        y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
        ps.spans.append((y, x, t))

    def xf(cm: Any, x: float, y: float) -> tuple[float, float]:
        return cm[0] * x + cm[2] * y + cm[4], cm[1] * x + cm[3] * y + cm[5]

    def on_op(op: bytes, args: Any, cm: Any, tm: Any) -> None:
        try:
            if op == b"m" and len(args) >= 2:
                state["m"] = xf(cm, float(args[0]), float(args[1]))
            elif op == b"l" and len(args) >= 2 and state["m"]:
                x2, y2 = xf(cm, float(args[0]), float(args[1]))
                x1, y1 = state["m"]
                if abs(y1 - y2) < 0.5 and abs(x2 - x1) > 40:
                    ps.seps.append((y1 + y2) / 2)
                state["m"] = (x2, y2)
            elif op == b"re" and len(args) >= 4:
                x, y, w, h = (float(a) for a in args[:4])
                (xa, ya), (xb, yb) = xf(cm, x, y), xf(cm, x + w, y + h)
                if abs(xb - xa) > 40 and 6 < abs(yb - ya) < 400:
                    ps.seps.extend([ya, yb])
        except (TypeError, ValueError):
            LOG.debug("bad operand for %r", op)

    page.extract_text(visitor_text=on_text, visitor_operand_before=on_op)
    ps.seps = dedupe_sorted(ps.seps)
    ps.groups = layout_groups(page, ps)
    return ps


def layout_groups(page: Any, ps: PageScan) -> list[tuple[float, float, str]]:
    """Per-run (y, abs_x, text) from pypdf's layout-mode internals (pinned: pypdf 6.x; see docs)."""
    from pypdf.generic import ContentStream  # type: ignore
    from pypdf._text_extraction import _layout_mode as lm  # type: ignore

    fonts = page._layout_mode_fonts()
    ops = iter(ContentStream(page["/Contents"].get_object(), page.pdf, "bytes").operations)
    bts = lm.text_show_operations(ops, fonts)
    if not bts:
        return []
    # text_show_operations left-aligns x (subtracts the page's min x); restore it from the min visitor x.
    shift = min(x for _y, x, _t in ps.spans) - min(b["tx"] for b in bts) if ps.spans else 0.0
    return [(b["ty"], b["tx"] + shift, b["text"]) for b in bts if b["text"].strip()]


def dedupe_sorted(vals: list[float], tol: float = 1.0) -> list[float]:
    out: list[float] = []
    for v in sorted(vals, reverse=True):
        if not out or abs(out[-1] - v) > tol:
            out.append(v)
    return out


def detect_layout(ps: PageScan) -> Optional[tuple[str, float]]:
    """Return (layout, header_y) from header words, or None for non-table pages."""
    for y, _x, t in ps.spans:
        s = norm_space(t)
        if re.match(r"^DRUG NAME TIER LIMITATIONS", s, re.I) and s.isupper():
            return "optum", y
        if s.startswith("Drug Reference Status Notes"):
            return "mgb", y
    names = {norm_space(t): (y, x) for y, x, t in ps.spans}
    if "Drug Tier" in names and "Requirements/Limits" in names:
        return "bcbs", names["Drug Tier"][0]
    return None


def groups_by_row(ps: PageScan, header_y: float) -> list[list[tuple[float, float, str]]]:
    """Group layout runs into table rows using separator intervals below the header.

    Side cells are vertically centred against multi-line drug cells, so y-nearest guessing is
    unreliable; only rules / rectangle edges are trusted as row boundaries.
    """
    below = [s for s in ps.seps if s < header_y - 2]
    rows = []
    for hi, lo in zip(below, below[1:]):
        if hi - lo < 4:
            continue
        inside = [g for g in ps.groups if lo - 0.5 <= g[0] < hi + 0.5 and g[0] < header_y - 2]
        if inside:
            rows.append(inside)
    return rows


TIER_CELL_RE = re.compile(r"^(?:[1-6]|\$0|MD)$")
MGB_STATUS_INLINE_RE = re.compile(r"(?<!\S)(?:Tier [1-9]|\$0|MC|NF)(?!\S)")
MGB_STATUS_CELL_RE = re.compile(r"^(?:Tier [1-9]|MC|NF|Non-Formulary|Excluded|\$0)$")


def parse_row_groups(groups: list[tuple[float, float, str]], status_re: re.Pattern, right_min: float,
                     status_zone: Optional[tuple[float, float]], keep_ref: bool,
                     status_inline: Optional[re.Pattern] = None) -> dict[str, Any]:
    """Split one row's runs into drug / reference / status(tier) / notes.

    A run's cells are separated by 3+ spaces (the PDF's own column gaps). Runs starting left of
    `right_min` carry a drug piece first; the first cell matching `status_re` (in a left run, or a
    run inside `status_zone`) is the tier/status; everything after it is notes.
    """
    drug: list[str] = []
    ref: list[str] = []
    notes: list[str] = []
    status: Optional[str] = None
    for ty, tx, text in sorted(groups, key=lambda g: (-round(g[0]), g[1])):
        cells = [c.strip() for c in re.split(r"\s{3,}", text.strip()) if c.strip()]
        if not cells:
            continue
        left = tx < right_min
        start = 0
        if left:
            drug.append(cells[0])
            start = 1
        # MGB: the reference (brand) cell can sit in a run of its own, before the status cell
        pre_ref = 0
        if keep_ref and status is None and not left and status_inline is not None:
            for ci, c in enumerate(cells):
                if status_re.match(c) or status_inline.search(c):
                    pre_ref = ci
                    break
        for ci, c in enumerate(cells[start:], start=start):
            if ci < pre_ref:
                ref.append(c)
                continue
            zone_ok = left or status_zone is None or status_zone[0] <= tx < status_zone[1]
            m_in = status_inline.search(c) if (status_inline and status is None) else None
            if status is None and zone_ok and (left or ci == 0) and status_re.match(c):
                status = c
            elif m_in:
                # status glued to a long reference cell (gap < 3 spaces): "Wellbutrin SR Tier 1"
                before, after = c[:m_in.start()].strip(), c[m_in.end():].strip()
                if before:
                    ref.append(before)
                status = m_in.group(0)
                if after:
                    notes.append(after)
            elif status is None and left and keep_ref:
                ref.append(c)
            else:
                notes.append(c)
    return {"drug": norm_space(" ".join(drug)), "reference": norm_space(" ".join(ref)) or None,
            "status": status, "notes": norm_space(" ".join(notes))}


def parse_row(groups: list[tuple[float, float, str]], layout: str) -> dict[str, Any]:
    if layout == "optum":
        r = parse_row_groups(groups, TIER_CELL_RE, 100, (305, 384), keep_ref=False)
    else:
        r = parse_row_groups(groups, MGB_STATUS_CELL_RE, 100, (362, 460), keep_ref=True,
                             status_inline=MGB_STATUS_INLINE_RE)
    tier = r["status"]
    if tier and tier.startswith("Tier "):
        tier = tier[5:]
    out = {"drug": r["drug"], "tier": tier, "notes": r["notes"], "flags": extract_flags(r["notes"])}
    if r["reference"]:
        out["reference"] = r["reference"]
    return out


BCBS_LABEL_RE = re.compile(r"^(G\s*e\s*n\s*e\s*r\s*i\s*c|B\s*r\s*a\s*n\s*d)\s*d\s*r\s*u\s*g", re.I)


def parse_bcbs_page(ps: PageScan, header_y: float) -> list[dict[str, Any]]:
    hdr = {norm_space(t): x for y, x, t in ps.spans if abs(y - header_y) < 3}
    tier_lo = hdr.get("Drug Tier", 341) - 15
    req_lo = hdr.get("Requirements/Limits", 410) - 8
    body = sorted([s for s in ps.spans if 70 < s[0] < header_y - 3], key=lambda s: -s[0])
    rows: list[dict[str, Any]] = []
    cur: Optional[dict[str, Any]] = None
    section = ""
    for y, x, t in body:
        txt = norm_space(t)
        if BCBS_LABEL_RE.match(txt):
            cur = {"label": "generic" if re.match(r"^g", txt, re.I) else "brand", "y": y,
                   "drug": [], "tier": [], "req": [], "section": section}
            rows.append(cur)
            continue
        if x < 95:  # category heading (drug rows start at x=100); ends the current row
            section = txt
            cur = None
            continue
        if cur is None:
            continue
        if x >= req_lo:
            cur["req"].append(txt)
        elif x >= tier_lo:
            cur["tier"].append(txt)
        else:
            cur["drug"].append(txt)
    out = []
    for r in rows:
        notes = norm_space(" ".join(r["req"]))
        out.append({
            "drug": norm_space(" ".join(r["drug"])),
            "tier": norm_space(" ".join(r["tier"])) or None,
            "notes": notes,
            "flags": extract_flags(notes),
            "section": r["section"],
            "label": r["label"],
        })
    return out


def extract_pdf(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(str(path))
    rows: list[dict[str, Any]] = []
    layouts: dict[str, int] = {}
    section = ""
    stats = {"pages": len(reader.pages), "table_pages": 0, "skipped_pages": []}
    for pn, page in enumerate(reader.pages, start=1):
        try:
            ps = scan_page(page)
            det = detect_layout(ps)
            if not det:
                stats["skipped_pages"].append(pn)
                continue
            layout, hy = det
            layouts[layout] = layouts.get(layout, 0) + 1
            stats["table_pages"] += 1
            page_rows: list[dict[str, Any]] = []
            if layout == "bcbs":
                for r in parse_bcbs_page(ps, hy):
                    r["raw"] = norm_space(f"{r['drug']} | tier {r['tier']} | {r['notes']}")
                    page_rows.append(r)
            else:
                for grp in groups_by_row(ps, hy):
                    r = parse_row(grp, layout)
                    r["raw"] = norm_space(" || ".join(t for _y, _x, t in sorted(grp, key=lambda g: (-round(g[0]), g[1]))))
                    if r["tier"] is None and not r["notes"]:
                        # heading row (class name) or a status-less line: remember it as the section
                        section = r["drug"]
                        continue
                    r["section"] = section
                    page_rows.append(r)
                if not page_rows:
                    LOG.warning("page %d: header found but no rows (layout %s)", pn, layout)
                    stats.setdefault("pages_without_rows", []).append(pn)
            for r in page_rows:
                r["page"] = pn
            rows.extend(page_rows)
        except Exception as exc:  # per-page isolation (CLAUDE.md: never let one item crash the pipeline)
            LOG.error("page %d failed: %s", pn, exc)
            stats.setdefault("failed_pages", []).append(pn)
    stats["layouts"] = layouts
    return rows, stats


# ---------------------------------------------------------------- MassHealth HTML

VOID_TAGS = {"br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "wbr"}


class MhdlParser(HTMLParser):
    """Rows from MHDL pubtheradetail.do (a1..aN header ids) and pubdruglist.do (headers="Drug"/"Class").

    convert_charrefs=True decodes entities. A bare "<" followed by a space or digit is passed to
    handle_data by html.parser, so "PA - < 6 years" keeps its text (a prior regex parser dropped it).
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict[str, Any]] = []
        self.th_names: dict[str, str] = {}
        self.cells: dict[str, str] = {}
        self.cell_key: Optional[str] = None
        self.cell_buf: list[str] = []
        self.cell_idx = 0
        self.th_id: Optional[str] = None
        self.th_buf: list[str] = []
        self.heading_buf: Optional[list[str]] = None
        self.heading_for: Optional[str] = None
        self.klass = ""
        self.page_title = ""
        self.page_text: list[str] = []
        self.skip_depth = 0
        self.stack: list[tuple[str, bool]] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        a = dict(attrs)
        if tag not in VOID_TAGS:
            hid = bool(re.search(r"display\s*:\s*none", a.get("style") or "", re.I))
            self.stack.append((tag, hid))
            self.hidden += hid
        if tag == "script" or tag == "style":
            self.skip_depth += 1
        elif tag == "tr":
            self.cells = {}
            self.cell_idx = 0
        elif tag == "th":
            self.th_id = a.get("id")
            self.th_buf = []
        elif tag == "td":
            self.cell_idx += 1
            self.cell_key = a.get("headers") or f"c{self.cell_idx}"
            if self.cell_key == "Class":
                self.cell_key = f"Class{self.cell_idx}"
            self.cell_buf = []
        elif tag == "h2" and a.get("id") == "maincontent":
            self.heading_buf = []
        elif tag == "br" and self.cell_key is not None:
            self.cell_buf.append(" ")

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self.stack) - 1, -1, -1):  # tolerate unclosed <p>/<li>: pop to the match
            if self.stack[i][0] == tag:
                self.hidden -= sum(h for _t, h in self.stack[i:])
                del self.stack[i:]
                break
        if tag in ("script", "style"):
            self.skip_depth = max(0, self.skip_depth - 1)
        elif tag == "h2" and self.heading_buf is not None:
            self.page_title = norm_space("".join(self.heading_buf))
            self.heading_buf = None
        elif tag == "th":
            text = norm_space("".join(self.th_buf))
            if self.th_id:
                self.th_names[self.th_id] = text
                if self.th_id == "h1":
                    self.klass = text
            self.th_id = None
        elif tag == "td" and self.cell_key is not None:
            self.cells[self.cell_key] = norm_space("".join(self.cell_buf))
            self.cell_key = None
        elif tag == "tr":
            self._emit()

    def handle_data(self, data: str) -> None:
        if self.skip_depth or self.hidden:  # display:none spans carry markers like "test" / "drugId:138"
            return
        if self.heading_buf is not None:
            self.heading_buf.append(data)
        if self.th_id is not None:
            self.th_buf.append(data)
        if self.cell_key is not None:
            self.cell_buf.append(data)
        self.page_text.append(data)

    def handle_comment(self, data: str) -> None:  # comments (incl. commented-out markup) carry no cell text
        return

    def _emit(self) -> None:
        c = self.cells
        if not c:
            return
        if "Drug" in c:  # pubdruglist.do: Drug | PA status | Class | notes
            vals = [v for k, v in c.items() if k.startswith("Class")]
            self.rows.append({
                "drug": re.sub(r"drugId:\d+", "", c["Drug"]).strip(),
                "brand": None,
                "pa": vals[0] if vals else "",
                "class": vals[1] if len(vals) > 1 else "",
                "notes": vals[2] if len(vals) > 2 else "",
            })
        else:
            named = {self.th_names.get(k, k).lower(): v for k, v in c.items() if k.startswith("a")}
            generic = next((v for k, v in named.items() if "generic" in k), None)
            if generic is None:
                return
            self.rows.append({
                "drug": generic,
                "brand": next((v for k, v in named.items() if "brand" in k), "") or None,
                "pa": next((v for k, v in named.items() if k.startswith("pa")), ""),
                "class": self.klass,
                "notes": next((v for k, v in named.items() if k.startswith("drug") and "note" in k), ""),
            })
        self.cells = {}


def extract_mhdl_html(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    text = path.read_bytes().decode("utf-8", errors="replace")
    p = MhdlParser()
    p.feed(text)
    p.close()
    m = re.match(r"^(Table \d+): (.+)$", p.page_title)
    table = p.page_title if m else "A-Z drug list"
    rows = []
    for r in p.rows:
        pa = r["pa"]
        row = {
            "table": table,
            "drug": r["drug"],
            "brand": r["brand"],
            "class": r["class"],
            "pa": pa,
            "notes": r["notes"],
            "flags": ["PA"] if re.search(r"\bPA\b", pa) else [],
        }
        row["raw"] = norm_space(f"{r['drug']} | {r['brand'] or ''} | PA: {pa} | {r['notes']}")
        rows.append(row)
    return rows, {"layouts": {"mhdl": 1}, "table": table}


# ---------------------------------------------------------------- driver

def process(url: str, out_dir: Path, refresh: bool, index: dict[str, Any]) -> None:
    path, sha, fetched_at = fetch(url, out_dir, refresh, index)
    rows_file = out_dir / f"{sha}.json"
    if rows_file.exists() and not refresh:
        prev = json.loads(rows_file.read_text())
        if prev.get("script_signature") == SCRIPT_SIGNATURE:
            LOG.info("cache hit rows %s (%d rows)", url, len(prev["rows"]))
            index[url] = {"sha256": sha, "fetched_at": fetched_at, "rows": len(prev["rows"]), "layout": prev["layout"]}
            return
    data = path.read_bytes()
    if data[:5] == b"%PDF-":
        rows, stats = extract_pdf(path)
    elif b"<html" in data[:4096].lower() or b"<!doctype" in data[:200].lower():
        rows, stats = extract_mhdl_html(path)
    else:
        rows, stats = [], {"layouts": {}, "note": "unsupported content type"}
    layout = ",".join(sorted(stats.get("layouts", {}))) or "none"
    out = {"url": url, "sha256": sha, "fetched_at": fetched_at, "script_signature": SCRIPT_SIGNATURE,
           "layout": layout, "stats": stats, "rows": rows}
    rows_file.write_text(json.dumps(out, indent=0, ensure_ascii=False))
    index[url] = {"sha256": sha, "fetched_at": fetched_at, "rows": len(rows), "layout": layout}
    LOG.info("extracted %s: %d rows, layout=%s", url, len(rows), layout)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--out-dir", default=DEFAULT_OUT)
    ap.add_argument("--refresh", action="store_true", help="re-download and re-extract")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    idx_path = out_dir / "index.json"
    index: dict[str, Any] = json.loads(idx_path.read_text()) if idx_path.exists() else {}
    failed = 0
    for src in args.sources:
        try:
            process(src, out_dir, args.refresh, index)
        except Exception as exc:
            failed += 1
            LOG.error("FAILED %s: %s", src, exc)
        idx_path.write_text(json.dumps(index, indent=1, sort_keys=True))
    print(f"✓ {len(args.sources) - failed} done · ✗ {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
