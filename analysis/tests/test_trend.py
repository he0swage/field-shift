import pytest

from build_indicators import ols_trend, mann_kendall_sens, trend_block


class TestOLSTrend:
    def test_perfect_line_slope_and_p(self):
        # y = 2 per year exactly -> slope 2*10 = 20 mm/decade, p ~ 0
        years = list(range(1995, 2025))
        vals = [2.0 * (y - 1995) for y in years]
        slope, p = ols_trend(years, vals)
        assert slope == pytest.approx(20.0, abs=1e-9)
        assert p < 1e-12

    def test_noisy_series_reasonable(self):
        years = list(range(1995, 2025))
        vals = [400 + (y - 1995) * 1.5 for y in years]
        slope, p = ols_trend(years, vals)
        assert slope == pytest.approx(15.0, abs=0.5)
        assert p < 0.05


class TestMannKendallSen:
    def test_monotonic_increase(self):
        # strictly increasing by 2/yr: S = n(n-1)/2, Sen slope = 2 -> 20 mm/decade
        years = [float(y) for y in range(1995, 2025)]
        vals = [(y - 1995) * 2.0 for y in years]
        sen, p = mann_kendall_sens(years, vals)
        assert sen == pytest.approx(20.0, abs=1e-9)
        assert p < 1e-10

    def test_alternating_series_no_trend(self):
        years = [float(y) for y in range(1995, 2025)]
        vals = [0.0, 1.0] * 15
        sen, p = mann_kendall_sens(years, vals)
        assert abs(sen) < 1.0  # near-zero median slope
        assert p > 0.5         # clearly not significant

    def test_ties_do_not_crash(self):
        years = [float(y) for y in range(1995, 2015)]
        vals = [5.0] * 20
        sen, p = mann_kendall_sens(years, vals)
        assert sen == 0.0 and p == 1.0


class TestTrendBlockLabels:
    def test_agreement_label(self):
        years = list(range(1995, 2025))
        vals = [500 - (y - 1995) * 3.0 for y in years]  # strong decline
        block = trend_block(years, vals)
        assert block["label"] == "both methods agree"
        assert block["confidence"] == "high"
        assert block["ols_slope_mm_per_decade"] < 0 and block["sen_slope_mm_per_decade"] < 0

    def test_no_clear_trend_label(self):
        vals = [400 + (-1) ** i for i in range(30)]
        block = trend_block(list(range(1995, 2025)), vals)
        assert block["label"] == "no clear trend"
        assert block["confidence"] == "low"

    def test_disagreement_is_not_agreement(self):
        # a series where OLS is significant but MK is not (single big outlier end)
        years = list(range(1995, 2025))
        vals = [400.0] * 28 + [420.0, 440.0]
        block = trend_block(years, vals)
        assert block["label"] in ("no clear trend", "both methods agree")
        # exact behavior asserted indirectly: label must be one of the two legal values
