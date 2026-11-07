import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Inject,
  UseFilters,
  Catch,
  HttpException,
  ForbiddenException,
  BadRequestException,
  ParseUUIDPipe,
  type ExceptionFilter,
  type ArgumentsHost,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import {
  dashboardStartSchema,
  dashboardProposalSchema,
} from '@bybit/contracts';
import { QuantBridge } from './quant-bridge.service.js';
import { ResearchConfigurationsService } from '../research-configurations/configurations.service.js';
import { MarketDataService } from '../market-data/market-data.service.js';

@Catch()
class ResearchFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(value: unknown): void } }>();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
    } else response.status(503).json({ code: 'research_service_unavailable' });
  }
}
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const pages = z.strictObject({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({ code: 'invalid_research_request' });
  return result.data;
}
type LocalRequest = { headers: Record<string, string | string[] | undefined> };
export function researchMutationGuard(request: LocalRequest) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin !== undefined) {
    try {
      const url = new URL(String(origin));
      if (url.host !== host || !['http:', 'https:'].includes(url.protocol))
        throw new Error();
    } catch {
      throw new ForbiddenException({ code: 'cross_origin_mutation_forbidden' });
    }
  }
}

@Controller('research')
@UseFilters(ResearchFilter)
export class ResearchController {
  constructor(
    @Inject(QuantBridge) private readonly quant: QuantBridge,
    @Inject(ResearchConfigurationsService)
    private readonly configs: ResearchConfigurationsService,
    @Inject(MarketDataService) private readonly market: MarketDataService,
  ) {}
  @Get('catalog') catalog(@Query() query: unknown) {
    return this.quant.call('catalog', parse(pages, query));
  }
  @Get('datasets/:id') dataset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    const p = parse(
      pages.extend({
        stream: z
          .string()
          .regex(/^(last|mark|index):(1m|3m|5m|15m|30m|1h|4h|1D)$/)
          .default('last:1m'),
      }),
      query,
    );
    return this.quant.call('dataset', { id, ...p });
  }
  @Get('jobs/:id') job(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.quant.call('job', { id });
  }
  @Post('jobs') async start(@Body() body: unknown, @Req() req: LocalRequest) {
    researchMutationGuard(req);
    const b = parse(dashboardStartSchema, body);
    const snapshot = await this.configs.getSnapshot(b.snapshot_id);
    const dataset = await this.market.getDataset(b.dataset_id);
    if (dataset.status !== 'READY')
      throw new BadRequestException({ code: 'sealed_dataset_required' });
    const source = await this.configs.getSnapshot(dataset.snapshotId);
    return this.quant.call('start', {
      ...b,
      configuration: snapshot.payload,
      source_snapshot: {
        id: source.id,
        config_hash: source.configHash,
        configuration: source.payload,
      },
      dataset_fingerprint: dataset.fingerprint,
    });
  }
  @Post('jobs/:id/cancel') cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: LocalRequest,
  ) {
    researchMutationGuard(req);
    parse(z.strictObject({}), body);
    return this.quant.call('cancel', { id });
  }
  @Get('models/:id') model(@Param('id') id: string) {
    return this.quant.call('model', { id: parse(hash, id) });
  }
  @Get('evaluations/:id') evaluation(@Param('id') id: string) {
    return this.quant.call('evaluation', { id: parse(hash, id) });
  }
  @Get('baselines/:id') baseline(@Param('id') id: string) {
    return this.quant.call('baseline', { id: parse(hash, id) });
  }
  @Get('simulations/:id') simulation(
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    const p = parse(
      pages.extend({
        kind: z.enum(['equity', 'trades']).default('equity'),
        model_id: hash.optional(),
      }),
      query,
    );
    return this.quant.call('simulation', { id: parse(hash, id), ...p });
  }
  @Get('deployment-proposals') proposals(@Query() query: unknown) {
    return this.quant.call('proposals', parse(pages, query));
  }
  @Post('deployment-proposals') propose(
    @Body() body: unknown,
    @Req() req: LocalRequest,
  ) {
    researchMutationGuard(req);
    return this.quant.call('propose', parse(dashboardProposalSchema, body));
  }
  @Post('activate') activate(@Req() req: LocalRequest) {
    researchMutationGuard(req);
    throw new ForbiddenException({
      code: 'execution_not_available_in_research_dashboard',
    });
  }
}
