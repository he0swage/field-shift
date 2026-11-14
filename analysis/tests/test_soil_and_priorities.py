import pytest

from build_indicators import soil_from_raw, soc_class, suggested_priorities


def _soilgrids_doc(soc_dg, ph_x10):
    """soc_dg / ph_x10: per-depth dicts."""
    def layer(name, vals):
        return {"name": name,
                "depths": [{"label": k, "values": {"mean": v}} for k, v in vals.items()]}
    return {"properties": {"layers": [
        layer("soc", soc_dg),
        layer("phh2o", ph_x10),
    ]}}


class TestSoilConversion:
    def test_depth_weighted_5_10_15(self, tmp_path):
        doc = _soilgrids_doc(
            {"0-5cm": 90.0, "5-15cm": 120.0, "15-30cm": 150.0},   # dg/kg
            {"0-5cm": 77.0, "5-15cm": 78.0, "15-30cm": 79.0},     # pH x 10
        )
        (tmp_path / "soilgrids.json").write_text(__import__("json").dumps(doc))
        soil = soil_from_raw(tmp_path)
        # (5*90 + 10*120 + 15*150) / 30 / 10 = 13.0 g/kg
        assert soil["soc_g_per_kg"] == pytest.approx(13.0)
        # (5*77 + 10*78 + 15*79) / 30 / 10 = 7.8333, rounded to 2 decimals by the pipeline
        assert soil["ph"] == pytest.approx(7.83)

    def test_soc_classes_10_20(self):
        assert soc_class(9.9, {}) == "low"
        assert soc_class(10.0, {}) == "medium"
        assert soc_class(15.0, {}) == "medium"
        assert soc_class(20.0, {}) == "medium"
        assert soc_class(20.1, {}) == "high"


class TestPrioritiesPRD62:
    def test_sums_to_100_across_grid(self):
        for ws in (0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.9, 1.0):
            for cls in ("low", "medium", "high"):
                p = suggested_priorities(ws, cls)
                assert sum(p[k] for k in ("save_water", "protect_soil", "yield_")) == 100

    def test_known_answer_stress_point3_medium(self):
        # water = min(1, 0.3/0.3) = 1; soil = 0.5 (medium); yield = max(0.2, 1-1) = 0.2
        # exact shares 58.8/29.4/11.8 -> floors 58/29/11, remainders .8/.4/.8
        # ties broken water before yield_ -> 59/29/12
        p = suggested_priorities(0.3, "medium")
        assert p == {"save_water": 59, "protect_soil": 29, "yield_": 12}

    def test_known_answer_zero_stress_high_soc(self):
        # water=0, soil=0.1, yield=max(0.2, 0.9)=0.9 -> 0/10/90
        p = suggested_priorities(0.0, "high")
        assert p == {"save_water": 0, "protect_soil": 10, "yield_": 90}

    def test_deterministic(self):
        a = suggested_priorities(0.1625, "medium")
        b = suggested_priorities(0.1625, "medium")
        assert a == b

    def test_yield_key_has_trailing_underscore(self):
        p = suggested_priorities(0.2, "low")
        assert set(p) == {"save_water", "protect_soil", "yield_"}
