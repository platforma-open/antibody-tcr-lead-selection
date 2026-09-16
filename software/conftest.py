"""Record coverage from the subprocesses the CLI tests start.

pytest-cov ships a .pth that calls coverage.process_startup() in every
interpreter, but that call does nothing unless COVERAGE_PROCESS_START names a
config file. Without it the CLI tests run main.py and filter.py in a subprocess
whose lines are never counted, and both files read about 25 points lower than
they are.

Set only when the run asked for coverage. Otherwise every subprocess would
start coverage and leave .coverage.* files behind.
"""

import os
from pathlib import Path


def pytest_configure(config):
    if config.getoption("--cov", default=None):
        os.environ["COVERAGE_PROCESS_START"] = str(Path(__file__).parent / "pyproject.toml")
