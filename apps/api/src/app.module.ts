import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnvironment } from './config/environment.js';
import { DatabaseService } from './database/database.service.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: parseEnvironment,
    }),
  ],
  controllers: [HealthController],
  providers: [DatabaseService, HealthService],
})
export class AppModule {}
