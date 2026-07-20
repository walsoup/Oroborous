const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// In-memory or file-based configuration/workspace storage
const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {
    workspaces: [],
    activeWorkspaceId: null,
    aiSettings: {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
      model: 'llama3',
    }
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let config = loadConfig();

// Helper to execute commands in a directory
function runCmd(cmd, dir) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: dir }, (error, stdout, stderr) => {
      resolve({
        code: error ? error.code : 0,
        stdout: stdout.toString(),
        stderr: stderr.toString()
      });
    });
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Oroborous Node Server is running' });
});

// Settings endpoints
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  config = { ...config, ...req.body };
  saveConfig(config);
  res.json({ status: 'success', config });
});

// Workspace management
app.get('/api/workspaces', (req, res) => {
  res.json(config.workspaces);
});

app.post('/api/workspaces/select', (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  const absolutePath = path.resolve(dirPath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(400).json({ error: `Directory does not exist: ${absolutePath}` });
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: `Path is not a directory: ${absolutePath}` });
  }

  const id = Buffer.from(absolutePath).toString('base64');
  const name = path.basename(absolutePath) || absolutePath;

  const existing = config.workspaces.find(w => w.path === absolutePath);
  if (!existing) {
    config.workspaces.push({ id, name, path: absolutePath });
  }
  config.activeWorkspaceId = id;
  saveConfig(config);

  res.json({ status: 'success', activeWorkspaceId: id, workspaces: config.workspaces });
});

app.post('/api/workspaces/activate', (req, res) => {
  const { id } = req.body;
  const workspace = config.workspaces.find(w => w.id === id);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  config.activeWorkspaceId = id;
  saveConfig(config);
  res.json({ status: 'success', activeWorkspaceId: id });
});

app.delete('/api/workspaces/:id', (req, res) => {
  const { id } = req.params;
  config.workspaces = config.workspaces.filter(w => w.id !== id);
  if (config.activeWorkspaceId === id) {
    config.activeWorkspaceId = config.workspaces.length > 0 ? config.workspaces[0].id : null;
  }
  saveConfig(config);
  res.json({ status: 'success', workspaces: config.workspaces });
});

// Helper to get active workspace path
function getActiveWorkspacePath() {
  if (!config.activeWorkspaceId) return null;
  const ws = config.workspaces.find(w => w.id === config.activeWorkspaceId);
  return ws ? ws.path : null;
}

// Git Endpoints
app.get('/api/git/status', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) {
    return res.status(400).json({ error: 'No active workspace selected' });
  }

  // Check if it is a git repository
  const isGit = await runCmd('git rev-parse --is-inside-work-tree', wsPath);
  if (isGit.code !== 0) {
    return res.json({ isGit: false, message: 'Not a git repository' });
  }

  // Get current branch
  const branchResult = await runCmd('git rev-parse --abbrev-ref HEAD', wsPath);
  const branch = branchResult.stdout.trim();

  // Get short status
  const statusResult = await runCmd('git status --short', wsPath);
  const statusShort = statusResult.stdout;

  // Get commits ahead/behind
  let ahead = 0;
  let behind = 0;
  const upstreamResult = await runCmd('git rev-parse --abbrev-ref @{u}', wsPath);
  if (upstreamResult.code === 0) {
    const upstream = upstreamResult.stdout.trim();
    const countResult = await runCmd(`git rev-list --left-right --count ${upstream}...HEAD`, wsPath);
    if (countResult.code === 0) {
      const parts = countResult.stdout.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10);
        ahead = parseInt(parts[1], 10);
      }
    }
  }

  res.json({
    isGit: true,
    branch,
    ahead,
    behind,
    statusShort,
    path: wsPath
  });
});

app.get('/api/git/diff', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) {
    return res.status(400).json({ error: 'No active workspace selected' });
  }

  const { file } = req.query;
  let diffCmd = 'git diff HEAD';
  if (file) {
    diffCmd = `git diff HEAD -- "${file}"`;
  }

  const diffResult = await runCmd(diffCmd, wsPath);
  res.json({
    diff: diffResult.stdout || diffResult.stderr || 'No differences'
  });
});

app.post('/api/git/clone', async (req, res) => {
  const { repoUrl, targetDir } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  // Resolve target directory
  let clonePath;
  if (targetDir) {
    clonePath = path.resolve(targetDir);
  } else {
    // Default to a folder with the repo name in the user's home or server folder
    const repoName = repoUrl.split('/').pop().replace(/\.git$/, '') || 'cloned-repo';
    clonePath = path.join(process.cwd(), 'workspaces', repoName);
  }

  // Create parent directory if it doesn't exist
  const parentDir = path.dirname(clonePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  if (fs.existsSync(clonePath)) {
    return res.status(400).json({ error: `Target path already exists: ${clonePath}` });
  }

  res.json({ status: 'started', message: 'Cloning repository...', path: clonePath });

  // Run clone in background
  runCmd(`git clone "${repoUrl}" "${clonePath}"`, process.cwd()).then(async (result) => {
    if (result.code === 0) {
      // Auto-add to workspaces and make active
      const id = Buffer.from(clonePath).toString('base64');
      const name = path.basename(clonePath);
      config.workspaces.push({ id, name, path: clonePath });
      config.activeWorkspaceId = id;
      saveConfig(config);
      console.log(`Successfully cloned and activated workspace: ${clonePath}`);
    } else {
      console.error(`Failed to clone: ${result.stderr}`);
    }
  });
});

// Terminal Executor
app.post('/api/terminal/run', async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  const wsPath = getActiveWorkspacePath() || process.cwd();

  const result = await runCmd(command, wsPath);
  res.json({
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr
  });
});

// File operations
app.get('/api/files', (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'File path is required' });

  const fullPath = path.resolve(wsPath, file);
  if (!fullPath.startsWith(wsPath)) {
    return res.status(403).json({ error: 'Access denied: outside workspace' });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files', (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file, content } = req.body;
  if (!file) return res.status(400).json({ error: 'File path is required' });

  const fullPath = path.resolve(wsPath, file);
  if (!fullPath.startsWith(wsPath)) {
    return res.status(403).json({ error: 'Access denied: outside workspace' });
  }

  try {
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content || '', 'utf8');
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/list', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      if (file === 'node_modules' || file === '.git' || file === '.expo' || file === '.venv') return;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(fullPath));
      } else {
        results.push(path.relative(wsPath, fullPath));
      }
    });
    return results;
  }

  try {
    const files = walk(wsPath);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oroborous Server running on port ${PORT}`);
});
