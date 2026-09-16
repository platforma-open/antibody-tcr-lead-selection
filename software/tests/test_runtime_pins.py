"""The suite must run the versions the block ships.

Runtime pins live in each package's src/requirements.txt, which is what pl-pkg
builds from. scripts/pytest.sh layers those files into the test environment.
These tests prove that happened, so a green suite means the code was exercised
against the shipped versions and not against whatever the dev group resolved.
"""

import importlib.metadata as metadata
import re
import sys
from collections import defaultdict
from pathlib import Path

import pytest

SOFTWARE = Path(__file__).resolve().parents[1]


def read_pins():
    """Map dependency name -> {package: version} across every requirements.txt."""
    pins = defaultdict(dict)
    for req in sorted(SOFTWARE.glob("*/src/requirements.txt")):
        package = req.parts[-3]
        for line in req.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, sep, version = line.partition("==")
            assert sep, f"{req}: '{line}' is not pinned with =="
            pins[name.strip()][package] = version.strip()
    return pins


PINS = read_pins()


def test_requirements_files_were_found():
    """A glob that silently matches nothing would make every test below vacuous."""
    assert PINS, "no src/requirements.txt found under software/"


def test_no_two_packages_pin_the_same_dependency_differently():
    """One shared test environment cannot hold two versions of one library. If
    this fails, the packages need separate environments, not a bigger one."""
    conflicts = {name: by_package for name, by_package in PINS.items() if len(set(by_package.values())) > 1}

    assert not conflicts, f"conflicting pins across packages: {conflicts}"


@pytest.mark.parametrize("name", sorted(PINS))
def test_installed_version_matches_the_shipped_pin(name):
    pinned = sorted(set(PINS[name].values()))[0]

    try:
        installed = metadata.version(name)
    except metadata.PackageNotFoundError:
        pytest.fail(
            f"{name} is pinned at {pinned} by {sorted(PINS[name])} but is not installed. "
            f"Run the suite with scripts/pytest.sh, which layers in src/requirements.txt."
        )

    assert installed == pinned, f"{name}: shipped pin {pinned}, test environment has {installed}"


def read_runenv_python():
    """The python version the block's software packages declare in package.json."""
    versions = set()
    for manifest in sorted(SOFTWARE.glob("*/package.json")):
        for match in re.finditer(r"runenv-python-3:(\d+)\.(\d+)\.(\d+)", manifest.read_text()):
            versions.add(tuple(int(g) for g in match.groups()))
    return versions


def test_interpreter_matches_the_shipped_runenv():
    """A test passing on 3.13 says nothing about a block that runs on 3.12: the
    wheels differ, and so can the behaviour."""
    declared = read_runenv_python()
    assert declared, "no runenv-python-3 pin found in any software/*/package.json"
    assert len({v[:2] for v in declared}) == 1, f"packages declare different python versions: {declared}"

    shipped = next(iter(declared))
    running = sys.version_info[:2]

    assert running == shipped[:2], (
        f"tests run on python {running[0]}.{running[1]}, the block ships {shipped[0]}.{shipped[1]}"
    )
