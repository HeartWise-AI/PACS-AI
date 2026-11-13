#!/usr/bin/env python3
"""Build native Dockerfiles without credentials, publication or deployment."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from release import Blocked, canonical, digest, require


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def package():
    root = Path(run('git', 'rev-parse', '--show-toplevel'))
    require(Path.cwd() == root, 'Run from repository root')
    require(not run('git', 'status', '--porcelain', '--untracked-files=all'), 'Build requires a clean checkout')
    manifest = json.loads((root / '.release/candidate.json').read_text())
    require(os.environ.get('GITHUB_REF_NAME') == 'staging-release-' + manifest['id'], 'Select the candidate branch')
    require(os.environ.get('GITHUB_SHA') == run('git', 'rev-parse', 'HEAD'), 'Workflow SHA mismatch')
    repository = os.environ['GITHUB_REPOSITORY']
    components = [c for c in manifest['components'].values() if c['repository'] == repository]
    require(components and len({c['sha'] for c in components}) == 1, 'Wrong repository or inconsistent source pair')
    source_sha = components[0]['sha']
    require(run('git', 'rev-parse', 'HEAD^') == source_sha, 'Packaging parent differs from source')
    require(run('git', 'diff', '--name-only', 'HEAD^', 'HEAD') == '.release/candidate.json', 'Packaging changed app')
    recipes = json.loads((root / 'tools/release/build.json').read_text())
    output = Path(os.environ['RUNNER_TEMP']) / 'candidate-build'
    output.mkdir(exist_ok=False)
    records = {}
    # Export tracked source only: no local ignored secrets, caches, or untracked inputs.
    with tempfile.TemporaryDirectory(prefix='candidate-source-') as scratch:
        archive = Path(scratch) / 'source.tar'
        with archive.open('wb') as handle:
            subprocess.run(['git', 'archive', '--format=tar', source_sha], stdout=handle, check=True)
        source = (Path(scratch) / 'source').resolve()
        source.mkdir()
        subprocess.run(['tar', '-xf', str(archive), '-C', str(source)], check=True)
        for name, recipe in recipes['images'].items():
            require(re.fullmatch('[a-z][a-z0-9-]*', name), 'Unsafe image name')
            context = (source / recipe['context']).resolve()
            dockerfile = (source / recipe['dockerfile']).resolve()
            require(context.is_relative_to(source) and dockerfile.is_relative_to(source), 'Build path escapes source')
            image_tag = 'candidate-' + name + ':' + manifest['id']
            iid = output / (name + '.iid')
            command = ['docker', 'build', '--platform', 'linux/amd64', '--iidfile', str(iid),
                       '--tag', image_tag, '--file', str(dockerfile)]
            for key, value in recipe.get('args', {}).items():
                require(re.fullmatch('[A-Z][A-Z0-9_]*', key), 'Unsafe build argument')
                command += ['--build-arg', key + '=' + value]
            command.append(str(context))
            subprocess.run(command, check=True)
            image_id = iid.read_text().strip()
            require(re.fullmatch('sha256:[0-9a-f]{64}', image_id), 'Missing image ID')
            image_file = output / (name + '.tar')
            subprocess.run(['docker', 'save', '--output', str(image_file), image_id], check=True)
            checksum = hashlib.sha256()
            with image_file.open('rb') as handle:
                for block in iter(lambda: handle.read(1048576), b''):
                    checksum.update(block)
            records[name] = {'image_id': image_id, 'archive_sha256': checksum.hexdigest(),
                             'source_sha': source_sha, 'dockerfile': recipe['dockerfile']}
    (output / 'build.json').write_text(canonical({
        'kind': 'build-only', 'manifest_sha256': digest(manifest),
        'candidate_sha': os.environ['GITHUB_SHA'], 'run_id': os.environ['GITHUB_RUN_ID'],
        'run_attempt': os.environ['GITHUB_RUN_ATTEMPT'], 'images': records,
        'unpackaged_prerequisites': recipes.get('prerequisites', [])}))
    print('Build-only artifacts: ' + str(output))
    print('No staging deployment or E2E evidence was produced.')


if __name__ == '__main__':
    try:
        package()
    except (Blocked, KeyError, ValueError, OSError, subprocess.CalledProcessError) as error:
        print('Build blocked: ' + (str(error) if isinstance(error, Blocked) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
