#!/usr/bin/env node
import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

const HOME = homedir();
const COLLECTION_PATH = path.join(HOME, '.mcp-collection.json');
const DEFAULT_MCPS_PATH = new URL('./default-mcps.json', import.meta.url).pathname;

const SEARCH_PATTERNS = [
  `${HOME}/**/.mcp.json`,
  `${HOME}/**/mcp-config.json`,
  `${HOME}/**/mcp.json`,
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/Library/Caches/**',
  '**/Library/Application Support/Google/**',
  '**/Library/Application Support/Firefox/**',
  '**/Library/Application Support/Slack/**',
  '**/.Trash/**',
];

/**
 * Scan the home directory for MCP configuration files
 */
async function scanForMcpConfigs() {
  const spinner = ora('Scanning for MCP configuration files...').start();
  const allFiles = new Set();

  for (const pattern of SEARCH_PATTERNS) {
    try {
      const files = await glob(pattern, {
        ignore: IGNORE_PATTERNS,
        dot: true,
        nodir: true,
        absolute: true,
      });
      files.forEach(f => allFiles.add(f));
    } catch {
      // Continue on permission errors
    }
  }

  spinner.succeed(`Found ${allFiles.size} MCP config files`);
  return Array.from(allFiles);
}

/**
 * Extract MCP servers from a config file
 */
async function extractMcpServers(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const json = JSON.parse(content);

    if (json.mcpServers && typeof json.mcpServers === 'object') {
      return { servers: json.mcpServers, source: filePath };
    }

    if (json.mcp?.servers && Array.isArray(json.mcp.servers)) {
      const servers = {};
      for (const server of json.mcp.servers) {
        if (server.name) {
          const { name, ...config } = server;
          servers[name] = config;
        }
      }
      return { servers, source: filePath };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize environment variable values to remove real secrets
 */
export function sanitizeEnvValue(value, key = '') {
  if (typeof value !== 'string') return value;
  if (value === '') return value;

  const placeholderPatterns = [
    /^<.*>$/,
    /^USE_YOUR_/,
    /^YOUR_/,
    /^\${.*}$/,
    /^xxx+$/i,
    /^placeholder$/i,
    /^your_/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(value)) {
      return value;
    }
  }

  const sensitiveKeyPatterns = [
    /token/i, /secret/i, /key/i, /password/i, /credential/i,
    /auth/i, /api_key/i, /apikey/i, /access/i, /private/i,
  ];

  const isSensitiveKey = sensitiveKeyPatterns.some(p => p.test(key));

  const secretPatterns = [
    { pattern: /^sk-[a-zA-Z0-9]+/, name: 'API_KEY' },
    { pattern: /^ghp_[a-zA-Z0-9]+/, name: 'GITHUB_TOKEN' },
    { pattern: /^glpat-[a-zA-Z0-9]+/, name: 'GITLAB_TOKEN' },
    { pattern: /^xox[baprs]-[a-zA-Z0-9-]+/, name: 'SLACK_TOKEN' },
    { pattern: /^secret_[a-zA-Z0-9]+/, name: 'SECRET' },
    { pattern: /^ntn_[a-zA-Z0-9]+/, name: 'NOTION_TOKEN' },
    { pattern: /^ATATT[a-zA-Z0-9]+/, name: 'ATLASSIAN_TOKEN' },
    { pattern: /^[0-9]+\/\/[a-zA-Z0-9_-]+/, name: 'REFRESH_TOKEN' },
    { pattern: /^eyJ[a-zA-Z0-9_-]+\.eyJ/, name: 'JWT_TOKEN' },
  ];

  for (const { pattern, name } of secretPatterns) {
    if (pattern.test(value)) {
      return `<YOUR_${name}>`;
    }
  }

  if (isSensitiveKey && /^[a-zA-Z0-9_=-]{20,}$/.test(value)) {
    return '<YOUR_SECRET>';
  }

  if (/^[a-zA-Z0-9_-]{40,}$/.test(value)) {
    return '<YOUR_SECRET>';
  }

  return value;
}

/**
 * Sanitize server config by removing secrets and local paths
 */
export function sanitizeServerConfig(config) {
  const sanitized = { ...config };

  if (sanitized.env) {
    sanitized.env = {};
    for (const [key, value] of Object.entries(config.env)) {
      sanitized.env[key] = sanitizeEnvValue(value, key);
    }
  }

  if (sanitized.args) {
    sanitized.args = config.args.map(arg => {
      if (typeof arg === 'string' && arg.includes('=')) {
        const [key, ...valueParts] = arg.split('=');
        const value = valueParts.join('=');
        const sanitizedValue = sanitizeEnvValue(value);
        return `${key}=${sanitizedValue}`;
      }
      return arg;
    });
  }

  return sanitized;
}

/**
 * Collect all MCP servers from found config files
 */
async function collectAllMcps(files) {
  const spinner = ora('Extracting MCP servers...').start();
  const allServers = {};
  const serverSources = {};

  for (const file of files) {
    const result = await extractMcpServers(file);
    if (result) {
      for (const [name, config] of Object.entries(result.servers)) {
        const sanitizedConfig = sanitizeServerConfig(config);

        if (!serverSources[name]) {
          serverSources[name] = [];
        }
        serverSources[name].push(result.source);

        if (!allServers[name]) {
          allServers[name] = sanitizedConfig;
        }
      }
    }
  }

  spinner.succeed(`Extracted ${Object.keys(allServers).length} unique MCP servers`);
  return { servers: allServers, sources: serverSources };
}

/**
 * Load default MCPs from bundled file
 */
async function loadDefaultMcps() {
  try {
    const content = await readFile(DEFAULT_MCPS_PATH, 'utf-8');
    return JSON.parse(content).mcpServers || {};
  } catch {
    return {};
  }
}

/**
 * Check if config has local file paths
 */
function hasLocalPaths(config) {
  const checkValue = (val) => {
    if (typeof val === 'string') {
      return val.includes('/Users/') || val.includes('/home/') || val.startsWith('/');
    }
    return false;
  };

  if (config.args?.some(checkValue)) return true;
  if (config.env && Object.values(config.env).some(checkValue)) return true;
  return false;
}

/**
 * Main scan function - finds all MCP configs and saves collection
 */
export async function scan() {
  console.log(chalk.blue('\n🔍 MCP Configuration Scanner\n'));

  // Load defaults first
  const defaultMcps = await loadDefaultMcps();
  console.log(chalk.gray(`Loaded ${Object.keys(defaultMcps).length} default MCPs\n`));

  const files = await scanForMcpConfigs();

  let scannedServers = {};
  if (files.length > 0) {
    console.log(chalk.gray('Local config files found:'));
    for (const file of files) {
      console.log(chalk.gray(`  • ${file.replace(HOME, '~')}`));
    }
    console.log('');

    const { servers } = await collectAllMcps(files);

    // Filter out servers with local paths
    for (const [name, config] of Object.entries(servers)) {
      if (!hasLocalPaths(config)) {
        scannedServers[name] = config;
      }
    }
  }

  // Merge: defaults first, then scanned (scanned can override)
  const mergedServers = { ...defaultMcps, ...scannedServers };

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      totalServers: Object.keys(mergedServers).length,
      sourceFiles: files.map(f => f.replace(HOME, '~')),
    },
    mcpServers: mergedServers,
  };

  await writeFile(COLLECTION_PATH, JSON.stringify(output, null, 2));
  console.log(chalk.green(`\n✅ Saved ${Object.keys(mergedServers).length} MCP servers to ~/.mcp-collection.json\n`));

  return { servers: mergedServers, sources: {}, files };
}

// Run if called directly
const isMain = process.argv[1]?.includes('scanner');
if (isMain) {
  scan().catch(console.error);
}
