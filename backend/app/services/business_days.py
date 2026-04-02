from __future__ import annotations

from datetime import date, timedelta


def is_business_day(value: date) -> bool:
    return value.weekday() < 5


def add_business_days(base_date: date, amount: int) -> date:
    if amount == 0:
        return base_date

    step = 1 if amount > 0 else -1
    remaining = abs(amount)
    current = base_date
    while remaining > 0:
        current = current + timedelta(days=step)
        if is_business_day(current):
            remaining -= 1
    return current


def business_days_between(start_date: date, end_date: date) -> int:
    if start_date == end_date:
        return 0

    if end_date > start_date:
        current = start_date
        count = 0
        while current < end_date:
            current = current + timedelta(days=1)
            if is_business_day(current):
                count += 1
        return count

    current = start_date
    count = 0
    while current > end_date:
        current = current - timedelta(days=1)
        if is_business_day(current):
            count -= 1
    return count
