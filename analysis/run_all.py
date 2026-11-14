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
    ap.add_argument("--forecast", action="store_true",
                    help="after the core stages pass, also generate the experimental SARIMA "
                         "forecast layer (forecast.json; statsmodels required; core indicators untouched)")
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

    if args.forecast and all(results.values()):
        # optional experimental layer, only after the core suite passed; failures
        # here are reported but do not invalidate the core pipeline results
        results["forecast"] = run("forecast (experimental SARIMA)",
                                  [str(HERE / "forecast_sarima.py")], repo)

    print("\n================ SUMMARY ================")
    core_stages = [s for s in ("build", "sensitivity", "verify", "tests") if s in results]
    core_ok = all(results[s] for s in core_stages)
    for stage, ok in results.items():
        print(f"  {stage:<26} {'PASS' if ok else 'FAIL'}")
    if core_ok:
        print("ALL PASS (core pipeline)")
        if "forecast" in results:
            print(f"  forecast (experimental): {'PASS' if results['forecast'] else 'FAIL (core results still valid)'}")
        return 0
    print("SOME STAGES FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
