#!/usr/bin/env python3
"""Static checks of the site pages before they are published.

The script fails (exit code 1) with a clear message if:

* a page (index.html, about.html, 404.html) is missing, has no title, no
  description or a language other than en-GB;
* a page uses a local file with an absolute path (/...), a file that does not
  exist, or a file that is not published (see scripts/site_files.txt);
  the only exception is <base href="/Diospyros-NC-Atlas/"> in 404.html;
* an address on the published site (Open Graph image, canonical address)
  points to a file that does not exist;
* a script or style sheet from another server has no integrity hash or no
  crossorigin attribute;
* a plain email address appears in a page (it must be put together by
  js/site.js, so that spam bots cannot read it);
* a page lacks the Beta badge, the footer version, the link to the About page,
  or js/version.js and js/site.js;
* the version in js/version.js, CITATION.cff and the newest section of
  CHANGELOG.md is not the same;
* scripts/site_files.txt would publish scripts/, docs/ or .github/.

Standard library only; Python 3.9 or newer.

Usage:  python3 scripts/check_site.py
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "about.html", "404.html"]
SITE_URL = "https://amnghn.github.io/Diospyros-NC-Atlas/"
BASE_404 = "/Diospyros-NC-Atlas/"
NEVER_PUBLISHED = ("scripts", "docs", ".github")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SEMVER_RE = r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?"


class Page(HTMLParser):
    """Collects the attributes the checks need from one HTML page."""

    def __init__(self):
        super().__init__()
        self.lang = ""
        self.title = ""
        self.in_title = False
        self.description = ""
        self.base = None
        self.refs = []          # (tag, attribute, value)
        self.external = []      # (tag, url, attrs) for scripts and style sheets on other servers
        self.site_urls = []     # absolute addresses on the published site
        self.classes = set()
        self.data_site = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.classes.update((a.get("class") or "").split())
        if a.get("data-site"):
            self.data_site.add(a["data-site"])
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self.in_title = True
        elif tag == "base":
            self.base = a.get("href")
        elif tag == "meta":
            if a.get("name") == "description":
                self.description = a.get("content", "")
            if a.get("property") in ("og:image", "og:url"):
                self.site_urls.append((a["property"], a.get("content", "")))
        elif tag == "link" and "canonical" in (a.get("rel") or "").split():
            self.site_urls.append(("canonical", a.get("href", "")))
        for attr in ("href", "src"):
            value = a.get(attr)
            if value is None or tag == "base" or (tag == "link" and "canonical" in (a.get("rel") or "")):
                continue
            if re.match(r"^https?://", value):
                is_style = tag == "link" and "stylesheet" in (a.get("rel") or "").split()
                if tag == "script" or is_style:
                    self.external.append((tag, value, a))
            else:
                self.refs.append((tag, attr, value))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def published_paths(problems):
    path = ROOT / "scripts" / "site_files.txt"
    if not path.is_file():
        problems.append("scripts/site_files.txt: file not found")
        return []
    entries = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    entries = [e.rstrip("/") for e in entries if e and not e.startswith("#")]
    for e in entries:
        if e.split("/")[0] in NEVER_PUBLISHED:
            problems.append(f"scripts/site_files.txt: {e} must not be published")
        if not (ROOT / e).exists():
            problems.append(f"scripts/site_files.txt: {e} does not exist")
    return entries


def is_published(relpath, published):
    return any(relpath == p or relpath.startswith(p + "/") for p in published)


def check_local_ref(page_name, tag, attr, value, published, problems):
    if value.startswith(("mailto:", "#", "data:", "javascript:")) or value == "":
        return
    if value.startswith("/") or value.startswith("//"):
        problems.append(f"{page_name}: <{tag} {attr}=\"{value}\"> uses an absolute path; use a relative path")
        return
    path = urlsplit(value).path
    if path in ("", "./", "."):
        path = "index.html"
    elif path.endswith("/"):
        path += "index.html"
    if ".." in Path(path).parts:
        problems.append(f"{page_name}: <{tag} {attr}=\"{value}\"> points outside the site")
        return
    if not (ROOT / path).is_file():
        problems.append(f"{page_name}: <{tag} {attr}=\"{value}\"> points to a file that does not exist")
    elif not is_published(path, published):
        problems.append(f"{page_name}: <{tag} {attr}=\"{value}\"> points to a file that is not published (scripts/site_files.txt)")


def version_of(path, pattern, problems):
    if not path.is_file():
        problems.append(f"{path.relative_to(ROOT)}: file not found")
        return None
    m = re.search(pattern, path.read_text(encoding="utf-8"), re.M)
    if not m:
        problems.append(f"{path.relative_to(ROOT)}: no version found")
        return None
    return m.group(1)


def main():
    problems = []
    published = published_paths(problems)

    for name in PAGES:
        path = ROOT / name
        if not path.is_file():
            problems.append(f"{name}: file not found")
            continue
        text = path.read_text(encoding="utf-8")
        page = Page()
        page.feed(text)

        if not page.title.strip():
            problems.append(f"{name}: no <title>")
        if not page.description.strip():
            problems.append(f"{name}: no <meta name=\"description\">")
        if page.lang != "en-GB":
            problems.append(f"{name}: <html lang> is {page.lang!r}, expected 'en-GB'")
        if page.base is not None and not (name == "404.html" and page.base == BASE_404):
            problems.append(f"{name}: unexpected <base href=\"{page.base}\">")
        if name == "404.html" and page.base != BASE_404:
            problems.append(f"404.html: needs <base href=\"{BASE_404}\"> so that it works at any depth")

        for tag, attr, value in page.refs:
            check_local_ref(name, tag, attr, value, published, problems)
        for prop, url in page.site_urls:
            if not url.startswith(SITE_URL):
                problems.append(f"{name}: {prop} {url!r} does not start with {SITE_URL}")
                continue
            local = url[len(SITE_URL):] or "index.html"
            if not (ROOT / local).is_file() or not is_published(local, published):
                problems.append(f"{name}: {prop} {url!r} points to a file that is not published")
        for tag, url, attrs in page.external:
            if not re.match(r"^sha(256|384|512)-[A-Za-z0-9+/=]+$", attrs.get("integrity") or ""):
                problems.append(f"{name}: <{tag}> from {url} has no integrity hash")
            if "crossorigin" not in attrs:
                problems.append(f"{name}: <{tag}> from {url} has no crossorigin attribute")

        for address in sorted(set(EMAIL_RE.findall(text))):
            problems.append(f"{name}: plain email address {address!r} in the HTML (js/site.js should build it)")

        if "beta-badge" not in page.classes:
            problems.append(f"{name}: no Beta badge (class=\"beta-badge\")")
        if "version" not in page.data_site:
            problems.append(f"{name}: no version in the footer (data-site=\"version\")")
        local_refs = {v for _, _, v in page.refs}
        for needed in ("about.html", "js/version.js", "js/site.js"):
            if needed not in local_refs:
                problems.append(f"{name}: does not use {needed}")

    versions = {
        "js/version.js": version_of(ROOT / "js" / "version.js", rf"version:\s*'({SEMVER_RE})'", problems),
        "CITATION.cff": version_of(ROOT / "CITATION.cff", rf"^version:\s*\"?({SEMVER_RE})\"?\s*$", problems),
        "CHANGELOG.md": version_of(ROOT / "CHANGELOG.md", rf"^## \[({SEMVER_RE})\]", problems),
    }
    if None not in versions.values() and len(set(versions.values())) != 1:
        listed = ", ".join(f"{k}: {v}" for k, v in versions.items())
        problems.append(f"the versions differ ({listed})")

    if problems:
        print(f"Site check FAILED: {len(problems)} problem(s)", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print(f"Site check passed: {len(PAGES)} pages, version {versions['js/version.js']}, "
          f"{len(published)} published paths.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
