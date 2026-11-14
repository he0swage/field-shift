import pandas as pd
import pytest

from build_indicators import month_window, growing_season, annual_rain, water_stress


def _df(rows):
    """rows: (date, pr, tmax, tmin)."""
    idx = pd.DatetimeIndex([r[0] for r in rows])
    return pd.DataFrame({"pr": [r[1] for r in rows],
                         "tmax": [r[2] for r in rows],
                         "tmin": [r[3] for r in rows]}, index=idx)


class TestWindows:
    def test_month_window_picks_only_months(self):
        rows = [("2020-04-10", 1, 36.0, 5), ("2020-05-10", 1, 36.0, 5),
                ("2020-07-10", 1, 36.0, 5), ("2021-04-10", 1, 36.0, 5)]
        df = _df(rows)
        gf = month_window(df, 2020, [4, 5, 6])
        assert len(gf) == 2  # only Apr/May 2020, not Jul 2020 or Apr 2021

    def test_growing_season_spans_years(self):
        rows = [("2019-12-01", 1, 10, 0), ("2020-01-15", 1, 10, 0), ("2020-05-20", 1, 10, 0),
                ("2020-06-20", 1, 10, 0), ("2020-09-20", 1, 10, 0), ("2020-10-05", 1, 10, 0)]
        df = _df(rows)
        gs = growing_season(df, 2020, [10, 11, 12, 1, 2, 3, 4, 5])
        assert list(gs.index.strftime("%Y-%m-%d")) == ["2019-12-01", "2020-01-15", "2020-05-20"]


class TestHotFrostCounts:
    def test_counts_respect_thresholds(self):
        rows = [("2020-04-01", 0, 35.0, 1.0),   # 35.0 is NOT hot (strict >), 1.0 not frost
                ("2020-04-02", 0, 35.1, -0.1),  # hot and frost
                ("2020-03-30", 0, 20.0, -1.0),  # frost only
                ("2020-06-15", 0, 36.0, 10.0),  # hot only
                ("2020-01-15", 0, 30.0, -2.0)]  # outside window entirely
        df = _df(rows)
        gf = month_window(df, 2020, [4, 5, 6])
        lf = month_window(df, 2020, [3, 4])
        hot = int(((gf["tmax"] > 35.0) & gf["tmax"].notna()).sum())
        frost = int(((lf["tmin"] < 0.0) & lf["tmin"].notna()).sum())
        assert hot == 2 and frost == 2

    def test_extreme_rain(self):
        rows = [("2020-01-01", 20.0, 10, 5),    # 20.0 NOT extreme (strict >)
                ("2020-01-02", 20.1, 10, 5),    # extreme
                ("2020-02-01", 5.0, 10, 5)]
        df = _df(rows)
        ext = int(((df["pr"] > 20.0) & df["pr"].notna()).sum())
        assert ext == 1


class TestWaterStress:
    def test_known_answer(self):
        annual = {y: 100.0 for y in range(1995, 2015)}
        annual.update({y: 80.0 for y in range(2015, 2025)})
        assert water_stress(annual, (1995, 2014), (2015, 2024)) == pytest.approx(0.2)

    def test_floored_at_zero(self):
        annual = {y: 100.0 for y in range(1995, 2015)}
        annual.update({y: 120.0 for y in range(2015, 2025)})
        assert water_stress(annual, (1995, 2014), (2015, 2024)) == 0.0

    def test_annual_rain_skips_missing(self):
        rows = [("2020-01-01", 10.0, 10, 5), ("2020-01-02", None, 10, 5), ("2020-01-03", 2.5, 10, 5)]
        df = _df(rows)
        a = annual_rain(df)
        assert a.loc[2020] == pytest.approx(12.5)
