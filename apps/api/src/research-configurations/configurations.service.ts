import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  configurationHash,
  configurationPresets,
  compareConfigurations,
  validateConfiguration,
  type ResearchConfiguration,
} from '@bybit/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';

type StoredConfiguration = {
  payload: unknown;
  schemaVersion: string;
  configHash: string;
};

@Injectable()
export class ResearchConfigurationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  validate(input: unknown): ResearchConfiguration {
    const result = validateConfiguration(input);
    if (!result.valid)
      throw new BadRequestException({
        code: 'invalid_configuration',
        issues: result.issues,
      });
    return result.configuration;
  }

  verifyStored(record: StoredConfiguration): ResearchConfiguration {
    const result = validateConfiguration(record.payload);
    if (
      !result.valid ||
      record.schemaVersion !== '1' ||
      configurationHash(result.configuration) !== record.configHash
    ) {
      throw new ConflictException({ code: 'configuration_integrity_error' });
    }
    return result.configuration;
  }

  private content(input: unknown) {
    const configuration = this.validate(input);
    const hash = configurationHash(configuration);
    const preset = configurationPresets().find(
      (item) => item.config_hash === hash,
    );
    const provenance = preset
      ? {
          source: 'builtin_preset',
          preset_id: preset.id,
          preset_version: preset.version,
        }
      : { source: 'user_configuration' };
    return {
      payload: configuration as Prisma.InputJsonObject,
      schemaVersion: '1',
      configHash: hash,
      provenance: provenance as Prisma.InputJsonObject,
    };
  }

  async create(name: string, input: unknown) {
    return this.database.client.researchConfiguration.create({
      data: { name, ...this.content(input) },
    });
  }

  async list(limit: number, offset: number) {
    const items = await this.database.client.researchConfiguration.findMany({
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    for (const item of items) this.verifyStored(item);
    return { items, limit, offset };
  }

  async get(id: string) {
    const record = await this.database.client.researchConfiguration.findUnique({
      where: { id },
    });
    if (!record)
      throw new NotFoundException({ code: 'configuration_not_found' });
    this.verifyStored(record);
    return record;
  }

  async update(
    id: string,
    expectedRevision: number,
    name: string,
    input: unknown,
  ) {
    if (expectedRevision === 2147483647)
      throw new ConflictException({ code: 'revision_limit_reached' });
    const data = { name, ...this.content(input), revision: { increment: 1 } };
    return this.database.client.$transaction(async (tx) => {
      const updated = await tx.researchConfiguration.updateMany({
        where: { id, revision: expectedRevision },
        data,
      });
      if (!updated.count) {
        if (!(await tx.researchConfiguration.findUnique({ where: { id } })))
          throw new NotFoundException({ code: 'configuration_not_found' });
        throw new ConflictException({ code: 'stale_revision' });
      }
      return tx.researchConfiguration.findUniqueOrThrow({ where: { id } });
    });
  }

  async snapshot(id: string, expectedRevision: number) {
    return this.database.client.$transaction(async (tx) => {
      // The row lock serializes both snapshot creation and CAS draft updates.
      await tx.$queryRaw`SELECT "id" FROM "research_configurations" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const draft = await tx.researchConfiguration.findUnique({
        where: { id },
      });
      if (!draft)
        throw new NotFoundException({ code: 'configuration_not_found' });
      const existing = await tx.configurationSnapshot.findUnique({
        where: {
          sourceConfigurationId_sourceRevision: {
            sourceConfigurationId: id,
            sourceRevision: expectedRevision,
          },
        },
      });
      if (existing) {
        this.verifyStored(existing);
        return existing;
      }
      if (draft.revision !== expectedRevision)
        throw new ConflictException({ code: 'stale_revision' });
      this.verifyStored(draft);
      return tx.configurationSnapshot.create({
        data: {
          sourceConfigurationId: id,
          sourceRevision: draft.revision,
          schemaVersion: draft.schemaVersion,
          configHash: draft.configHash,
          payload: draft.payload as Prisma.InputJsonObject,
          provenance: draft.provenance as Prisma.InputJsonObject,
        },
      });
    });
  }

  async getSnapshot(id: string) {
    const snapshot =
      await this.database.client.configurationSnapshot.findUnique({
        where: { id },
      });
    if (!snapshot) throw new NotFoundException({ code: 'snapshot_not_found' });
    this.verifyStored(snapshot);
    return snapshot;
  }

  async compatibility(referenceSnapshotId: string, candidate: unknown) {
    const snapshot = await this.getSnapshot(referenceSnapshotId);
    const report = compareConfigurations(
      this.verifyStored(snapshot),
      candidate,
    );
    if (report.status === 'invalid_candidate')
      throw new BadRequestException({
        code: 'invalid_configuration',
        issues: report.issues,
      });
    return {
      ...report,
      model_approval: 'not_assessed',
      execution_readiness: 'not_assessed',
    };
  }
}
