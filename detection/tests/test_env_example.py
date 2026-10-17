"""
.env.example is the list of settings (CLAUDE.md: "the canonical list for each
service"). These checks hold it to the code, both ways, and make sure a .env
copied straight from it runs exactly like no .env at all.

Why: a variable the code read and the example left out is the defect that broke
signed URLs. Block 1 then added eleven settings without touching the example
(batched into C7 on purpose), so the rule held only as long as somebody
remembered it.
"""

import ast
import importlib
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values

DETECTION = Path(__file__).resolve().parents[1]
EXAMPLE = DETECTION / ".env.example"

# Read by the code but not ours to set: the operating system sets them.
NOT_SETTINGS = {
    "DISPLAY": "set by Linux when there's a screen; HEADLESS is the setting",
    "WAYLAND_DISPLAY": "same as DISPLAY",
}


def _names_read(path):
    """Every ENV_NAME a file reads: os.getenv, os.environ.get / [...], env.get."""
    names = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("getenv", "get") and node.args
                and isinstance(node.args[0], ast.Constant)
                and isinstance(node.args[0].value, str)):
            owner = ast.unparse(node.func.value)
            if owner in ("os", "os.environ", "env"):
                names.add(node.args[0].value)
        elif (isinstance(node, ast.Subscript) and isinstance(node.ctx, ast.Load)
                and ast.unparse(node.value) == "os.environ"
                and isinstance(node.slice, ast.Constant)):
            names.add(node.slice.value)
    return {n for n in names if n.isupper()}


def _settings_in_code():
    names = set()
    for path in sorted((DETECTION / "src").glob("*.py")):
        names |= _names_read(path)
    return names - set(NOT_SETTINGS)


def _example():
    return dotenv_values(EXAMPLE)


def test_the_reader_finds_settings_it_should():
    # A reader that finds nothing would make the next check pass for nothing.
    found = _settings_in_code()
    for name in ("CAMERA_SOURCE", "HEADLESS", "DEVICE_API_KEY", "TWILIO_AUTH_TOKEN",
                 "S3_BUCKET_NAME"):
        assert name in found, f"the reader missed {name}: it's checking nothing"


def test_every_setting_the_service_reads_is_in_the_example():
    missing = sorted(_settings_in_code() - set(_example()))
    assert not missing, (
        f"read by detection/src but missing from .env.example: {', '.join(missing)}. "
        f"Add each, with a line on what it does and why")


def test_every_setting_in_the_example_is_read_by_the_service():
    unused = sorted(set(_example()) - _settings_in_code())
    assert not unused, (
        f"in .env.example but read by nothing in detection/src: {', '.join(unused)}. "
        f"A setting nobody reads looks like it does something")


def _import_main(monkeypatch, env):
    """main.py's settings as imported with exactly `env`, never detection/.env."""
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)
    for name in _settings_in_code() | set(_example()):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value or "")
    for mod in ("main", "alerts"):   # alerts also calls load_dotenv at import
        sys.modules.pop(mod, None)
    try:
        return importlib.import_module("main")
    finally:
        for mod in ("main", "alerts"):
            sys.modules.pop(mod, None)


def _settings(module):
    return {k: v for k, v in vars(module).items()
            if k.isupper() and not callable(v) and not k.startswith("_")}


def test_a_env_copied_from_the_example_runs_like_no_env(monkeypatch):
    # Copy the example to .env, fill in nothing: nothing may change, and nothing
    # may break. A blank MODEL_PATH= or STATUS_EVERY_S= would do one or the other.
    from camera import CameraSource

    example = {k: v or "" for k, v in _example().items()}
    as_example = _settings(_import_main(monkeypatch, example))
    main = _import_main(monkeypatch, {})
    as_nothing = _settings(main)
    differ = sorted(k for k in as_nothing if as_example.get(k) != as_nothing[k])
    assert not differ, (
        "these settings come out differently from .env.example than from no .env: "
        + ", ".join(f"{k} ({as_example.get(k)!r} vs {as_nothing[k]!r})" for k in differ))

    # Read where the program reads them, not at import.
    assert CameraSource.from_env(example) == CameraSource.from_env({})
    for platform in ("linux", "win32"):
        assert main.decide_headless(example, platform) == main.decide_headless({}, platform)
    assert main.decide_log_level(example.get("LOG_LEVEL")) == main.decide_log_level(None)


@pytest.mark.parametrize("line", ["MODEL_PATH=", "STATUS_EVERY_S=30"])
def test_the_copy_check_catches_a_bad_example(monkeypatch, line):
    # The check above, on a broken example: it has to fail, or it isn't checking.
    name, value = line.split("=", 1)
    example = {k: v or "" for k, v in _example().items()}
    example[name] = value
    try:
        as_example = _settings(_import_main(monkeypatch, example))
    except Exception:
        return   # crashing on import counts as caught
    as_nothing = _settings(_import_main(monkeypatch, {}))
    assert any(as_example.get(k) != as_nothing[k] for k in as_nothing), (
        f"{line} in the example went unnoticed")
