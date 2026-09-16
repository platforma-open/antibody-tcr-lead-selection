"""The suite must run the versions and the interpreter the block ships.

pyproject.toml holds one dependency group per software package. Each
<package>/src/requirements.txt is generated from its group by
scripts/deps-export.sh, and pl-pkg builds the shipped environment from that
file. These tests prove the environment the suite runs in matches it, so a
green suite means the code was exercised against what the block actually runs.

The requirements-sync CI job covers the other direction: pyproject -> generated
file.
"""

import importlib.metadata as metadata
import re
import sys
from collections import defaultdict
from pathlib import Path

import pytest

SOFTWARE = Path(__file__).resolve().parents[1]


def parse_requirements():
    """Return (pins, malformed).

    pins maps dependency name -> {package: version}. malformed collects lines
    that are not exact pins, so a bad line surfaces as a test failure rather
    than an error while pytest is still collecting.
    """
    pins = defaultdict(dict)
    malformed = []
    for requirements in sorted(SOFTWARE.glob("*/src/requirements.txt")):
        package = requirements.parts[-3]
        for line in requirements.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, separator, version = line.partition("==")
            if not separator or not version:
                malformed.append(f"{requirements}: {line}")
                continue
            pins[name.strip()][package] = version.strip()
    return dict(pins), malformed


PINS, MALFORMED = parse_requirements()


def test_requirements_files_were_found():
    """A glob that silently matches nothing would make every test below vacuous."""
    assert PINS, "no src/requirements.txt found under software/"


def test_every_requirement_is_an_exact_pin():
    """A range would let the tested version drift from the shipped one."""
    assert not MALFORMED, f"not pinned with ==: {MALFORMED}"


def test_no_two_packages_pin_the_same_dependency_differently():
    """One shared test environment cannot hold two versions of one library. If
    this fails, the packages need separate environments, not a bigger one."""
    conflicts = {name: by_package for name, by_package in PINS.items() if len(set(by_package.values())) > 1}

    assert not conflicts, f"conflicting pins across packages: {conflicts}"


@pytest.mark.parametrize("name", sorted(PINS))
def test_installed_version_matches_every_package_that_pins_it(name):
    """Compared against every distinct pinned version, not an arbitrary one, so
    a conflict cannot pass here by picking the version that happens to match."""
    pinned = set(PINS[name].values())

    try:
        installed = metadata.version(name)
    except metadata.PackageNotFoundError:
        pytest.fail(
            f"{name} is pinned at {sorted(pinned)} by {sorted(PINS[name])} but is not installed. "
            f"Run `uv sync --all-groups` from software/."
        )

    assert pinned == {installed}, f"{name}: packages pin {sorted(pinned)}, the environment has {installed}"


def read_runenv_python():
    """The python version the block's software packages declare in package.json."""
    versions = set()
    for manifest in sorted(SOFTWARE.glob("*/package.json")):
        for match in re.finditer(r"runenv-python-3:(\d+)\.(\d+)\.(\d+)", manifest.read_text()):
            versions.add(tuple(int(group) for group in match.groups()))
    return versions


def test_interpreter_matches_the_shipped_runenv():
    """A test passing on 3.13 says nothing about a block that runs on 3.12: the
    wheels differ, and so can the behaviour.

    Compared down to the patch, because pyproject.toml pins requires-python to
    the exact runenv version. Bumping the runenv without bumping that pin fails
    here rather than drifting quietly."""
    declared = read_runenv_python()
    assert declared, "no runenv-python-3 pin found in any software/*/package.json"
    assert len(declared) == 1, f"packages declare different python versions: {declared}"

    shipped = next(iter(declared))
    running = sys.version_info[:3]

    assert running == shipped, (
        f"tests run on python {'.'.join(map(str, running))}, the block ships {'.'.join(map(str, shipped))}"
    )
