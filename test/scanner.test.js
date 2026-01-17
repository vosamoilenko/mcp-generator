import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeEnvValue, sanitizeServerConfig } from '../scanner.js';

describe('sanitizeEnvValue', () => {
  it('should keep placeholders unchanged', () => {
    assert.strictEqual(sanitizeEnvValue('<YOUR_API_KEY>'), '<YOUR_API_KEY>');
    assert.strictEqual(sanitizeEnvValue('YOUR_SECRET'), 'YOUR_SECRET');
    assert.strictEqual(sanitizeEnvValue('${ENV_VAR}'), '${ENV_VAR}');
  });

  it('should keep empty strings unchanged', () => {
    assert.strictEqual(sanitizeEnvValue(''), '');
  });

  it('should sanitize OpenAI-style API keys', () => {
    assert.strictEqual(sanitizeEnvValue('sk-abc123xyz789'), '<YOUR_API_KEY>');
  });

  it('should sanitize GitHub tokens', () => {
    assert.strictEqual(sanitizeEnvValue('ghp_xxxxxxxxxxxxxxxxxxxx'), '<YOUR_GITHUB_TOKEN>');
  });

  it('should sanitize GitLab tokens', () => {
    assert.strictEqual(sanitizeEnvValue('glpat-xxxxxxxxxxxxxxxxxxxx'), '<YOUR_GITLAB_TOKEN>');
  });

  it('should sanitize Slack tokens', () => {
    assert.strictEqual(sanitizeEnvValue('xoxb-123-456-abc'), '<YOUR_SLACK_TOKEN>');
  });

  it('should sanitize Atlassian tokens', () => {
    assert.strictEqual(sanitizeEnvValue('ATATT3xFfGF08NUMI9xyz'), '<YOUR_ATLASSIAN_TOKEN>');
  });

  it('should sanitize long alphanumeric secrets', () => {
    const longSecret = 'a'.repeat(45);
    assert.strictEqual(sanitizeEnvValue(longSecret), '<YOUR_SECRET>');
  });

  it('should sanitize sensitive keys with medium-length values', () => {
    const result = sanitizeEnvValue('abcdefghij1234567890abcd', 'API_TOKEN');
    assert.strictEqual(result, '<YOUR_SECRET>');
  });

  it('should keep normal values unchanged', () => {
    assert.strictEqual(sanitizeEnvValue('production'), 'production');
    assert.strictEqual(sanitizeEnvValue('true'), 'true');
    assert.strictEqual(sanitizeEnvValue('https://api.example.com'), 'https://api.example.com');
  });

  it('should keep short values unchanged even for sensitive keys', () => {
    assert.strictEqual(sanitizeEnvValue('debug', 'LOG_LEVEL'), 'debug');
  });
});

describe('sanitizeServerConfig', () => {
  it('should sanitize env values in config', () => {
    const config = {
      command: 'npx',
      args: ['-y', 'some-package'],
      env: {
        API_KEY: 'sk-realkey123456',
        LOG_LEVEL: 'debug',
      },
    };

    const result = sanitizeServerConfig(config);

    assert.strictEqual(result.command, 'npx');
    assert.deepStrictEqual(result.args, ['-y', 'some-package']);
    assert.strictEqual(result.env.API_KEY, '<YOUR_API_KEY>');
    assert.strictEqual(result.env.LOG_LEVEL, 'debug');
  });

  it('should handle config without env', () => {
    const config = {
      command: 'npx',
      args: ['package'],
    };

    const result = sanitizeServerConfig(config);

    assert.strictEqual(result.command, 'npx');
    assert.deepStrictEqual(result.args, ['package']);
    assert.strictEqual(result.env, undefined);
  });

  it('should sanitize secrets in args', () => {
    const config = {
      command: 'npx',
      args: ['--token=sk-secret123456', '--name=test'],
    };

    const result = sanitizeServerConfig(config);

    assert.strictEqual(result.args[0], '--token=<YOUR_API_KEY>');
    assert.strictEqual(result.args[1], '--name=test');
  });

  it('should not modify original config', () => {
    const config = {
      command: 'npx',
      env: { KEY: 'sk-secret123' },
    };

    sanitizeServerConfig(config);

    assert.strictEqual(config.env.KEY, 'sk-secret123');
  });
});
