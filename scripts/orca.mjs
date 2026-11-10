import { execFileSync } from 'node:child_process';
const executable = process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? 'orca-dev' : process.platform === 'linux' ? 'orca-ide' : 'orca');
execFileSync(executable, ['plugin', ...process.argv.slice(2), '--json'], { stdio: 'inherit' });
