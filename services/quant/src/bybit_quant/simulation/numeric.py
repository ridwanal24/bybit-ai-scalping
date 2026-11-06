"""Versioned Decimal boundary: precision128, adverse currency rounding at 1e-18."""

from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal, localcontext
from functools import wraps

D = Decimal
ZERO = D(0)
QUANTUM = D("0.000000000000000001")


def exact(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        with localcontext() as ctx:
            ctx.prec = 128
            return fn(*args, **kwargs)

    return wrapped


def decimal(value):
    if type(value) not in (str, int, D):
        raise ValueError("financial_decimal_required")
    result = D(value)
    if not result.is_finite():
        raise ValueError("nonfinite_financial_value")
    return result


@exact
def cash(value):
    return value.quantize(QUANTUM, rounding=ROUND_FLOOR)


@exact
def debit(value):
    return value.quantize(QUANTUM, rounding=ROUND_CEILING)


@exact
def tick(value, step, up=False):
    if step <= 0:
        raise ValueError("invalid_step")
    return (value / step).to_integral_value(rounding=ROUND_CEILING if up else ROUND_FLOOR) * step


def wire(value):
    if not value.is_finite():
        raise ValueError("nonfinite_financial_value")
    text = format(value, "f")
    text = text.rstrip("0").rstrip(".") if "." in text else text
    return "0" if text in ("-0", "") else text
