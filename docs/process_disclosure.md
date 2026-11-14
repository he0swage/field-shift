# Process disclosure (draft for the team to review)

Factual, based on the git history of branch `achref/step1-pipeline` (all commit hashes/dates quoted; nothing pushed yet). Nothing here is claimed beyond what the history shows.

## Before the working session

- The pipeline v1 (`fetch_real_data.py`) and the data outputs it produced were prepared earlier by the team and stored in the shared Drive folder (`field_shift_drive_files/`, containing the PRD v3 and data_regional files). The repo copy was imported on **2026-11-14** (commit `38a47e0`, "Add pipeline v1 to analysis/ (copied byte-identical from drive_files)") and verified byte-identical with `fc /B`.

## During the working session (all commits dated 2026-11-14)

- `cd6622d` raw-response saver + Open-Meteo cross-check helpers (not part of v1).
- `9d052ec`, `f4cdd4d` resumable raw fetch; MODIS fetch hardening.
- `7ba2d35` cleaned 3-region pipeline outputs, cross-check JSONs, Step 1 report.
- `7a9985e` `domain/thresholds.json` + `domain/regions.csv` (config, pending-team flags).
- `5084b0a` pipeline v2 (`build_indicators.py`): seasonal windows, two trend methods, per-indicator confidence, PRD 6.2 priorities; regenerated outputs.
- `fc1dba3` `docs/data_contract.md`; `c5ac9ce` pytest suite (45 tests) + reproducibility docs.
- `f378e0c` Step 2 report.
- Step 3 (this session): `f9a37a1` independent verifier; `89da654`/`66a9360` sensitivity analysis; `b87bcab` sensitivity doc + decision sheet; `0240eb0` `climate_text.json` + `regions_summary.json`; `48e10a2` `run_all.py`; `6c61316` about-data + glossary; `bfecc47` gaps draft; `bb47fd0` charts; `1685cee` pinned requirements.

## Tools and data used

- Data sources: NASA POWER (daily weather), Open-Meteo/ERA5 (cross-check), ISRIC SoilGrids (soil), MODIS MOD13Q1 via ORNL DAAC (NDVI). Raw responses saved to gitignored `data/raw/` on 2026-11-13 (v1 run) / 2026-11-14 (ERA5 + MODIS refresh).
- Python 3.12.10 with pandas, NumPy, SciPy, pytest, matplotlib (versions pinned in `analysis/requirements.txt`).
- **AI coding assistants were used for implementation and code review** throughout the session, under direct human control: the human wrote/approved the decisions, reviewed outputs, and committed every change. The v1 pipeline is the team's own prior work; its logic was never modified.
- Verification: every headline number was independently recomputed by a second implementation (`verify_independent.py`, no shared code) and hand-checkable date lists are printed for human verification.

## What was NOT done

- No live API calls during the offline rebuilds (demo safety); no frontend code changed; nothing pushed to GitHub; no team member's work edited (frontend merge commit `28eabfb` only merged the team's own React migration from `main`).
