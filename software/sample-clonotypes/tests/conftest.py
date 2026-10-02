"""Put this package's src/ on sys.path.

pytest collects from software/, so the tests cannot rely on a single pythonpath
setting: every package has its own src/main.py. Each package's tests carry their
own conftest and add only their own src/.
"""

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
