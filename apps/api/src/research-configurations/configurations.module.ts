import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ResearchConfigurationsController } from './configurations.controller.js';
import { ResearchConfigurationsService } from './configurations.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ResearchConfigurationsController],
  providers: [ResearchConfigurationsService],
  exports: [ResearchConfigurationsService],
})
export class ResearchConfigurationsModule {}
