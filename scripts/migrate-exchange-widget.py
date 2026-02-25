#!/usr/bin/env python3
"""
Bulk-migrate content files:
1. Strip `currency="..."` from <Hero> tags (all files)
2. Insert <ExchangeWidget> inline for send-to and corridor pages
"""

import re
import os
from pathlib import Path

CONTENT_DIR = Path(__file__).parent.parent / "src" / "content" / "content"

# Map origin country slug to ISO 4217 currency code (for corridor sourceCurrency)
ORIGIN_CURRENCY = {
    "italy": "EUR",
    "france": "EUR",
    "spain": "EUR",
    "germany": "EUR",
    "portugal": "EUR",
    "united-kingdom": "GBP",
    "united-states": "USD",
    "brazil": "BRL",
    "argentina": "ARS",
    "australia": "AUD",
    "canada": "CAD",
    "japan": "JPY",
    "mexico": "MXN",
    "colombia": "COP",
    "singapore": "SGD",
}

def extract_currency(content: str) -> str | None:
    """Extract currency code from Hero tag."""
    m = re.search(r'currency="([A-Z]{3})"', content)
    return m.group(1) if m else None


def strip_currency_from_hero(content: str) -> str:
    """Remove currency="..." prop from <Hero> tag."""
    return re.sub(r'\s+currency="[A-Z]{3}"', '', content)


def has_exchange_widget(content: str) -> bool:
    """Check if file already has an ExchangeWidget."""
    return '<ExchangeWidget' in content


def get_page_type(filepath: Path) -> str:
    """Determine page type from file path."""
    rel = filepath.relative_to(CONTENT_DIR)
    parts = rel.parts

    if parts[0] == "send-to" and "from" in parts:
        return "corridor"
    elif parts[0] == "send-to":
        return "send-to"
    elif parts[0] == "countries":
        return "hub"
    elif parts[0] == "pay-with":
        return "pay-with"
    return "other"


def get_corridor_origin(filepath: Path) -> str | None:
    """Extract origin country slug from corridor path."""
    rel = filepath.relative_to(CONTENT_DIR)
    parts = rel.parts
    # send-to/{dest}/from/{origin}/{lang}.md
    try:
        from_idx = parts.index("from")
        return parts[from_idx + 1]
    except (ValueError, IndexError):
        return None


def build_widget_tag(dest_currency: str, source_currency: str | None = None) -> str:
    """Build the ExchangeWidget MDX tag."""
    if source_currency and source_currency != "USD":
        return f'<ExchangeWidget destinationCurrency="{dest_currency}" sourceCurrency="{source_currency}" />'
    return f'<ExchangeWidget destinationCurrency="{dest_currency}" />'


def insert_widget_send_to(content: str, widget_tag: str) -> str:
    """Insert widget before <Steps in send-to pages."""
    # Insert before <Steps
    m = re.search(r'\n<Steps ', content)
    if m:
        insert_pos = m.start()
        return content[:insert_pos] + f"\n\n{widget_tag}\n" + content[insert_pos:]

    # Fallback: insert before inline CTA
    m = re.search(r'\n<CTA .+variant="secondary"', content)
    if m:
        insert_pos = m.start()
        return content[:insert_pos] + f"\n\n{widget_tag}\n" + content[insert_pos:]

    print(f"  WARNING: No insertion point found")
    return content


def insert_widget_corridor(content: str, widget_tag: str) -> str:
    """Insert widget before inline CTA in corridor pages."""
    # Insert before inline CTA (variant="secondary")
    m = re.search(r'\n<CTA .+variant="secondary"', content)
    if m:
        insert_pos = m.start()
        return content[:insert_pos] + f"\n\n{widget_tag}\n" + content[insert_pos:]

    # Fallback: insert before <Steps
    m = re.search(r'\n<Steps ', content)
    if m:
        insert_pos = m.start()
        return content[:insert_pos] + f"\n\n{widget_tag}\n" + content[insert_pos:]

    print(f"  WARNING: No insertion point found")
    return content


def process_file(filepath: Path) -> bool:
    """Process a single content file. Returns True if modified."""
    content = filepath.read_text(encoding="utf-8")

    currency = extract_currency(content)
    if not currency:
        return False

    page_type = get_page_type(filepath)
    modified = False

    # Step 1: Always strip currency from Hero
    new_content = strip_currency_from_hero(content)
    if new_content != content:
        modified = True
        content = new_content

    # Step 2: Add ExchangeWidget for eligible page types
    if page_type in ("send-to", "corridor") and not has_exchange_widget(content):
        source_currency = None
        if page_type == "corridor":
            origin = get_corridor_origin(filepath)
            if origin:
                source_currency = ORIGIN_CURRENCY.get(origin)

        widget_tag = build_widget_tag(currency, source_currency)

        if page_type == "send-to":
            new_content = insert_widget_send_to(content, widget_tag)
        else:
            new_content = insert_widget_corridor(content, widget_tag)

        if new_content != content:
            modified = True
            content = new_content

    if modified:
        filepath.write_text(content, encoding="utf-8")

    return modified


def main():
    stats = {"stripped": 0, "widget_added": 0, "skipped": 0, "errors": 0}

    for md_file in sorted(CONTENT_DIR.rglob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        if 'currency="' not in content:
            continue

        rel = md_file.relative_to(CONTENT_DIR)
        page_type = get_page_type(md_file)
        currency = extract_currency(content)

        try:
            had_widget = has_exchange_widget(content)
            modified = process_file(md_file)

            if modified:
                new_content = md_file.read_text(encoding="utf-8")
                widget_added = not had_widget and has_exchange_widget(new_content)

                stats["stripped"] += 1
                if widget_added:
                    stats["widget_added"] += 1
                    print(f"  ✓ {rel} [{page_type}] — stripped currency={currency}, added ExchangeWidget")
                else:
                    print(f"  ✓ {rel} [{page_type}] — stripped currency={currency}")
            else:
                stats["skipped"] += 1
                print(f"  · {rel} [{page_type}] — skipped (no currency= found)")
        except Exception as e:
            stats["errors"] += 1
            print(f"  ✗ {rel} — ERROR: {e}")

    print(f"\nDone:")
    print(f"  Stripped currency=: {stats['stripped']}")
    print(f"  Added ExchangeWidget: {stats['widget_added']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"  Errors: {stats['errors']}")


if __name__ == "__main__":
    main()
