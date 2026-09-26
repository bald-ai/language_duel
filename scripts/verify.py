#!/usr/bin/env python3
"""Run all ordinary verification checks or selected checks; stop on failure."""
import argparse
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CHECKS = {
    'lint': ['npm', 'run', 'lint'],
    'typecheck': ['npm', 'run', 'typecheck', '--', '--incremental', 'false'],
    'convex': ['npm', 'exec', '--', 'tsc', '--noEmit', '--incremental', 'false', '-p', 'convex/tsconfig.json'],
    'tests': ['npm', 'run', 'test:run'],
    'tooling': ['python3', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'],
}


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog='Examples: npm run verify | npm run verify -- lint typecheck | npm run verify -- tests',
    )
    parser.add_argument('checks', nargs='*', metavar='CHECK',
                        help='all (default), or one or more of: ' + ', '.join(CHECKS))
    selected = parser.parse_args(argv).checks or ['all']
    if 'all' in selected and len(selected) != 1:
        parser.error('Use all alone, or name individual checks.')
    unknown = set(selected) - {'all', *CHECKS}
    if unknown:
        parser.error('Unknown check(s): ' + ', '.join(sorted(unknown)))
    selected = list(CHECKS) if selected == ['all'] else list(dict.fromkeys(selected))
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
    for name in selected:
        print(f'\n=== {name} ===', flush=True)
        try:
            result = subprocess.run(CHECKS[name], cwd=ROOT, env=env, check=False)
        except OSError as error:
            print(f'FAILED {name}: {error}', flush=True)
            return 1
        if result.returncode:
            print(f'FAILED {name}; remaining checks were not run.', flush=True)
            return result.returncode if result.returncode > 0 else 128 - result.returncode
        print(f'PASSED {name}', flush=True)
    print('\nPassed: ' + ', '.join(selected), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
