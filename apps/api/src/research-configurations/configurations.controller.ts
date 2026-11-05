import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  BadRequestException,
  UseFilters,
  HttpCode,
} from '@nestjs/common';
import { z } from 'zod';
import {
  configurationHash,
  configurationPresets,
  validateConfiguration,
} from '@bybit/contracts';
import { ResearchConfigurationsService } from './configurations.service.js';
import { ConfigurationExceptionFilter } from './configurations.filter.js';

const name = z.string().trim().min(1).max(120);
const revision = z.number().int().min(1).max(2147483647);
const createBody = z.strictObject({
  name,
  configuration: z.unknown().refine((value) => value !== undefined),
});
const updateBody = createBody.extend({ expectedRevision: revision });
const snapshotBody = z.strictObject({ expectedRevision: revision });
const compareBody = z.strictObject({
  referenceSnapshotId: z.uuid(),
  candidate: z.unknown().refine((value) => value !== undefined),
});
const pagination = z.strictObject({
  limit: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .optional(),
  offset: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      code: 'invalid_request',
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        code: issue.code,
        message: 'Invalid request field',
      })),
    });
  return result.data;
}

@Controller()
@UseFilters(ConfigurationExceptionFilter)
export class ResearchConfigurationsController {
  constructor(
    @Inject(ResearchConfigurationsService)
    private readonly service: ResearchConfigurationsService,
  ) {}

  @Post('configurations/validate')
  @HttpCode(200)
  validate(@Body() body: unknown) {
    const result = validateConfiguration(body);
    if (!result.valid)
      throw new BadRequestException({
        code: 'invalid_configuration',
        issues: result.issues,
      });
    return {
      configuration_valid: true,
      config_hash: configurationHash(result.configuration),
      ...result,
    };
  }

  @Get('configuration-presets')
  presets() {
    return { items: configurationPresets() };
  }

  @Post('configurations')
  create(@Body() body: unknown) {
    const data = parse(createBody, body);
    return this.service.create(data.name, data.configuration);
  }

  @Get('configurations')
  list(@Query() query: unknown) {
    const data = parse(pagination, query);
    const limit = data.limit === undefined ? 20 : Number(data.limit);
    const offset = data.offset === undefined ? 0 : Number(data.offset);
    if (
      !Number.isSafeInteger(limit) ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset > 1000000
    )
      throw new BadRequestException({ code: 'invalid_pagination' });
    return this.service.list(limit, offset);
  }

  @Get('configurations/:id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(id);
  }

  @Put('configurations/:id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const data = parse(updateBody, body);
    return this.service.update(
      id,
      data.expectedRevision,
      data.name,
      data.configuration,
    );
  }

  @Post('configurations/:id/snapshots')
  snapshot(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.service.snapshot(
      id,
      parse(snapshotBody, body).expectedRevision,
    );
  }

  @Get('configuration-snapshots/:id')
  getSnapshot(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getSnapshot(id);
  }

  @Post('configurations/compatibility')
  @HttpCode(200)
  compatibility(@Body() body: unknown) {
    const data = parse(compareBody, body);
    return this.service.compatibility(data.referenceSnapshotId, data.candidate);
  }
}
