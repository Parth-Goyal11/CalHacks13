"""Unit tests for sky_photo.score — tier boundaries, caps, point table."""

from __future__ import annotations

import unittest

from sky_photo.score import (
    AWARD_POINTS,
    SUBJECT_BONUS,
    apply_caps,
    award_for,
    score_photo,
    subject_bonus_for,
    tier_for_final_score,
    weighted_score,
)


class TestWeightedScore(unittest.TestCase):
    def test_all_tens_is_100(self) -> None:
        self.assertEqual(weighted_score(10, 10, 10, 10, 10, 10), 100)

    def test_all_zeros_is_0(self) -> None:
        self.assertEqual(weighted_score(0, 0, 0, 0, 0, 0), 0)

    def test_design_example_band(self) -> None:
        # clarity 8, tracking 9, exposure 7, noise 6, framing 8, conditions 6
        # = 100 * (0.25*8 + 0.20*9 + 0.15*7 + 0.10*6 + 0.20*8 + 0.10*6) / 10
        # = 100 * (2.0 + 1.8 + 1.05 + 0.6 + 1.6 + 0.6) / 10 = 100 * 7.65 / 10 = 76.5 → 76 or 77
        self.assertEqual(weighted_score(8, 9, 7, 6, 8, 6), round(76.5))


class TestSubjectBonus(unittest.TestCase):
    def test_table_values(self) -> None:
        self.assertEqual(SUBJECT_BONUS["plate_solved_star_field"], 0)
        self.assertEqual(SUBJECT_BONUS["naked_eye_deep_sky"], 8)
        self.assertEqual(SUBJECT_BONUS["milky_way_core"], 10)
        self.assertEqual(SUBJECT_BONUS["planet_moon_or_pair"], 10)
        self.assertEqual(SUBJECT_BONUS["satellite_logged_pass"], 15)
        self.assertEqual(SUBJECT_BONUS["meteor_streak"], 15)
        self.assertEqual(SUBJECT_BONUS["aurora_below_50_lat"], 20)
        self.assertEqual(SUBJECT_BONUS["naked_eye_comet"], 25)
        self.assertEqual(SUBJECT_BONUS["iss_crossing_moon_or_sun"], 30)

    def test_largest_applies(self) -> None:
        self.assertEqual(
            subject_bonus_for(["naked_eye_deep_sky", "milky_way_core"]),
            10,
        )
        self.assertEqual(
            subject_bonus_for(
                ["naked_eye_comet", "iss_crossing_moon_or_sun"]
            ),
            30,
        )

    def test_empty_is_zero(self) -> None:
        self.assertEqual(subject_bonus_for([]), 0)

    def test_unknown_key_raises(self) -> None:
        with self.assertRaises(KeyError):
            subject_bonus_for(["not_a_real_subject"])


class TestTierBoundaries(unittest.TestCase):
    def test_common_upper_bound(self) -> None:
        self.assertEqual(tier_for_final_score(0), "Common")
        self.assertEqual(tier_for_final_score(44), "Common")

    def test_uncommon_bounds(self) -> None:
        self.assertEqual(tier_for_final_score(45), "Uncommon")
        self.assertEqual(tier_for_final_score(59), "Uncommon")

    def test_rare_bounds(self) -> None:
        self.assertEqual(tier_for_final_score(60), "Rare")
        self.assertEqual(tier_for_final_score(74), "Rare")

    def test_epic_bounds(self) -> None:
        self.assertEqual(tier_for_final_score(75), "Epic")
        self.assertEqual(tier_for_final_score(89), "Epic")

    def test_legendary_lower_bound(self) -> None:
        self.assertEqual(tier_for_final_score(90), "Legendary")
        self.assertEqual(tier_for_final_score(100), "Legendary")


class TestCaps(unittest.TestCase):
    def test_model_estimate_caps_at_rare(self) -> None:
        self.assertEqual(
            apply_caps(
                "Legendary",
                identity_method="model-estimate",
                has_exif_time=True,
            ),
            "Rare",
        )
        self.assertEqual(
            apply_caps(
                "Epic",
                identity_method="model-estimate",
                has_exif_time=True,
            ),
            "Rare",
        )
        self.assertEqual(
            apply_caps(
                "Rare",
                identity_method="model-estimate",
                has_exif_time=True,
            ),
            "Rare",
        )
        self.assertEqual(
            apply_caps(
                "Uncommon",
                identity_method="model-estimate",
                has_exif_time=True,
            ),
            "Uncommon",
        )

    def test_no_exif_caps_at_uncommon(self) -> None:
        self.assertEqual(
            apply_caps(
                "Legendary",
                identity_method="plate-solved",
                has_exif_time=False,
            ),
            "Uncommon",
        )
        self.assertEqual(
            apply_caps(
                "Rare",
                identity_method="plate-solved",
                has_exif_time=False,
            ),
            "Uncommon",
        )
        self.assertEqual(
            apply_caps(
                "Uncommon",
                identity_method="plate-solved",
                has_exif_time=False,
            ),
            "Uncommon",
        )
        self.assertEqual(
            apply_caps(
                "Common",
                identity_method="plate-solved",
                has_exif_time=False,
            ),
            "Common",
        )

    def test_both_caps_strictest_wins(self) -> None:
        # No EXIF is stricter than model-estimate Rare → Uncommon.
        self.assertEqual(
            apply_caps(
                "Legendary",
                identity_method="model-estimate",
                has_exif_time=False,
            ),
            "Uncommon",
        )

    def test_plate_solved_with_exif_no_cap(self) -> None:
        self.assertEqual(
            apply_caps(
                "Legendary",
                identity_method="plate-solved",
                has_exif_time=True,
            ),
            "Legendary",
        )


class TestAwardPoints(unittest.TestCase):
    def test_point_table(self) -> None:
        self.assertEqual(AWARD_POINTS["Common"], 5)
        self.assertEqual(AWARD_POINTS["Uncommon"], 10)
        self.assertEqual(AWARD_POINTS["Rare"], 20)
        self.assertEqual(AWARD_POINTS["Epic"], 35)
        self.assertEqual(AWARD_POINTS["Legendary"], 60)

    def test_award_for_each_tier(self) -> None:
        for rarity, points in AWARD_POINTS.items():
            award = award_for(rarity)
            self.assertEqual(award.points, points)
            self.assertEqual(award.badge, f"{rarity} Frame")


class TestScorePhotoIntegration(unittest.TestCase):
    def test_not_night_sky_no_score(self) -> None:
        result = score_photo(
            is_night_sky=False,
            clarity=10,
            tracking=10,
            exposure=10,
            noise=10,
            framing=10,
            conditions=10,
        )
        self.assertIsNone(result.score)
        self.assertIsNone(result.subject_bonus)
        self.assertIsNone(result.final_score)
        self.assertIsNone(result.rarity)
        self.assertIsNone(result.award)

    def test_design_example_epic(self) -> None:
        # Design record: score 76, subject_bonus 10 → final 86 → Epic, 35 pts
        result = score_photo(
            is_night_sky=True,
            clarity=8,
            tracking=9,
            exposure=7,
            noise=6,
            framing=8,
            conditions=6,
            subjects=["milky_way_core"],
            identity_method="plate-solved",
            has_exif_time=True,
            card_foil="orion",
        )
        self.assertEqual(result.score, round(76.5))
        self.assertEqual(result.subject_bonus, 10)
        self.assertEqual(result.final_score, min(100, result.score + 10))
        self.assertEqual(result.rarity, "Epic")
        assert result.award is not None
        self.assertEqual(result.award.points, 35)
        self.assertEqual(result.award.badge, "Epic Frame")
        self.assertEqual(result.award.card_foil, "orion")

    def test_final_score_capped_at_100(self) -> None:
        result = score_photo(
            is_night_sky=True,
            clarity=10,
            tracking=10,
            exposure=10,
            noise=10,
            framing=10,
            conditions=10,
            subjects=["iss_crossing_moon_or_sun"],
        )
        self.assertEqual(result.score, 100)
        self.assertEqual(result.subject_bonus, 30)
        self.assertEqual(result.final_score, 100)
        self.assertEqual(result.rarity, "Legendary")

    def test_model_estimate_cap_on_full_pipeline(self) -> None:
        result = score_photo(
            is_night_sky=True,
            clarity=10,
            tracking=10,
            exposure=10,
            noise=10,
            framing=10,
            conditions=10,
            identity_method="model-estimate",
            has_exif_time=True,
        )
        self.assertEqual(result.final_score, 100)
        self.assertEqual(result.rarity, "Rare")
        assert result.award is not None
        self.assertEqual(result.award.points, 20)

    def test_no_exif_cap_on_full_pipeline(self) -> None:
        result = score_photo(
            is_night_sky=True,
            clarity=10,
            tracking=10,
            exposure=10,
            noise=10,
            framing=10,
            conditions=10,
            identity_method="plate-solved",
            has_exif_time=False,
        )
        self.assertEqual(result.rarity, "Uncommon")
        assert result.award is not None
        self.assertEqual(result.award.points, 10)


if __name__ == "__main__":
    unittest.main()
