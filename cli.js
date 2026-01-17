#!/usr/bin/env node
import blessed from 'blessed';
import { readFile, writeFile, access } from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import { scan } from './scanner.js';

const HOME = homedir();
const COLLECTION_PATH = path.join(HOME, '.mcp-collection.json');

/**
 * Load the MCP collection from home directory
 */
async function loadCollection() {
  try {
    await access(COLLECTION_PATH);
    const content = await readFile(COLLECTION_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Create and run the TUI application
 */
function createApp(collection) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'MCP Generator',
  });

  const selectedMcps = new Set();
  const mcpNames = Object.keys(collection.mcpServers).sort();
  const outputPath = path.join(process.cwd(), '.mcp.json');

  // Title bar
  blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' MCP GENERATOR - Select MCPs with SPACE, press ENTER to generate .mcp.json',
    style: { fg: 'black', bg: 'white', bold: true },
  });

  // Left panel: MCP list
  const listBox = blessed.box({
    parent: screen,
    top: 1,
    left: 0,
    width: '50%',
    height: '100%-3',
    border: { type: 'line' },
    label: ' MCPs ',
    style: { border: { fg: 'white' } },
  });

  const mcpList = blessed.list({
    parent: listBox,
    top: 0,
    left: 1,
    width: '100%-4',
    height: '100%-2',
    keys: true,
    vi: true,
    mouse: true,
    style: {
      fg: 'white',
      selected: { fg: 'black', bg: 'white' },
    },
  });

  // Right panel: Details
  const detailBox = blessed.box({
    parent: screen,
    top: 1,
    left: '50%',
    width: '50%',
    height: '60%',
    border: { type: 'line' },
    label: ' Details ',
    style: { fg: 'gray', border: { fg: 'white' } },
  });

  // Bottom right: Selected items
  const selectedBox = blessed.box({
    parent: screen,
    top: '61%',
    left: '50%',
    width: '50%',
    height: '100%-64%-3',
    border: { type: 'line' },
    label: ' Selected: 0 ',
    style: { fg: 'green', border: { fg: 'green' } },
  });

  // Footer
  blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' SPACE=Toggle  ENTER=Generate  R=Rescan  Q=Quit ',
    style: { fg: 'black', bg: 'white' },
  });

  // Message overlay
  const messageBox = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 50,
    height: 5,
    border: { type: 'line' },
    style: { fg: 'white', bg: 'black', border: { fg: 'green' } },
    hidden: true,
  });

  function getListItems() {
    return mcpNames.map(name => {
      const check = selectedMcps.has(name) ? '[x]' : '[ ]';
      return `${check} ${name}`;
    });
  }

  function refreshList() {
    const idx = mcpList.selected || 0;
    mcpList.setItems(getListItems());
    mcpList.select(idx);
  }

  function updateDetails() {
    const idx = mcpList.selected || 0;
    const name = mcpNames[idx];
    if (!name) return;

    const config = collection.mcpServers[name];
    let text = `${name}\n${'─'.repeat(30)}\n\n`;
    text += `Command: ${config.command || 'N/A'}\n`;
    text += `Args: ${(config.args || []).join(' ') || 'none'}\n`;

    if (config.type) text += `Type: ${config.type}\n`;
    if (config.url) text += `URL: ${config.url}\n`;

    if (config.env && Object.keys(config.env).length > 0) {
      text += `\nEnv vars:\n`;
      for (const key of Object.keys(config.env)) {
        text += `  ${key}\n`;
      }
    }

    detailBox.setContent(text);
  }

  function updateSelected() {
    selectedBox.setLabel(` Selected: ${selectedMcps.size} `);
    if (selectedMcps.size === 0) {
      selectedBox.setContent('Press SPACE to select MCPs');
    } else {
      selectedBox.setContent([...selectedMcps].sort().join(', '));
    }
  }

  function showMessage(text, duration = 2000) {
    messageBox.setContent(`\n  ${text}`);
    messageBox.show();
    screen.render();
    setTimeout(() => {
      messageBox.hide();
      screen.render();
    }, duration);
  }

  async function generateFile() {
    if (selectedMcps.size === 0) {
      showMessage('Select MCPs first with SPACE');
      return;
    }

    const config = { mcpServers: {} };
    for (const name of selectedMcps) {
      config.mcpServers[name] = { ...collection.mcpServers[name] };
    }

    try {
      await writeFile(outputPath, JSON.stringify(config, null, 2));
      showMessage(`Created .mcp.json with ${selectedMcps.size} MCPs`, 2000);
      setTimeout(() => process.exit(0), 2000);
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    }
  }

  async function rescanSystem() {
    showMessage('Scanning...');
    try {
      await scan();
      const newCollection = await loadCollection();
      Object.assign(collection, newCollection);
      mcpNames.length = 0;
      mcpNames.push(...Object.keys(collection.mcpServers).sort());
      refreshList();
      updateDetails();
      showMessage(`Found ${mcpNames.length} MCPs`);
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    }
  }

  // Event handlers
  mcpList.on('select item', () => {
    updateDetails();
    screen.render();
  });

  screen.key(['space'], () => {
    const name = mcpNames[mcpList.selected || 0];
    if (selectedMcps.has(name)) {
      selectedMcps.delete(name);
    } else {
      selectedMcps.add(name);
    }
    refreshList();
    updateSelected();
    screen.render();
  });

  screen.key(['enter'], () => generateFile());
  screen.key(['r'], () => rescanSystem());
  screen.key(['q', 'C-c', 'escape'], () => process.exit(0));

  // Initialize
  refreshList();
  updateDetails();
  updateSelected();
  mcpList.focus();
  screen.render();
}

/**
 * Main entry point
 */
async function main() {
  let collection = await loadCollection();

  if (!collection) {
    console.log('First run - scanning for MCP configs...');
    await scan();
    collection = await loadCollection();
    if (!collection) {
      console.error('No MCPs found. Create some .mcp.json files first.');
      process.exit(1);
    }
  }

  createApp(collection);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
