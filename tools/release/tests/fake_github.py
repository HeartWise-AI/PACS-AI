"""Disposable Git-backed GitHub API fixture. Never contacts a network."""
import base64
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse
import zipfile


def git(path, *args, input=None):
    return subprocess.check_output(['git', '-C', path, *args], input=input, text=True).strip()


def main():
    args = sys.argv[1:]
    url = args[args.index('github.com') + 1]
    parsed = urllib.parse.urlsplit(url)
    parts = parsed.path.split('/')
    repo, suffix = '/'.join(parts[1:3]), '/'.join(parts[3:])
    query = urllib.parse.parse_qs(parsed.query)
    state_path = Path(os.environ['FAKE_GITHUB_STATE'])
    state = json.loads(state_path.read_text())
    state.setdefault('calls', []).append({'url': url, 'write': '--method' in args})
    state_path.write_text(json.dumps(state))
    if url in state.get('missing', []):
        print('HTTP 404', file=sys.stderr)
        return 1
    if url in state.get('fail', []):
        print('HTTP 403', file=sys.stderr)
        return 1
    if url in state.get('responses', {}):
        print(json.dumps(state['responses'][url]))
        return 0
    data = state['repos'][repo]
    path = data['path']
    body = json.load(sys.stdin) if '--method' in args else None
    result = None
    if suffix.startswith('git/ref/heads/'):
        ref = urllib.parse.unquote(suffix[len('git/ref/heads/'):])
        p = subprocess.run(['git', '-C', path, 'rev-parse', '--verify', 'refs/heads/' + ref], capture_output=True, text=True)
        if p.returncode:
            print('HTTP 404', file=sys.stderr)
            return 1
        result = {'object': {'type': 'commit', 'sha': p.stdout.strip()}}
    elif suffix.startswith('contents/'):
        file = suffix[len('contents/'):]
        p = subprocess.run(['git', '-C', path, 'show', query['ref'][0] + ':' + file], capture_output=True)
        if p.returncode:
            print('HTTP 404', file=sys.stderr)
            return 1
        result = {'type': 'file', 'encoding': 'base64', 'content': base64.b64encode(p.stdout).decode()}
    elif suffix.startswith('git/commits/'):
        sha = suffix.split('/')[-1]
        result = {'sha': sha, 'tree': {'sha': git(path, 'rev-parse', sha + '^{tree}')},
                  'parents': [{'sha': x} for x in git(path, 'show', '-s', '--format=%P', sha).split()]}
    elif suffix.startswith('compare/'):
        first, last = suffix[len('compare/'):].split('...')
        result = {'ahead_by': int(git(path, 'rev-list', '--count', first + '..' + last)),
                  'behind_by': int(git(path, 'rev-list', '--count', last + '..' + first)),
                  'total_commits': int(git(path, 'rev-list', '--count', first + '..' + last)),
                  'files': [{'filename': line.split('\t')[-1], 'status': 'added' if line[0] == 'A' else 'modified'}
                            for line in git(path, 'diff', '--name-status', first, last).splitlines()]}
    elif suffix == 'git/trees':
        index = str(Path(path) / '.git' / 'candidate-index')
        os.environ['GIT_INDEX_FILE'] = index
        git(path, 'read-tree', body['base_tree'])
        for entry in body['tree']:
            blob = git(path, 'hash-object', '-w', '--stdin', input=entry['content'])
            git(path, 'update-index', '--add', '--cacheinfo', entry['mode'], blob, entry['path'])
        result = {'sha': git(path, 'write-tree')}
    elif suffix == 'git/commits':
        for key in ['author', 'committer']:
            for field in ['name', 'email', 'date']:
                os.environ['GIT_' + key.upper() + '_' + field.upper()] = body[key][field]
        sha = git(path, 'commit-tree', body['tree'], '-p', body['parents'][0], input=body['message'] + '\n')
        result = {'sha': sha}
    elif suffix == 'git/refs':
        p = subprocess.run(['git', '-C', path, 'update-ref', body['ref'], body['sha'], '0' * 40], capture_output=True)
        if p.returncode:
            print('HTTP 422', file=sys.stderr)
            return 1
        result = {'object': {'sha': body['sha']}}
    elif suffix.startswith('pulls/') and suffix.endswith('/reviews'):
        result = data.get('reviews', [])
    elif suffix.startswith('pulls/'):
        number = suffix.split('/')[-1]
        result = data['pulls'][number]
    elif suffix == 'pulls':
        if body:
            result = {'html_url': 'https://github.com/' + repo + '/pull/99', 'draft': body['draft'],
                      'number': 99, 'state': 'open', 'user': {'login': 'author'},
                      'head': {'sha': git(path, 'rev-parse', body['head']), 'repo': {'full_name': repo}},
                      'base': {'ref': body['base'], 'repo': {'full_name': repo}}}
            data.setdefault('promotion_prs', []).append(result)
            state_path.write_text(json.dumps(state))
        else:
            result = [p for p in data.get('promotion_prs', []) if p['state'] == query.get('state', ['open'])[0]]
    elif suffix == 'environments/production':
        result = {'can_admins_bypass': False, 'protection_rules': [
            {'type': 'required_reviewers', 'prevent_self_review': True, 'reviewers': [{'reviewer': {'login': 'human'}}]}]}
    elif suffix.startswith('rules/branches/'):
        result = [{'type': 'pull_request', 'parameters': {'required_approving_review_count': 1,
                    'dismiss_stale_reviews_on_push': True, 'require_last_push_approval': True}},
                  {'type': 'required_status_checks', 'parameters': {'strict_required_status_checks_policy': True,
                    'required_status_checks': [{'context': 'Release promotion gate', 'integration_id': 15368}]}}]
    elif suffix.startswith('actions/artifacts/') and suffix.endswith('/zip'):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            entry = zipfile.ZipInfo('evidence.json', date_time=(2020, 1, 1, 0, 0, 0))
            archive.writestr(entry, json.dumps(data['attestation'], sort_keys=True))
        sys.stdout.buffer.write(stream.getvalue())
        return 0
    else:
        result = data['api'][suffix]
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    with open(os.environ['FAKE_GITHUB_STATE'] + '.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        sys.exit(main())
