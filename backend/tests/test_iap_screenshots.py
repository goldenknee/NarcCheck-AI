"""IAP review screenshot verification for App Store Connect submission.

Verifies:
- 4 required files exist at correct pixel dimensions
- Each file is non-trivial in size (> 100 KB)
- README.md documents both product ids
- OCR extracts intended final prices ($8.99 monthly / $60 annual) and does NOT
  contain the old prices ($79.99 / $9.99)
"""
import os
import re
import pytest
from PIL import Image
import pytesseract

IAP_DIR = "/app/store_screenshots/iap"

# (filename, expected_size, expected_price_token_substrings, forbidden_tokens)
SCREENSHOT_SPECS = [
    ("annual_6.7_1290x2796.png",  (1290, 2796), ["60"],        ["79.99"]),
    ("monthly_6.7_1290x2796.png", (1290, 2796), ["8.99"],      ["9.99"]),
    ("annual_6.5_1242x2688.png",  (1242, 2688), ["60"],        ["79.99"]),
    ("monthly_6.5_1242x2688.png", (1242, 2688), ["8.99"],      ["9.99"]),
]


@pytest.mark.parametrize("fname,expected_size,expected,forbidden", SCREENSHOT_SPECS)
def test_screenshot_exists_and_dimensions(fname, expected_size, expected, forbidden):
    path = os.path.join(IAP_DIR, fname)
    assert os.path.isfile(path), f"Screenshot missing: {path}"
    size_bytes = os.path.getsize(path)
    assert size_bytes > 100 * 1024, f"{fname} suspiciously small ({size_bytes} bytes)"
    with Image.open(path) as im:
        assert im.size == expected_size, f"{fname} is {im.size}, expected {expected_size}"


@pytest.mark.parametrize("fname,expected_size,expected,forbidden", SCREENSHOT_SPECS)
def test_screenshot_price_ocr(fname, expected_size, expected, forbidden):
    path = os.path.join(IAP_DIR, fname)
    with Image.open(path) as im:
        text = pytesseract.image_to_string(im)
    norm = text.replace(",", "").replace(" ", "")
    # Must contain intended final price
    for token in expected:
        assert token in norm, (
            f"{fname}: expected token {token!r} not found by OCR.\n"
            f"---OCR TEXT---\n{text}\n--------------"
        )
    # Must NOT contain the old prices
    for bad in forbidden:
        assert bad not in norm, (
            f"{fname}: forbidden old-price token {bad!r} STILL appears.\n"
            f"---OCR TEXT---\n{text}\n--------------"
        )


def test_readme_exists_and_mentions_product_ids():
    path = os.path.join(IAP_DIR, "README.md")
    assert os.path.isfile(path), "README.md missing in iap/"
    body = open(path).read()
    assert "com.emergent.narcanalyzer.cslz18.pro.annual" in body
    assert "com.emergent.narcanalyzer.cslz18.pro.monthly" in body


def test_paywall_source_uses_dynamic_price():
    """Regression: paywall must render RC-provided priceString, no hardcoded fallback."""
    src = open("/app/frontend/app/paywall.tsx").read()
    assert "annual.product.priceString" in src
    assert "monthly.product.priceString" in src
    # No hardcoded fallback like $79.99 / $60 / $8.99 in the source
    for bad in ["$79.99", "$9.99", "$8.99", "$60.00", "$60 "]:
        assert bad not in src, f"paywall.tsx should not hardcode price {bad!r}"
    # No fallback pattern like priceString || "$..."
    assert not re.search(r"priceString\s*\|\|\s*['\"]\$", src), \
        "paywall.tsx must not have a hardcoded priceString fallback"
