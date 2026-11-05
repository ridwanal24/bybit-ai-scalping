import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ResearchConfigurationsModule } from '../research-configurations/configurations.module.js';
import { BybitPublicClient } from './bybit-public.client.js';
import { MarketDataService } from './market-data.service.js';
import { MarketDataController } from './market-data.controller.js';

@Module({
  imports: [DatabaseModule, ResearchConfigurationsModule],
  controllers: [MarketDataController],
  providers: [BybitPublicClient, MarketDataService],
  exports: [MarketDataService, BybitPublicClient],
})
export class MarketDataModule {}
