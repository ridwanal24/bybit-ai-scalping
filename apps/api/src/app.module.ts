import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { ResearchConfigurationsModule } from './research-configurations/configurations.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';

@Module({
  imports: [
    DatabaseModule,
    ResearchConfigurationsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: parseEnvironment,
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
