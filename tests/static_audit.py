from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

import tinycss2
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise AssertionError(message)


def walk_files(directory: Path, suffix: str):
    return [p for p in directory.rglob(f"*{suffix}") if p.is_file()]


def check_html(path: Path) -> None:
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")

    ids = {}
    for tag in soup.find_all(attrs={"id": True}):
        key = tag["id"]
        ids[key] = ids.get(key, 0) + 1
    duplicates = sorted(key for key, count in ids.items() if count > 1)
    if duplicates:
        fail(f"{path}: duplicate ids: {duplicates}")

    for attr in ("aria-controls", "aria-labelledby", "aria-describedby"):
        for tag in soup.find_all(attrs={attr: True}):
            for ref in str(tag.get(attr, "")).split():
                if ref not in ids:
                    fail(f"{path}: {attr} references missing id: {ref}")

    for dialog in soup.find_all("dialog"):
        labelled_by = dialog.get("aria-labelledby")
        if labelled_by and soup.find(id=labelled_by) is None:
            fail(f"{path}: dialog references missing title id: {labelled_by}")

    # Inline event handlers make maintenance and CSP harder.
    inline_handlers = [tag.name for tag in soup.find_all() if any(attr.lower().startswith("on") for attr in tag.attrs)]
    if inline_handlers:
        fail(f"{path}: inline event handlers found: {inline_handlers[:10]}")

    mains = [tag for tag in soup.find_all("main") if not tag.has_attr("hidden")]
    if path.name == "index.html" and len(mains) != 1:
        fail(f"{path}: expected exactly one visible main element, found {len(mains)}")

    interactive = {"a", "button", "input", "select", "textarea", "summary"}
    for tag in soup.find_all(interactive):
        parent = tag.parent
        while parent and getattr(parent, "name", None) not in {"html", "body"}:
            if getattr(parent, "name", None) in interactive:
                fail(f"{path}: nested interactive content: <{tag.name}> inside <{parent.name}>")
            parent = parent.parent

    for form in soup.find_all("form"):
        for control in form.find_all(["input", "select", "textarea"]):
            if control.get("type") == "hidden" or control.has_attr("disabled"):
                continue
            control_id = control.get("id")
            labelled = control_id and soup.find("label", attrs={"for": control_id})
            aria_label = control.get("aria-label") or control.get("aria-labelledby")
            if not labelled and not aria_label:
                fail(f"{path}: form control is not labelled: {control.get('id') or control.name}")

    for image in soup.find_all("img"):
        if not image.has_attr("alt"):
            fail(f"{path}: image without alt attribute")

    # Check local href/src references.
    for tag in soup.find_all(attrs={"src": True}):
        ref = tag.get("src", "").split("?", 1)[0]
        if not ref or ref.startswith(("http:", "https:", "data:", "//")):
            continue
        target = (path.parent / ref).resolve()
        if not target.is_file():
            fail(f"{path}: missing src target: {ref}")
    for tag in soup.find_all(attrs={"href": True}):
        ref = tag.get("href", "").split("?", 1)[0]
        if not ref or ref.startswith(("#", "http:", "https:", "data:", "mailto:", "//")):
            continue
        target = (path.parent / ref).resolve()
        if not target.is_file():
            fail(f"{path}: missing href target: {ref}")


def check_css() -> None:
    css_path = ROOT / "css" / "style.css"
    css = css_path.read_text(encoding="utf-8")
    if "$" in css:
        fail("Compiled CSS still contains SCSS variables.")
    rules = tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True)
    if any(rule.type == "error" for rule in rules):
        fail("Compiled CSS has parser errors.")
    for rule in rules:
        if rule.type != "qualified-rule":
            continue
        declarations = tinycss2.parse_declaration_list(rule.content, skip_whitespace=True, skip_comments=True)
        if any(declaration.type == "error" for declaration in declarations):
            fail(f"Compiled CSS has a declaration parser error in selector: {tinycss2.serialize(rule.prelude).strip()}")

    scss = (ROOT / "scss" / "style.scss").read_text(encoding="utf-8")
    variables = dict(re.findall(r"^\$([\w-]+):\s*(.*?);\s*$", scss, re.M))
    generated = "\n".join(line for line in scss.splitlines() if not re.match(r'^\$[\w-]+:\s*.*;\s*$', line.strip()))
    for name, value in sorted(variables.items(), key=lambda item: -len(item[0])):
        generated = generated.replace(f"${name}", value)
    if generated.strip() != css.strip():
        fail("css/style.css is out of sync with scss/style.scss.")


def check_scss() -> None:
    scss = (ROOT / "scss" / "style.scss").read_text(encoding="utf-8")
    depth = 0
    for line in scss.splitlines():
        depth += line.count("{") - line.count("}")
        if depth < 0:
            fail("SCSS has an unmatched closing brace.")
    if depth != 0:
        fail("SCSS has unmatched braces.")


def check_js_imports() -> None:
    import_re = re.compile(r"(?:from\s+|import\s*\()(['\"])([^'\"]+)\1")
    for path in walk_files(ROOT / "scripts", ".js") + walk_files(ROOT / "tests", ".mjs"):
        text = path.read_text(encoding="utf-8")
        for _, ref in import_re.findall(text):
            if not ref.startswith("."):
                continue
            target = (path.parent / ref).resolve()
            if target.suffix == "":
                target = target.with_suffix(".js")
            if not target.is_file():
                fail(f"{path}: unresolved local import {ref}")


def check_json_files() -> None:
    for path in [ROOT / "package.json"]:
        json.loads(path.read_text(encoding="utf-8"))


def check_svg() -> None:
    ElementTree.parse(ROOT / "assets" / "images" / "favicon.svg")


def check_asset_placement() -> None:
    image_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg"}
    font_exts = {".woff", ".woff2", ".ttf", ".otf", ".eot"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        suffix = path.suffix.lower()
        if suffix in image_exts and "assets/images" not in str(path.relative_to(ROOT).parent).replace("\\", "/") and path.name != "favicon.svg":
            fail(f"Image asset is outside assets/images: {path.relative_to(ROOT)}")
        if suffix in font_exts and "assets/fonts" not in str(path.relative_to(ROOT).parent).replace("\\", "/"):
            fail(f"Font asset is outside assets/fonts: {path.relative_to(ROOT)}")


def check_release_tree() -> None:
    forbidden_names = {
        "valtrain.db", "valtrain-source-backup.json", "valtrain-supabase-migration-2026-09-19.json",
    }
    for path in ROOT.rglob("*"):
        if path.is_file() and (path.name in forbidden_names or path.suffix in {".pyc", ".pyo"} or "__pycache__" in path.parts):
            fail(f"Private/build artifact left in release tree: {path.relative_to(ROOT)}")
    root_files = {p.name for p in ROOT.iterdir() if p.is_file()}
    if "favicon.svg" in root_files or "supabase.sql" in root_files:
        fail("Static/legacy assets are still at the project root.")


def main() -> int:
    check_html(ROOT / "index.html")
    for html in walk_files(ROOT / "tools", ".html"):
        check_html(html)
    check_css()
    check_scss()
    check_js_imports()
    check_json_files()
    check_svg()
    check_asset_placement()
    check_release_tree()
    print("Static audit: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"Static audit: FAILED — {exc}")
        raise SystemExit(1)

    assert 'step="any"' in html
