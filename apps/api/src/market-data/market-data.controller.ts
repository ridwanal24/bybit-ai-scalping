import {
  BadRequestException,
  Body,
  Catch,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  HttpCode,
  ForbiddenException,
  UseFilters,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { z } from 'zod';
import { MarketDataService, marketPublicValue } from './market-data.service.js';
import { BybitPublicClient } from './bybit-public.client.js';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type LocalRequest = { headers: Record<string, string | string[] | undefined> };
function mutationGuard(request: LocalRequest) {
  if (request.headers.origin === undefined) return;
  try {
    const origin = new URL(String(request.headers.origin));
    if (
      origin.host === request.headers.host &&
      ['http:', 'https:'].includes(origin.protocol)
    )
      return;
  } catch {
    /* reject malformed origins */
  }
  throw new ForbiddenException({ code: 'cross_origin_mutation_forbidden' });
}

@Catch()
class MarketDataFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(value: unknown): void } }>();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    response.status(503).json({ code: 'market_data_unavailable' });
  }
}
const integer = z.string().regex(/^(0|[1-9][0-9]*)$/);
const pageSchema = z.strictObject({
  limit: integer.optional(),
  offset: integer.optional(),
});
const rowsSchema = z.strictObject({
  limit: integer.optional(),
  afterMs: integer.optional(),
  stream: z.string().max(30).optional(),
});
function pagination(input: unknown, rows = false) {
  const parsed = (rows ? rowsSchema : pageSchema).safeParse(input);
  if (!parsed.success)
    throw new BadRequestException({ code: 'invalid_market_pagination' });
  const v = parsed.data as {
    limit?: string;
    offset?: string;
    afterMs?: string;
    stream?: string;
  };
  const limit = v.limit === undefined ? 100 : Number(v.limit);
  const offset = v.offset === undefined ? 0 : Number(v.offset);
  const after = v.afterMs === undefined ? null : Number(v.afterMs);
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset > 1000000 ||
    (after !== null && !Number.isSafeInteger(after))
  )
    throw new BadRequestException({ code: 'invalid_market_pagination' });
  return { limit, offset, after, stream: v.stream };
}

@Controller('market-data')
@UseFilters(MarketDataFilter)
export class MarketDataController {
  private readonly exportRoot: string;
  constructor(
    @Inject(MarketDataService) private readonly service: MarketDataService,
    @Inject(BybitPublicClient) private readonly client: BybitPublicClient,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.exportRoot = path.join(
      path.resolve(
        config.get<string>('DASHBOARD_ROOT') ??
          fileURLToPath(new URL('../../../../', import.meta.url)),
      ),
      'artifacts',
      'datasets',
    );
  }

  @Get('symbols')
  async symbols() {
    return { items: await this.client.symbols() };
  }

  @Post('downloads')
  create(@Body() body: unknown, @Req() req: LocalRequest) {
    mutationGuard(req);
    return this.service.create(body);
  }

  @Get('downloads')
  async downloads(@Query() query: unknown) {
    const p = pagination(query);
    return marketPublicValue(
      await this.service.downloads(p.limit, p.offset, this.exportRoot),
    );
  }

  @Post('downloads/:id/start')
  @HttpCode(202)
  async start(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: LocalRequest,
  ) {
    mutationGuard(req);
    if (!z.strictObject({}).safeParse(body).success)
      throw new BadRequestException({ code: 'invalid_download_request' });
    return marketPublicValue(await this.service.start(id, this.exportRoot));
  }

  @Get('downloads/:id')
  async download(@Param('id', new ParseUUIDPipe()) id: string) {
    return marketPublicValue(await this.service.download(id));
  }

  @Get('datasets')
  async list(@Query() query: unknown) {
    const p = pagination(query);
    return marketPublicValue(await this.service.list(p.limit, p.offset));
  }

  @Get('datasets/:id')
  async dataset(@Param('id', new ParseUUIDPipe()) id: string) {
    return marketPublicValue(await this.service.getDataset(id));
  }

  @Get('datasets/:id/quality')
  async quality(@Param('id', new ParseUUIDPipe()) id: string) {
    return marketPublicValue(await this.service.quality(id));
  }

  @Get('datasets/:id/candles')
  async candles(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    const p = pagination(query, true);
    if (!p.stream)
      throw new BadRequestException({ code: 'dataset_stream_required' });
    return this.service.candles(id, p.stream, p.limit, p.after);
  }

  @Get('datasets/:id/funding')
  async funding(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    const p = pagination(query, true);
    if (p.stream !== undefined)
      throw new BadRequestException({ code: 'unexpected_funding_stream' });
    return this.service.funding(id, p.limit, p.after);
  }
}
