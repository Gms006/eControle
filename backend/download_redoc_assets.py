#!/usr/bin/env python
"""
Script para fazer download dos assets do ReDoc para self-hosting.
Uso: python download_redoc_assets.py
"""

import urllib.request
import shutil
from pathlib import Path


def download_redoc_assets():
    """Download ReDoc standalone bundle para self-hosting."""
    
    redoc_version = "2.1.5"  # Versão estável, não usar @next
    redoc_url = f"https://cdn.jsdelivr.net/npm/redoc@{redoc_version}/bundles/redoc.standalone.js"
    
    # Diretório de destination
    static_dir = Path(__file__).parent / "app" / "static" / "redoc"
    static_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = static_dir / "redoc.standalone.js"
    
    print(f"Downloading ReDoc {redoc_version} from {redoc_url}")
    print(f"Saving to {output_file}")
    
    try:
        urllib.request.urlretrieve(redoc_url, output_file)
        file_size = output_file.stat().st_size / 1024 / 1024  # Convert to MB
        print(f"✓ Successfully downloaded ReDoc ({file_size:.2f} MB)")
        print(f"✓ Assets are now self-hosted at {static_dir}")
        return True
    except Exception as e:
        print(f"✗ Error downloading ReDoc: {e}")
        return False


if __name__ == "__main__":
    download_redoc_assets()
