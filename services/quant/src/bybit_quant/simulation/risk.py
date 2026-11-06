"""UTC equity daily latch and run high-water drawdown latch; no external cashflows."""

from bybit_quant.simulation.numeric import ZERO, decimal, exact


class RiskState:
    def __init__(self, risk):
        self.limit = decimal(risk["daily_loss_limit"])
        self.drawdown_limit = decimal(risk["max_drawdown"])
        self.day_start = self.peak = decimal(risk["initial_capital"])
        self.day = None
        self.daily_latched = self.drawdown_latched = False
        self.drawdown = ZERO

    def rollover(self, time_ms, equity):
        day = time_ms // 86400000
        if day != self.day and equity > 0:
            self.day = day
            self.day_start = equity
            self.daily_latched = False

    @exact
    def check(self, equity):
        self.peak = max(self.peak, equity)
        self.drawdown = max(ZERO, (self.peak - equity) / self.peak)
        if equity <= self.day_start * (1 - self.limit):
            self.daily_latched = True
        if self.drawdown >= self.drawdown_limit:
            self.drawdown_latched = True
        return (
            "drawdown_limit"
            if self.drawdown_latched
            else ("daily_loss_limit" if self.daily_latched else None)
        )

    @exact
    def remaining(self, equity):
        return max(ZERO, self.day_start * self.limit - max(ZERO, self.day_start - equity))

    @property
    def allowed(self):
        return not (self.daily_latched or self.drawdown_latched)
