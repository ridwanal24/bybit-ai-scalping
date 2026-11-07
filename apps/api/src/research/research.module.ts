import { Module } from '@nestjs/common';
import { ResearchConfigurationsModule } from '../research-configurations/configurations.module.js';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { QuantBridge } from './quant-bridge.service.js';
import { ResearchController } from './research.controller.js';
@Module({
  imports: [ResearchConfigurationsModule, MarketDataModule],
  controllers: [ResearchController],
  providers: [QuantBridge],
  exports: [QuantBridge],
})
export class ResearchModule {}
