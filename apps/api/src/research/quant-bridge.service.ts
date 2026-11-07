import {
  Injectable,
  Inject,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

@Injectable()
export class QuantBridge {
  readonly root: string;
  private readonly python: string;
  constructor(@Inject(ConfigService) config: ConfigService) {
    const repository = fileURLToPath(new URL('../../../../', import.meta.url));
    this.root = path.resolve(
      config.get<string>('DASHBOARD_ROOT') ?? repository,
    );
    this.python = path.resolve(
      repository,
      config.get<string>('PYTHON_PATH') ??
        'services/quant/.venv/Scripts/python.exe',
    );
  }

  async call<T = unknown>(
    operation: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const cache = path.join(this.root, '.runtime', 'matplotlib-cache');
    await mkdir(cache, { recursive: true });
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.python,
        ['-m', 'bybit_quant.dashboard', '--root', this.root],
        {
          cwd: this.root,
          windowsHide: true,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            MPLCONFIGDIR: cache,
            PYTHONUTF8: '1',
            OMP_NUM_THREADS: '1',
          },
        },
      );
      let output = '',
        size = 0,
        settled = false;
      const finish = (error?: Error, value?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value as T);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(
          new ServiceUnavailableException({ code: 'quant_request_timeout' }),
        );
      }, 120000);
      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          child.kill();
          finish(
            new ServiceUnavailableException({ code: 'quant_response_limit' }),
          );
        } else output += chunk.toString('utf8');
      });
      child.stderr.on('data', () => {
        /* Deliberately do not expose Python/runtime paths or raw stderr. */
      });
      child.on('error', () =>
        finish(
          new ServiceUnavailableException({ code: 'quant_worker_unavailable' }),
        ),
      );
      child.on('close', (code) => {
        if (code !== 0) {
          finish(
            code === 2
              ? new NotFoundException({ code: 'research_artifact_not_found' })
              : code === 3
                ? new ConflictException({ code: 'training_worker_busy' })
                : new BadRequestException({
                    code: 'invalid_or_unavailable_research_artifact',
                  }),
          );
          return;
        }
        try {
          finish(undefined, JSON.parse(output) as T);
        } catch {
          finish(
            new ServiceUnavailableException({ code: 'invalid_quant_response' }),
          );
        }
      });
      child.stdin.on('error', () => {
        /* close/error handles failed process admission */
      });
      child.stdin.end(JSON.stringify({ operation, args }));
    });
  }
}
