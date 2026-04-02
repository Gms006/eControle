from __future__ import annotations

from datetime import date

from app.services.business_days import add_business_days, business_days_between, is_business_day


def test_is_business_day_weekday_and_weekend():
    assert is_business_day(date(2026, 4, 6)) is True  # Monday
    assert is_business_day(date(2026, 4, 5)) is False  # Sunday


def test_add_business_days_skips_weekends():
    base = date(2026, 4, 3)  # Friday
    assert add_business_days(base, 1) == date(2026, 4, 6)  # Monday
    assert add_business_days(base, 5) == date(2026, 4, 10)


def test_business_days_between_positive_and_negative():
    start = date(2026, 4, 3)  # Friday
    end = date(2026, 4, 10)   # Friday
    assert business_days_between(start, end) == 5
    assert business_days_between(end, start) == -5
