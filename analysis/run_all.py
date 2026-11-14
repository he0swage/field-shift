"""One-command regeneration + verification + tests.

    python analysis/run_all.py [--stamp "..."] [--regions setif,constantine,tiaret] [--skip-tests]

Stages (each prints PASS/FAIL; any FAIL makes the script exit 1):
  1. build    - rebuild every processed file from data/raw/ + domain/thresholds.json
  2. sensitivity - regenerate data/processed/sensitivity.json
  3. verify   - independent recomputation (no shared code) vs stored outputs
  4. tests    - pytest suite (45 tests)
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable


def run(stage, args_list, cwd):
    print(f"\n===== {stage}: {' '.join(args_list)}")
    proc = subprocess.run([PY, *args_list], cwd=cwd)
    status = "PASS" if proc.returncode == 0 else "FAIL"
    print(f"===== {stage}: {status}")
    return proc.returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamp", default=None)
    ap.add_argument("--regions", default="setif,constantine,tiaret")
    ap.add_argument("--skip-tests", action="store_true")
    args = ap.parse_args()

    repo = HERE.parent
    results = {}

    build_cmd = [str(HERE / "build_indicators.py"), "--regions", args.regions]
    if args.stamp:
        build_cmd += ["--stamp", args.stamp]
    results["build"] = run("build", build_cmd, repo)
    results["sensitivity"] = run("sensitivity", [str(HERE / "sensitivity.py")], repo)
    results["verify"] = run("verify", [str(HERE / "verify_independent.py")], repo)
    if not args.skip_tests:
        results["tests"] = run("tests", ["-m", "pytest", "analysis/tests", "-q"], repo)

    print("\n================ SUMMARY ================")
    for stage, ok in results.items():
        print(f"  {stage:<12} {'PASS' if ok else 'FAIL'}")
    if all(results.values()):
        print("ALL PASS")
        return 0
    print("SOME STAGES FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
