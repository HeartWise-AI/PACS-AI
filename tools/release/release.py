#!/usr/bin/env python3
"""Prepare immutable release candidates; verify evidence; propose draft PRs only."""
import argparse
import base64
import datetime as dt
import hashlib
import json
import io
import zipfile
import pathlib
import re
import subprocess
import sys
import urllib.parse

POLICY_PATH = 'tools/release/policy.json'
MANIFEST_PATH = '.release/candidate.json'
SHA = r'[0-9a-f]{40}'
DIGEST = r'sha256:[0-9a-f]{64}'


class Blocked(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Blocked(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n'


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def timestamp(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def now():
    return dt.datetime.now(dt.timezone.utc)


def match(pattern, value):
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


def candidate_id(value):
    require(match(r'[a-z0-9][a-z0-9-]{0,39}', value), 'Invalid candidate ID')
    return value


def branch(manifest):
    return 'staging-release-' + candidate_id(manifest['id'])


class GitHub:
    """Use existing gh authentication, never extract a token or print API bodies."""
    def call(self, endpoint, body=None):
        args = ['gh', 'api', '--hostname', 'github.com', endpoint]
        if body is not None:
            args += ['--method', 'POST', '--input', '-']
        result = subprocess.run(args, input=canonical(body) if body is not None else None,
                                capture_output=True, text=True, timeout=90)
        if result.returncode:
            # Only a real 404 can mean absent. Permission/network/rate errors fail closed.
            if 'HTTP 404' in result.stderr:
                raise FileNotFoundError(endpoint)
            raise Blocked('GitHub API request failed: ' + endpoint.split('?')[0])
        return json.loads(result.stdout)

    def attestation(self, repo, artifact):
        args = ['gh', 'api', '--hostname', 'github.com',
                endpoint(repo, f"actions/artifacts/{artifact['id']}/zip")]
        result = subprocess.run(args, capture_output=True, timeout=90)
        require(result.returncode == 0, 'Cannot download trusted attestation')
        require(len(result.stdout) <= 1048576, 'Attestation archive too large')
        require('sha256:' + hashlib.sha256(result.stdout).hexdigest() == artifact['digest'],
                'Attestation archive digest mismatch')
        with zipfile.ZipFile(io.BytesIO(result.stdout)) as archive:
            require(archive.namelist() == ['evidence.json'], 'Unexpected attestation archive contents')
            require(archive.getinfo('evidence.json').file_size <= 65536, 'Attestation too large')
            return json.loads(archive.read('evidence.json'))

    def pages(self, endpoint, key=None):
        result = []
        separator = '&' if '?' in endpoint else '?'
        for page in range(1, 21):
            response = self.call(f'{endpoint}{separator}per_page=100&page={page}')
            values = response[key] if key else response
            require(isinstance(values, list), 'Invalid paginated response')
            result.extend(values)
            if len(values) < 100:
                return result
        raise Blocked('Pagination limit exceeded')


def endpoint(repo, suffix):
    require(match(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo), 'Invalid repository')
    return f'repos/{repo}/{suffix}'


def ref_sha(api, repo, name):
    obj = api.call(endpoint(repo, 'git/ref/heads/' + urllib.parse.quote(name, safe='')))['object']
    require(obj['type'] == 'commit' and match(SHA, obj['sha']), 'Invalid branch object')
    return obj['sha']


def content(api, repo, path, ref):
    require(match(SHA, ref), 'Content must use an immutable commit')
    result = api.call(endpoint(repo, 'contents/' + path + '?ref=' + ref))
    require(result['type'] == 'file' and result['encoding'] == 'base64', 'Expected repository file')
    return base64.b64decode(result['content'], validate=False)


def local_policy():
    policy = json.loads(pathlib.Path(__file__).with_name('policy.json').read_text())
    require(set(policy['components']) == {'frontend', 'backend'}, 'Expected FE and BE policy')
    for component in policy['components'].values():
        endpoint(component['repository'], '')
        require(component['production_branch'] in ('main', 'master'), 'Invalid production branch')
    return policy


def policies(api, policy):
    """Require identical product policy on every current production branch."""
    snapshots = {}
    for component in policy['components'].values():
        repo, production = component['repository'], component['production_branch']
        if repo in snapshots:
            continue
        base = ref_sha(api, repo, production)
        remote = json.loads(content(api, repo, POLICY_PATH, base))
        require(remote == policy, 'Local policy differs from reviewed production policy: ' + repo)
        snapshots[repo] = base
    return snapshots


def source(api, repo, number, production):
    require(type(number) is int and number > 0, 'Invalid PR number')
    pr = api.call(endpoint(repo, f'pulls/{number}'))
    require(pr['state'] == 'open', 'Source PR must remain open')
    require(pr['head']['repo']['full_name'] == repo and pr['base']['repo']['full_name'] == repo,
            'Fork PRs are not release candidates')
    require(pr['base']['ref'] == production, 'Source PR targets the wrong production branch')
    require(not pr['head']['ref'].startswith('staging-release-'), 'Candidate cannot be its own source')
    head = pr['head']['sha']
    require(match(SHA, head), 'Invalid source SHA')
    commit = api.call(endpoint(repo, 'git/commits/' + head))
    return {'repository': repo, 'pr': number, 'sha': head, 'tree': commit['tree']['sha'],
            'production_branch': production}


def prepare(api, policy, release_id, frontend_pr, backend_pr, output):
    candidate_id(release_id)
    bases = policies(api, policy)
    components = {}
    for role, number in [('frontend', frontend_pr), ('backend', backend_pr)]:
        cfg = policy['components'][role]
        item = source(api, cfg['repository'], number, cfg['production_branch'])
        item['base_sha'] = bases[item['repository']]
        ancestry = api.call(endpoint(item['repository'], f"compare/{item['base_sha']}...{item['sha']}"))
        require(ancestry['behind_by'] == 0, 'Source PR must include current production base')
        components[role] = item
    if components['frontend']['repository'] == components['backend']['repository']:
        require(components['frontend'] == components['backend'],
                'Monorepo FE and BE must use the same PR and commit')
    manifest = {'schema': 1, 'id': release_id, 'product': policy['product'],
                'environment': 'agent-staging-' + release_id,
                'policy_sha256': digest(policy), 'components': components}
    path = pathlib.Path(output)
    if path.exists():
        require(json.loads(path.read_text()) == manifest, 'Existing manifest differs; use a new candidate ID')
    else:
        with path.open('x') as handle:
            handle.write(canonical(manifest))
    return manifest


def validate(api, policy, manifest):
    require(set(manifest) == {'schema', 'id', 'product', 'environment', 'policy_sha256', 'components'},
            'Unexpected manifest fields')
    candidate_id(manifest['id'])
    require(manifest['schema'] == 1 and manifest['product'] == policy['product'], 'Wrong product/schema')
    require(manifest['environment'] == 'agent-staging-' + manifest['id'], 'Wrong staging environment')
    require(manifest['policy_sha256'] == digest(policy), 'Policy changed')
    require(set(manifest['components']) == set(policy['components']), 'Missing paired component')
    bases = policies(api, policy)
    seen = {}
    for role, item in manifest['components'].items():
        cfg = policy['components'][role]
        require(item['repository'] == cfg['repository'] and item['production_branch'] == cfg['production_branch'],
                'Component not allowlisted')
        require(item['base_sha'] == bases[item['repository']], 'Production branch drift; prepare a new candidate')
        current = source(api, item['repository'], item['pr'], item['production_branch'])
        require(item == dict(current, base_sha=item['base_sha']), 'Source changed; prepare a new candidate')
        repo = item['repository']
        require(repo not in seen or seen[repo] == item, 'Monorepo components differ')
        seen[repo] = item
    return seen


def expected_tree(api, repo, source_tree, manifest):
    # Reconstruct the packaging tree using Git's content-addressed tree API.
    return api.call(endpoint(repo, 'git/trees'), {
        'base_tree': source_tree,
        'tree': [{'path': MANIFEST_PATH, 'mode': '100644', 'type': 'blob', 'content': canonical(manifest)}]
    })['sha']


def package_integrity(api, repo, item, manifest, candidate_sha):
    commit = api.call(endpoint(repo, 'git/commits/' + candidate_sha))
    require([p['sha'] for p in commit['parents']] == [item['sha']], 'Candidate has unexpected parents')
    require(content(api, repo, MANIFEST_PATH, candidate_sha).decode() == canonical(manifest),
            'Manifest tampering detected')
    # Read-only compare, including changes hidden by a multi-commit history.
    comparison = api.call(endpoint(repo, f"compare/{item['sha']}...{candidate_sha}"))
    require(comparison['ahead_by'] == 1 and comparison['behind_by'] == 0 and
            comparison['total_commits'] == 1, 'Candidate is not a single packaging commit')
    files = comparison['files']
    require(len(files) == 1 and files[0]['filename'] == MANIFEST_PATH and
            files[0]['status'] in ('added', 'modified'), 'Packaging changed application contents')
    return candidate_sha


def candidates(api, policy, manifest, create=False):
    items = validate(api, policy, manifest)
    result = {}
    # Preflight every existing ref before creating any missing ref.
    missing = []
    for repo, item in items.items():
        try:
            sha = ref_sha(api, repo, branch(manifest))
        except FileNotFoundError:
            require(create, 'Candidate branch missing: ' + repo)
            missing.append(repo)
        else:
            result[repo] = package_integrity(api, repo, item, manifest, sha)
    for repo in missing:
        item = items[repo]
        tree = expected_tree(api, repo, item['tree'], manifest)
        # Fixed identity/date makes retries create the same immutable Git object.
        identity = {'name': 'Release candidate packaging', 'email': 'release-candidate@users.noreply.github.com',
                    'date': '2000-01-01T00:00:00Z'}
        commit = api.call(endpoint(repo, 'git/commits'), {
            'message': 'chore(release): package candidate ' + manifest['id'],
            'tree': tree, 'parents': [item['sha']], 'author': identity, 'committer': identity})
        try:
            api.call(endpoint(repo, 'git/refs'), {'ref': 'refs/heads/' + branch(manifest), 'sha': commit['sha']})
        except Blocked:
            # A concurrent identical create is safe; never update/force an existing ref.
            require(ref_sha(api, repo, branch(manifest)) == commit['sha'], 'Concurrent divergent candidate')
        result[repo] = package_integrity(api, repo, item, manifest, ref_sha(api, repo, branch(manifest)))
    return result


def approvals(api, repo, production):
    environment = api.call(endpoint(repo, 'environments/production'))
    rules = environment['protection_rules']
    require(environment.get('can_admins_bypass') is False, 'Production environment permits admin bypass')
    require(any(r['type'] == 'required_reviewers' and r.get('prevent_self_review') is True and
                r.get('reviewers') for r in rules), 'Production requires independent human environment approval')
    effective = api.pages(endpoint(repo, 'rules/branches/' + production))
    require(any(r['type'] == 'pull_request' and
                r['parameters'].get('required_approving_review_count', 0) >= 1 and
                r['parameters'].get('dismiss_stale_reviews_on_push') and
                r['parameters'].get('require_last_push_approval') for r in effective),
            'Production requires fresh independent PR review')
    require(any(r['type'] == 'required_status_checks' and
                r['parameters'].get('strict_required_status_checks_policy') and
                any(c['context'] == 'Release promotion gate' and c.get('integration_id') == 15368
                    for c in r['parameters']['required_status_checks']) for r in effective),
            'Production requires strict GitHub Actions Release promotion gate')


def successful(run, message):
    require(run.get('status') == 'completed' and run.get('conclusion') == 'success', message)


def fresh(value, hours):
    age = (now() - timestamp(value)).total_seconds()
    require(0 <= age <= hours * 3600, 'Stale or future evidence')


def verify(api, policy, manifest, evidence):
    staging = policy['staging']
    require(staging['enabled'] is True,
            'Staging unavailable: ' + '; '.join(staging['prerequisites']))
    require(staging['workflow'].startswith('.github/workflows/') and
            match(r'[A-Za-z0-9_-]+\.ya?ml', staging['workflow'].split('/')[-1]), 'Invalid trusted workflow')
    require(staging['jobs'] and staging['actors'], 'Trusted jobs/actors missing')
    heads = candidates(api, policy, manifest)
    require(set(evidence) == set(heads), 'Evidence must cover every paired repository')
    records = {}
    for repo, head in heads.items():
        item = next(c for c in manifest['components'].values() if c['repository'] == repo)
        approvals(api, repo, item['production_branch'])
        workflow = api.call(endpoint(repo, 'actions/workflows/' + staging['workflow'].split('/')[-1]))
        require(workflow['state'] == 'active' and workflow['path'] == staging['workflow'], 'Untrusted workflow')
        require(content(api, repo, staging['workflow'], item['base_sha']) ==
                content(api, repo, staging['workflow'], head), 'Candidate changed trusted workflow')
        # Trust boundary includes the policy, engine and all adapter files, not just YAML.
        for path in staging['trusted_paths']:
            require(content(api, repo, path, item['base_sha']) == content(api, repo, path, head),
                    'Candidate changed trusted deployment code')
        record = evidence[repo]
        require(set(record) == {'run_id', 'deployment_id'}, 'Evidence accepts IDs only, never passed assertions')
        require(all(type(v) is int and v > 0 for v in record.values()), 'Invalid evidence IDs')
        run_id = record['run_id']
        run = api.call(endpoint(repo, f'actions/runs/{run_id}'))
        successful(run, 'Run failed, skipped, cancelled or incomplete')
        require(run['workflow_id'] == workflow['id'] and run['path'] == staging['workflow'] and
                run['event'] == 'workflow_dispatch' and run['head_sha'] == head and
                run['head_branch'] == branch(manifest) and run['run_attempt'] == 1 and
                run['repository']['full_name'] == repo and run['head_repository']['full_name'] == repo,
                'Run identity, attempt or source mismatch')
        require(run['actor']['login'] in staging['actors'] and run['triggering_actor']['login'] in staging['actors'],
                'Untrusted run actor')
        fresh(run['updated_at'], staging['max_age_hours'])
        jobs = api.pages(endpoint(repo, f'actions/runs/{run_id}/attempts/1/jobs'), 'jobs')
        require(sorted(j['name'] for j in jobs) == sorted(staging['jobs']), 'Missing or unexpected jobs')
        for job in jobs:
            successful(job, 'Unsuccessful job')
            require(job['head_sha'] == head and job['steps'], 'Job source/steps missing')
            for step in job['steps']:
                successful(step, 'Skipped, failed or incomplete step')
        artifacts = api.pages(endpoint(repo, f'actions/runs/{run_id}/artifacts'), 'artifacts')
        matches = [a for a in artifacts if a['name'] == 'staging-evidence-' + digest(manifest)]
        require(len(matches) == 1, 'Missing or ambiguous staging evidence artifact')
        artifact = matches[0]
        require(artifact['expired'] is False and match(DIGEST, artifact.get('digest')) and
                artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == head,
                'Artifact expired or digest/source missing')
        require(timestamp(artifact['expires_at']) > now(), 'Artifact expired')
        deployment_id = record['deployment_id']
        deployment = api.call(endpoint(repo, f'deployments/{deployment_id}'))
        require(deployment['environment'] == manifest['environment'] and deployment['sha'] == head and
                deployment['production_environment'] is False and deployment['transient_environment'] is True and
                deployment['creator']['login'] == 'github-actions[bot]' and deployment['task'] == 'deploy',
                'Wrong staging deployment identity')
        payload = deployment['payload']
        attestation = api.attestation(repo, artifact)
        require(attestation == {k: v for k, v in payload.items() if k not in ('artifact_id', 'artifact_digest')},
                'Deployment does not match trusted artifact attestation')
        require(payload['manifest_sha256'] == digest(manifest) and payload['run_id'] == run_id and
                payload['run_attempt'] == 1 and payload['artifact_id'] == artifact['id'] and
                payload['artifact_digest'] == artifact['digest'], 'Deployment/artifact/manifest mismatch')
        expected_roles = {image for r, c in manifest['components'].items() if c['repository'] == repo
                          for image in policy['components'][r]['images']}
        require(set(payload['images']) == expected_roles and
                all(match(DIGEST, image) for image in payload['images'].values()), 'Missing immutable images')
        statuses = api.pages(endpoint(repo, f'deployments/{deployment_id}/statuses'))
        require(statuses and statuses[0]['state'] == 'success' and
                statuses[0]['creator']['login'] == 'github-actions[bot]' and
                statuses[0]['log_url'] == f'https://github.com/{repo}/actions/runs/{run_id}',
                'Deployment not successful or not attested by trusted run')
        fresh(statuses[0]['updated_at'], staging['max_age_hours'])
        latest = api.pages(endpoint(repo, 'deployments?environment=' + manifest['environment']))
        require(latest and latest[0]['id'] == deployment_id, 'Staging deployment superseded')
        records[repo] = {'candidate_sha': head, 'run_id': run_id, 'run_attempt': 1,
                         'deployment_id': deployment_id, 'artifact_id': artifact['id'],
                         'artifact_digest': artifact['digest'], 'images': payload['images']}
    # Re-read after slow evidence calls so source movement and reruns invalidate the decision.
    require(candidates(api, policy, manifest) == heads, 'Candidate moved while verifying')
    for repo, record in records.items():
        run = api.call(endpoint(repo, f"actions/runs/{record['run_id']}"))
        successful(run, 'Run changed while verifying')
        require(run['run_attempt'] == 1, 'Run was rerun while verifying')
    return {'manifest_sha256': digest(manifest), 'verified_at': now().isoformat(), 'repositories': records}


def promote(api, policy, manifest, evidence):
    verified = verify(api, policy, manifest, evidence)
    urls = []
    for repo in verified['repositories']:
        # Each PR creation rechecks both components, not just the current repository.
        verify(api, policy, manifest, evidence)
        item = next(c for c in manifest['components'].values() if c['repository'] == repo)
        query = urllib.parse.urlencode({'state': 'open', 'head': repo.split('/')[0] + ':' + branch(manifest),
                                        'base': item['production_branch']})
        existing = api.pages(endpoint(repo, 'pulls?' + query))
        if existing:
            require(len(existing) == 1 and existing[0]['head']['sha'] == verified['repositories'][repo]['candidate_sha'],
                    'Existing promotion PR diverged')
            require(existing[0]['draft'] is True, 'Existing PR is no longer a draft; human owns promotion')
            urls.append(existing[0]['html_url'])
            continue
        result = api.call(endpoint(repo, 'pulls'), {
            'title': 'Release candidate ' + manifest['id'], 'head': branch(manifest),
            'base': item['production_branch'], 'draft': True,
            'body': 'Human production review required. Revalidate the paired candidate immediately before merge.\n\n'
                    'Manifest SHA-256: `' + digest(manifest) + '`\n\n'
                    'Use the tested image digests recorded below. No rebuild or floating tags.\n\n'
                    '```json\n' + json.dumps(verified, indent=2) + '\n```'})
        urls.append(result['html_url'])
    return {'draft_pull_requests': urls}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare', help='Snapshot paired open PRs into a local immutable manifest')
    prep.add_argument('--id', required=True)
    prep.add_argument('--frontend-pr', type=int, required=True)
    prep.add_argument('--backend-pr', type=int, required=True)
    prep.add_argument('--output', required=True)
    for name in ('candidate', 'inspect', 'verify', 'promote'):
        sub = commands.add_parser(name)
        sub.add_argument('--manifest', required=True)
        if name in ('verify', 'promote'):
            sub.add_argument('--evidence', required=True, help='Repository keys with run_id/deployment_id only')
    args = parser.parse_args()
    api, policy = GitHub(), local_policy()
    try:
        if args.command == 'prepare':
            result = prepare(api, policy, args.id, args.frontend_pr, args.backend_pr, args.output)
        else:
            manifest = json.loads(pathlib.Path(args.manifest).read_text())
            if args.command in ('candidate', 'inspect'):
                result = candidates(api, policy, manifest, create=args.command == 'candidate')
            else:
                evidence = json.loads(pathlib.Path(args.evidence).read_text())
                result = (verify if args.command == 'verify' else promote)(api, policy, manifest, evidence)
        print(json.dumps(result, indent=2))
    except (Blocked, FileNotFoundError, KeyError, ValueError, TypeError, subprocess.TimeoutExpired, zipfile.BadZipFile) as error:
        # Do not print potentially sensitive API/JSON bodies.
        message = str(error) if isinstance(error, Blocked) else type(error).__name__ + ': missing or invalid input/API data'
        print('BLOCKED: ' + message, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
