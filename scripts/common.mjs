import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { parseEnv } from 'node:util';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const tools = path.join(root, '.tools');
export const runtime = path.join(root, '.runtime');
export const node = path.join(tools, 'node', 'node.exe');
export const uv = path.join(tools, 'uv', 'uv.exe');
export const python = path.join(
  root,
  'services',
  'quant',
  '.venv',
  'Scripts',
  'python.exe',
);
export const api = path.join(root, 'apps', 'api');
export const quant = path.join(root, 'services', 'quant');
export const toolchain = JSON.parse(
  fs.readFileSync(path.join(root, 'toolchain.json'), 'utf8'),
);

export function environment(extra = {}) {
  const envPath = path.join(root, '.env');
  const local = fs.existsSync(envPath)
    ? parseEnv(fs.readFileSync(envPath, 'utf8'))
    : {};
  return {
    ...local,
    ...process.env,
    PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH ?? ''}`,
    UV_CACHE_DIR: path.join(tools, 'uv-cache'),
    UV_PYTHON_INSTALL_DIR: path.join(tools, 'python'),
    UV_PYTHON_BIN_DIR: path.join(tools, 'python-bin'),
    UV_NO_MODIFY_PATH: '1',
    SWC_NATIVE_BINDING_CACHE: path.join(tools, 'swc-cache'),
    RUFF_CACHE_DIR: path.join(tools, 'ruff-cache'),
    npm_config_cache: path.join(tools, 'npm-cache'),
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    CHECKPOINT_DISABLE: '1',
    ...extra,
  };
}

export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: environment(options.env),
      windowsHide: true,
      shell: false,
      stdio: options.quiet
        ? 'ignore'
        : options.capture
          ? ['ignore', 'pipe', 'pipe']
          : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !options.allowFailure) {
        // Captured dependency output may contain URLs/passwords: do not echo it.
        reject(
          new Error(
            `${path.basename(command)} failed (exit ${code}); inspect local logs if applicable`,
          ),
        );
      } else {
        resolve({ code, stdout, stderr });
      }
    });
  });
}

export function npm(args, options) {
  return run(
    node,
    [
      path.join(tools, 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      ...args,
    ],
    options,
  );
}

export function prisma(args, env = {}) {
  return run(
    node,
    [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), ...args],
    { cwd: api, env },
  );
}
