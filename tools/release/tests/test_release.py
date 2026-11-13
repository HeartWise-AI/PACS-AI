import base64
import copy
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import release
from fake_github import git


class ReleaseCLI(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.tool = self.root / 'release.py'
        shutil.copy(Path(release.__file__), self.tool)
        self.policy = copy.deepcopy(release.local_policy())
        # Synthetic repositories, actors and policy. Never a real staged deployment.
        self.policy['components'] = {
            'frontend': {'repository': 'fixture/frontend', 'production_branch': 'main', 'images': ['frontend']},
            'backend': {'repository': 'fixture/backend', 'production_branch': 'master', 'images': ['api']}}
        self.policy['staging']['enabled'] = True
        self.policy['staging']['actors'] = ['human']
        self.state = {'repos': {}, 'responses': {}}
        for name, cfg in self.policy['components'].items():
            path = self.root / name
            path.mkdir()
            subprocess.run(['git', 'init', '-q', '-b', cfg['production_branch'], str(path)], check=True)
            git(str(path), 'config', 'user.email', 'test@example.invalid')
            git(str(path), 'config', 'user.name', 'Test')
            for file in ['tools/release/policy.json', 'tools/release/release.py', self.policy['staging']['workflow']]:
                target = path / file
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(self.policy) if file.endswith('policy.json') else 'trusted code\n')
            git(str(path), 'add', '.')
            git(str(path), 'commit', '-qm', 'base')
            base = git(str(path), 'rev-parse', 'HEAD')
            git(str(path), 'checkout', '-qb', 'feature')
            (path / 'app.txt').write_text('application change\n')
            git(str(path), 'add', '.')
            git(str(path), 'commit', '-qm', 'feature')
            sha = git(str(path), 'rev-parse', 'HEAD')
            self.state['repos'][cfg['repository']] = {'path': str(path), 'base': base,
                'pulls': {'1': {'state': 'open', 'head': {'repo': {'full_name': cfg['repository']}, 'ref': 'feature', 'sha': sha},
                                'base': {'repo': {'full_name': cfg['repository']}, 'ref': cfg['production_branch']}}}}
        (self.root / 'policy.json').write_text(json.dumps(self.policy))
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        fake = bin_dir / 'gh'
        fake.write_text('#!' + sys.executable + '\nimport runpy\nrunpy.run_path(' +
                        repr(str(Path(__file__).with_name('fake_github.py'))) + ', run_name="__main__")\n')
        fake.chmod(0o755)
        self.state_path = self.root / 'github.json'
        self.env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'],
                        FAKE_GITHUB_STATE=str(self.state_path))
        self.manifest_path = self.root / 'manifest.json'
        self.evidence_path = self.root / 'evidence.json'
        self.save()

    def save(self):
        self.state_path.write_text(json.dumps(self.state))

    def reload(self):
        self.state = json.loads(self.state_path.read_text())

    def cli(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(self.tool), *args], env=self.env,
                                capture_output=True, text=True)
        self.reload()
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn('BLOCKED:', result.stderr)
        return result

    def prepare(self, release_id='rc1', ok=True):
        return self.cli('prepare', '--id', release_id, '--frontend-pr', '1', '--backend-pr', '1',
                        '--output', str(self.manifest_path), ok=ok)

    def candidate(self, ok=True):
        return self.cli('candidate', '--manifest', str(self.manifest_path), ok=ok)

    def check(self, command='verify', ok=True):
        return self.cli(command, '--manifest', str(self.manifest_path), '--evidence', str(self.evidence_path), ok=ok)

    def ready(self):
        self.prepare()
        self.candidate()
        manifest = json.loads(self.manifest_path.read_text())
        self.evidence_path.write_text(json.dumps({r: {'run_id': 42, 'deployment_id': 7} for r in self.state['repos']}))
        for repo, data in self.state['repos'].items():
            head = git(data['path'], 'rev-parse', 'staging-release-rc1')
            date = release.now().isoformat()
            run = {'id': 42, 'status': 'completed', 'conclusion': 'success', 'workflow_id': 5,
                   'path': self.policy['staging']['workflow'], 'event': 'workflow_dispatch', 'head_sha': head,
                   'head_branch': 'staging-release-rc1', 'run_attempt': 1, 'repository': {'full_name': repo},
                   'head_repository': {'full_name': repo}, 'actor': {'login': 'human'},
                   'triggering_actor': {'login': 'human'}, 'updated_at': date}
            images = {'frontend' if repo.endswith('frontend') else 'api': 'sha256:' + 'a' * 64}
            payload = {'manifest_sha256': release.digest(manifest), 'run_id': 42, 'run_attempt': 1, 'images': images}
            data['attestation'] = copy.deepcopy(payload)
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as archive:
                archive.writestr(zipfile.ZipInfo('evidence.json', date_time=(2020, 1, 1, 0, 0, 0)),
                                 json.dumps(payload, sort_keys=True))
            artifact_digest = 'sha256:' + hashlib.sha256(stream.getvalue()).hexdigest()
            payload.update(artifact_id=9, artifact_digest=artifact_digest)
            data['api'] = {
                'actions/workflows/agent-staging-deploy.yml': {'id': 5, 'path': self.policy['staging']['workflow'], 'state': 'active'},
                'actions/runs/42': run,
                'actions/runs/42/attempts/1/jobs': {'jobs': [
                    {'name': name, 'status': 'completed', 'conclusion': 'success', 'head_sha': head,
                     'steps': [{'status': 'completed', 'conclusion': 'success'}]} for name in self.policy['staging']['jobs']]},
                'actions/runs/42/artifacts': {'artifacts': [{'id': 9, 'name': 'staging-evidence-' + release.digest(manifest),
                     'expired': False, 'digest': artifact_digest, 'workflow_run': {'id': 42, 'head_sha': head},
                     'expires_at': (release.now() + dt.timedelta(days=1)).isoformat()}]},
                'deployments/7': {'id': 7, 'environment': manifest['environment'], 'sha': head,
                     'production_environment': False, 'transient_environment': True,
                     'creator': {'login': 'github-actions[bot]'}, 'task': 'deploy', 'payload': payload},
                'deployments/7/statuses': [{'state': 'success', 'creator': {'login': 'github-actions[bot]'},
                     'log_url': f'https://github.com/{repo}/actions/runs/42', 'updated_at': date}],
                'deployments': [{'id': 7}]}
        self.save()

    def test_happy_path_and_promotion_idempotency(self):
        self.ready()
        self.check()
        first = self.check('promote').stdout
        self.assertEqual(first, self.check('promote').stdout)
        for data in self.state['repos'].values():
            self.assertEqual(len(data['promotion_prs']), 1)
            self.assertTrue(data['promotion_prs'][0]['draft'])
            self.assertEqual(git(data['path'], 'rev-parse', 'main' if data['path'].endswith('frontend') else 'master'), data['base'])
        self.assertFalse(any('/dispatches' in c['url'] or '/merge' in c['url'] for c in self.state['calls']))

    def test_candidate_idempotency_and_packaging_only(self):
        self.prepare()
        first = self.candidate().stdout
        self.assertEqual(first, self.candidate().stdout)
        for data in self.state['repos'].values():
            head = git(data['path'], 'rev-parse', 'staging-release-rc1')
            self.assertEqual(git(data['path'], 'diff', '--name-only', 'feature', head), '.release/candidate.json')

    def test_concurrent_identical_candidate_creation(self):
        self.prepare()
        args = [sys.executable, str(self.tool), 'candidate', '--manifest', str(self.manifest_path)]
        first = subprocess.Popen(args, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second = subprocess.Popen(args, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out1, err1 = first.communicate(timeout=60)
        out2, err2 = second.communicate(timeout=60)
        self.assertEqual(first.returncode, 0, err1)
        self.assertEqual(second.returncode, 0, err2)
        self.assertEqual(out1, out2)
        self.reload()

    def test_local_policy_override_and_wrong_production_target(self):
        self.policy['staging']['max_age_hours'] = 999
        (self.root / 'policy.json').write_text(json.dumps(self.policy))
        self.prepare(ok=False)
        self.policy['staging']['max_age_hours'] = 24
        (self.root / 'policy.json').write_text(json.dumps(self.policy))
        self.state['repos']['fixture/backend']['pulls']['1']['base']['ref'] = 'other'
        self.save()
        self.prepare(ok=False)

    def test_trusted_workflow_modified_in_candidate(self):
        data = self.state['repos']['fixture/frontend']
        target = Path(data['path']) / self.policy['staging']['workflow']
        target.write_text('untrusted workflow\n')
        git(data['path'], 'add', '.')
        git(data['path'], 'commit', '-qm', 'change workflow')
        data['pulls']['1']['head']['sha'] = git(data['path'], 'rev-parse', 'HEAD')
        self.save()
        self.ready()
        self.assertIn('Candidate changed trusted workflow', self.check(ok=False).stderr)

    def test_missing_staging_is_fail_closed(self):
        self.prepare()
        self.policy['staging']['enabled'] = False
        (self.root / 'policy.json').write_text(json.dumps(self.policy))
        self.evidence_path.write_text('{}')
        self.assertIn('Staging unavailable', self.check(ok=False).stderr)
        self.assertFalse(any(c['write'] for c in self.state['calls']))

    def test_unsafe_inputs(self):
        for value in ['../prod', 'a/b', 'a;echo hello', '$(touch nope)', '--help', 'x' * 41]:
            with self.subTest(value=value):
                # argparse itself rejects option-like values, before the API is called.
                result = subprocess.run([sys.executable, str(self.tool), 'prepare', '--id=' + value,
                    '--frontend-pr', '1', '--backend-pr', '1', '--output', str(self.manifest_path)],
                    env=self.env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
        self.reload()
        self.assertFalse(self.state.get('calls'))

    def test_source_changes_and_wrong_repository(self):
        self.ready()
        for field, value in [('sha', 'a' * 40), ('repo', {'full_name': 'attacker/fork'})]:
            original = copy.deepcopy(self.state['repos']['fixture/backend']['pulls']['1']['head'])
            self.state['repos']['fixture/backend']['pulls']['1']['head'][field] = value
            self.save()
            self.check(ok=False)
            self.state['repos']['fixture/backend']['pulls']['1']['head'] = original

    def test_production_branch_drift(self):
        self.ready()
        data = self.state['repos']['fixture/backend']
        git(data['path'], 'update-ref', 'refs/heads/master', data['pulls']['1']['head']['sha'])
        self.check(ok=False)

    def test_manifest_tampering(self):
        self.ready()
        manifest = json.loads(self.manifest_path.read_text())
        manifest['components']['backend']['sha'] = 'a' * 40
        self.manifest_path.write_text(json.dumps(manifest))
        self.check(ok=False)

    def test_divergent_candidate_and_concurrent_candidate(self):
        self.ready()
        data = self.state['repos']['fixture/frontend']
        git(data['path'], 'update-ref', 'refs/heads/staging-release-rc1', data['pulls']['1']['head']['sha'])
        self.candidate(ok=False)
        # Different ID uses a distinct ref and cannot reuse old deployment evidence.
        self.manifest_path.unlink()
        self.prepare('rc2')
        self.candidate()
        self.check(ok=False)

    def test_run_failure_matrix(self):
        self.ready()
        baseline = copy.deepcopy(self.state)
        mutations = [('status', 'in_progress'), ('conclusion', 'failure'), ('conclusion', 'cancelled'),
                     ('conclusion', 'skipped'), ('run_attempt', 2), ('head_sha', 'b' * 40),
                     ('workflow_id', 6), ('event', 'pull_request'), ('actor', {'login': 'attacker'}),
                     ('triggering_actor', {'login': 'attacker'}), ('head_repository', {'full_name': 'evil/fork'}),
                     ('updated_at', '2000-01-01T00:00:00Z')]
        for field, value in mutations:
            with self.subTest(field=field, value=value):
                self.state = copy.deepcopy(baseline)
                self.state['repos']['fixture/frontend']['api']['actions/runs/42'][field] = value
                self.save()
                self.check(ok=False)

    def test_jobs_artifacts_and_deployment_failure_matrix(self):
        self.ready()
        baseline = copy.deepcopy(self.state)
        cases = [
            ('actions/runs/42/attempts/1/jobs', lambda x: x['jobs'].pop()),
            ('actions/runs/42/attempts/1/jobs', lambda x: x['jobs'][0].update(conclusion='skipped')),
            ('actions/runs/42/attempts/1/jobs', lambda x: x['jobs'][0]['steps'][0].update(conclusion='skipped')),
            ('actions/runs/42/artifacts', lambda x: x['artifacts'][0].update(expired=True)),
            ('actions/runs/42/artifacts', lambda x: x['artifacts'][0].update(digest='sha256:' + '0' * 64)),
            ('deployments/7', lambda x: x.update(production_environment=True)),
            ('deployments/7', lambda x: x.update(environment='agent-staging-other')),
            ('deployments/7', lambda x: x['payload']['images'].update(api='latest')),
            ('deployments/7', lambda x: x['payload'].update(manifest_sha256='0' * 64)),
            ('deployments/7/statuses', lambda x: x[0].update(state='inactive')),
            ('deployments/7/statuses', lambda x: x[0].update(creator={'login': 'attacker'})),
            ('deployments', lambda x: x.insert(0, {'id': 8})),
        ]
        for route, mutate in cases:
            with self.subTest(route=route):
                self.state = copy.deepcopy(baseline)
                mutate(self.state['repos']['fixture/frontend']['api'][route])
                self.save()
                self.check(ok=False)

    def test_no_caller_passed_assertions(self):
        self.ready()
        self.evidence_path.write_text(json.dumps({'fixture/frontend': {'passed': True}, 'fixture/backend': {'passed': True}}))
        self.check(ok=False)

    def test_missing_human_approval_and_api_access(self):
        self.ready()
        self.state['responses']['repos/fixture/frontend/environments/production'] = {
            'can_admins_bypass': True, 'protection_rules': []}
        self.save()
        self.check('promote', ok=False)
        self.assertFalse(any(c['write'] and c['url'].endswith('/pulls') for c in self.state['calls']))
        self.state['fail'] = ['repos/fixture/frontend/git/ref/heads/staging-release-rc1']
        self.save()
        self.candidate(ok=False)


if __name__ == '__main__':
    unittest.main()
