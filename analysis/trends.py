"""Non-parametric trend statistics: Theil-Sen slope + moving block bootstrap CI.

Lightweight, deterministic, scipy/numpy only — no forecasting/statistical-model
libraries (statsmodels is deliberately NOT used here; see requirements.txt).

- compute_sens_slope: median pairwise (Theil-Sen) slope via scipy.stats.theilslopes,
  with the analytical (rank-based) confidence intervals scipy computes.
- moving_block_bootstrap_slope: detrended moving block bootstrap — resamples
  overlapping blocks of residuals (size 3 by default) so multi-year climate
  memory (autocorrelation) is preserved, then reports the 95% percentile
  confidence interval of the Theil-Sen slope and whether 0 is excluded.

Both functions drop years with missing values and accept any year/value pairs
(need not be contiguous).
"""
import math

import numpy as np
from scipy import stats


def _clean(years, values):
    x = np.asarray(years, dtype=float)
    y = np.asarray(values, dtype=float)
    mask = ~np.isnan(x) & ~np.isnan(y)
    x, y = x[mask], y[mask]
    if len(y) < 4:
        raise ValueError("need at least 4 non-missing values for a trend")
    # theilslopes needs sorted x for stable pairwise medians
    order = np.argsort(x)
    return x[order], y[order]


def compute_sens_slope(years, values, alpha=0.95):
    """Theil-Sen (median pairwise) slope with scipy's analytical confidence interval.

    Returns a dict with per-year units:
      slope_per_year, intercept, ci_low_per_year, ci_high_per_year,
      n_years, unit
    """
    x, y = _clean(years, values)
    res = stats.theilslopes(y, x, alpha=alpha)
    return {
        "slope_per_year": float(res.slope),
        "intercept": float(res.intercept),
        "ci_low_per_year": float(res.low_slope),
        "ci_high_per_year": float(res.high_slope),
        "n_years": int(len(y)),
        "unit": "per year",
        "alpha": alpha,
    }


def moving_block_bootstrap_slope(years, values, block_size=3, n_boot=2000, seed=42):
    """95% percentile CI of the Theil-Sen slope under a DETRENDED moving block bootstrap.

    Standard MBB (Kunsch 1989) resamples overlapping blocks of consecutive years so
    short-memory autocorrelation (climate memory) is preserved. Applied naively to a
    trending series, however, block junctions inject spurious level shifts that swamp
    the trend signal. The statistically standard remedy for slope confidence intervals
    is the detrended MBB:

      1. fit the Theil-Sen line and take residuals e_i = y_i - fitted(x_i);
      2. resample OVERLAPPING blocks of e (length `block_size`, drawn with
         replacement, concatenated and truncated to n) — residuals keep their
         autocorrelation;
      3. add the fitted line back and recompute the Theil-Sen slope of the
         replicate.

    The percentile interval (2.5%, 97.5%) of those slopes is the 95% CI, and
    `statistically_significant_95` is True iff 0 is excluded.

    Deterministic: numpy default_rng seeded with `seed`.
    Returns a dict (per-year units):
      slope_per_year, mbb_ci_low_95, mbb_ci_high_95,
      statistically_significant_95, block_size, n_boot, seed, n_years, unit
    """
    if block_size < 1:
        raise ValueError("block_size must be >= 1")
    if n_boot < 1:
        raise ValueError("n_boot must be >= 1")
    x, y = _clean(years, values)
    n = len(y)
    block_size = min(block_size, n)
    fit = stats.theilslopes(y, x)
    fitted = fit.intercept + fit.slope * x
    resid = y - fitted
    n_blocks = math.ceil(n / block_size)
    starts = np.arange(n - block_size + 1)  # overlapping block start positions
    rng = np.random.default_rng(seed)
    slopes = np.empty(n_boot, dtype=float)
    for i in range(n_boot):
        chosen = rng.choice(starts, size=n_blocks, replace=True)
        idx = np.concatenate([np.arange(s, s + block_size) for s in chosen])[:n]
        slopes[i] = stats.theilslopes(fitted + resid[idx], x).slope
    lo, hi = np.percentile(slopes, [2.5, 97.5])
    point = float(fit.slope)
    return {
        "slope_per_year": point,
        "mbb_ci_low_95": float(lo),
        "mbb_ci_high_95": float(hi),
        "statistically_significant_95": bool(lo > 0 or hi < 0),
        "block_size": block_size,
        "n_boot": n_boot,
        "seed": seed,
        "n_years": n,
        "unit": "per year",
    }
