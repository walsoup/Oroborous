const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3005;

// Scope large bodies to only the routes that need them
app.use(express.json({ limit: '2mb' }));

const CONFIG_FILE = path.join(__dirname, 'config.json');

function defaultAiSettings() {
  return {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    primaryModel: 'anthropic/claude-3.5-sonnet',
    subAgentModel: 'meta-llama/llama-3.3-70b-instruct',
    miniAgentModel: 'google/gemini-2.0-flash-001',
    temperature: 0.2,
    maxTokens: 4096,
    autoApproval: true
  };
}

function loadConfig() {
  let data = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }

  const config = {
    workspaces: data.workspaces || [],
    activeWorkspaceId: data.activeWorkspaceId || null,
    aiSettings: { ...defaultAiSettings(), ...(data.aiSettings || {}) },
    vibeMode: data.vibeMode !== false,
    theme: data.theme || 'cyberpunk',
    onboardingCompleted: data.onboardingCompleted || false,
    authToken: data.authToken || crypto.randomBytes(24).toString('hex')
  };

  if (!data.authToken) saveConfig(config);
  return config;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let config = loadConfig();

function runCmd(cmd, dir, timeout = 60000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    exec(cmd, { cwd: dir, timeout, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      const elapsed = Date.now() - startTime;
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : (error && !stdout ? error.message : ''),
        elapsed
      });
    });
  });
}

// Argument-array git runner — no shell interpolation possible.
function git(args, dir, timeout = 60000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn('git', args, { cwd: dir, windowsHide: true });

    let stdout = '';
    let stderr = '';
    const cap = 10 * 1024 * 1024;

    child.stdout.on('data', (d) => { if (stdout.length < cap) stdout += d.toString(); });
    child.stderr.on('data', (d) => { if (stderr.length < cap) stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr: stderr + '\nProcess timed out', elapsed: Date.now() - startTime });
    }, timeout);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message, elapsed: Date.now() - startTime });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code === null ? 1 : code, stdout, stderr, elapsed: Date.now() - startTime });
    });
  });
}

function getActiveWorkspacePath() {
  if (!config.activeWorkspaceId) return null;
  const ws = config.workspaces.find(w => w.id === config.activeWorkspaceId);
  return ws && fs.existsSync(ws.path) ? ws.path : null;
}

// ---- Path containment: sibling-dir & traversal-proof -------------------------
function resolveWithin(wsPath, targetPath) {
  const fullPath = path.resolve(wsPath, targetPath);
  // realpath both ends so symlinks cannot smuggle us outside either
  let realWs = wsPath;
  let realFull = fullPath;
  try { realWs = fs.realpathSync(wsPath); } catch (_) {}
  try { realFull = fs.realpathSync(fullPath); } catch (_) {} // may not exist yet (write case)
  const rel = path.relative(realWs, realFull);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return realFull;
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.expo', '.venv', 'venv', '__pycache__',
  '.next', '.nuxt', 'dist', 'build', 'out', '.idea', '.vscode',
  '.gradle', 'target', 'vendor', '.turbo', '.cache'
]);

// Never surface these to search results or file listings — they hold secrets
const SECRET_FILES = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.key|credentials\.json|secrets?\.(json|ya?ml))$/i;
const isSensitiveRelPath = (rel) => SECRET_FILES.test(rel.replace(/\\/g, '/'));

// ---- Auth middleware ----------------------------------------------------------
// GET /api/health and POST /api/auth/verify are the only open routes.
app.use('/api', (req, res, next) => {
  const openRoutes = ['/health', '/auth/verify'];
  if (openRoutes.includes(req.path)) return next();

  const header = req.headers['authorization'] || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== config.authToken) {
    return res.status(401).json({ error: 'Unauthorized: pairing token missing or invalid' });
  }
  next();
});

// No CORS: React Native fetch does not enforce CORS; removing it closes
// drive-by browser attacks against localhost.
app.use((req, res, next) => {
  res.removeHeader('Access-Control-Allow-Origin');
  next();
});

// 1. Health (unauthenticated, minimal info only)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Oroborous Server v1.2 is running',
    version: '1.2.0'
  });
});

app.post('/api/auth/verify', (req, res) => {
  const token = (req.body && req.body.token ? String(req.body.token) : '').trim();
  res.json({ authorized: token === config.authToken });
});

// 2. Configuration API — apiKey is write-only, never echoed back
app.get('/api/config', (req, res) => {
  res.json(sanitizeConfig(config));
});

function sanitizeConfig(cfg) {
  return {
    workspaces: cfg.workspaces,
    activeWorkspaceId: cfg.activeWorkspaceId,
    vibeMode: cfg.vibeMode,
    theme: cfg.theme,
    onboardingCompleted: cfg.onboardingCompleted,
    aiSettings: {
      ...cfg.aiSettings,
      apiKey: cfg.aiSettings.apiKey ? '__REDACTED__' : ''
    }
  };
}

app.post('/api/config', (req, res) => {
  const body = { ...req.body };

  // Never accept auth/token material from clients
  delete body.authToken;

  if (body.aiSettings) {
    const incoming = { ...body.aiSettings };
    // Sentinel means "unchanged" — keep stored key
    if (!incoming.apiKey || incoming.apiKey === '__REDACTED__') {
      incoming.apiKey = config.aiSettings.apiKey;
    }
    body.aiSettings = { ...config.aiSettings, ...incoming };
  }

  // Workspaces are managed by dedicated endpoints; ignore wholesale replacement
  delete body.workspaces;

  config = { ...config, ...body };
  saveConfig(config);
  res.json({ status: 'success', config: sanitizeConfig(config) });
});

// 3. Workspace Management
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

  const id = Buffer.from(absolutePath).toString('base64').replace(/[/+=]/g, '_');
  const name = path.basename(absolutePath) || absolutePath;

  const existing = config.workspaces.find(w => w.path === absolutePath);
  if (!existing) {
    config.workspaces.push({ id, name, path: absolutePath, createdAt: new Date().toISOString() });
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
  res.json({ status: 'success', activeWorkspaceId: id, workspace });
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

const VALID_REPO_URL = /^(https?:\/\/[^\s]+?\.git\/?|git@[^\s:]+:[^\s]+?\.git|ssh:\/\/[^\s]+)$/i;

app.post('/api/workspaces/clone', async (req, res) => {
  const { repoUrl, targetDir } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }
  if (!VALID_REPO_URL.test(repoUrl.trim())) {
    return res.status(400).json({ error: 'Invalid repository URL format' });
  }

  const repoName = repoUrl.split('/').pop().replace(/\.git$/, '').replace(/[^\w.-]/g, '') || 'cloned-repo';
  let clonePath;
  if (targetDir) {
    clonePath = path.resolve(targetDir);
  } else {
    clonePath = path.join(process.cwd(), 'workspaces', repoName);
  }

  const parentDir = path.dirname(clonePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  if (fs.existsSync(clonePath)) {
    return res.status(400).json({ error: `Target path already exists: ${clonePath}` });
  }

  res.json({ status: 'started', message: 'Cloning repository in background...', path: clonePath });

  const result = await git(['clone', repoUrl.trim(), clonePath], process.cwd(), 300000);
  if (result.code === 0) {
    const id = Buffer.from(clonePath).toString('base64').replace(/[/+=]/g, '_');
    config.workspaces.push({ id, name: repoName, path: clonePath, createdAt: new Date().toISOString() });
    config.activeWorkspaceId = id;
    saveConfig(config);
    console.log(`Successfully cloned workspace: ${clonePath}`);
  } else {
    console.error(`Failed to clone ${repoUrl}:`, result.stderr);
  }
});

// 4. Project Diagnostics & Script Detection
app.get('/api/project/detect', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace selected' });

  const projectInfo = {
    path: wsPath,
    name: path.basename(wsPath),
    type: 'generic',
    packageManager: 'none',
    scripts: {},
    frameworks: [],
    dependencies: []
  };

  const pkgJsonPath = path.join(wsPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      projectInfo.type = 'node';
      projectInfo.name = pkg.name || projectInfo.name;
      projectInfo.scripts = pkg.scripts || {};

      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      projectInfo.dependencies = Object.keys(allDeps);

      if (allDeps['react-native'] || allDeps['expo']) projectInfo.frameworks.push('React Native');
      if (allDeps['react']) projectInfo.frameworks.push('React');
      if (allDeps['next']) projectInfo.frameworks.push('Next.js');
      if (allDeps['vue']) projectInfo.frameworks.push('Vue');
      if (allDeps['express']) projectInfo.frameworks.push('Express');
      if (allDeps['typescript']) projectInfo.frameworks.push('TypeScript');
      if (allDeps['tailwindcss']) projectInfo.frameworks.push('TailwindCSS');

      if (fs.existsSync(path.join(wsPath, 'pnpm-lock.yaml'))) projectInfo.packageManager = 'pnpm';
      else if (fs.existsSync(path.join(wsPath, 'yarn.lock'))) projectInfo.packageManager = 'yarn';
      else if (fs.existsSync(path.join(wsPath, 'bun.lockb'))) projectInfo.packageManager = 'bun';
      else projectInfo.packageManager = 'npm';
    } catch (_) {}
  } else if (fs.existsSync(path.join(wsPath, 'Cargo.toml'))) {
    projectInfo.type = 'rust';
    projectInfo.frameworks.push('Cargo');
    projectInfo.scripts = { build: 'cargo build', test: 'cargo test', run: 'cargo run' };
  } else if (fs.existsSync(path.join(wsPath, 'requirements.txt')) || fs.existsSync(path.join(wsPath, 'pyproject.toml'))) {
    projectInfo.type = 'python';
    projectInfo.frameworks.push('Python');
    projectInfo.scripts = { test: 'pytest', run: 'python main.py' };
  } else if (fs.existsSync(path.join(wsPath, 'go.mod'))) {
    projectInfo.type = 'go';
    projectInfo.frameworks.push('Go');
    projectInfo.scripts = { build: 'go build', test: 'go test ./...' };
  } else if (fs.existsSync(path.join(wsPath, 'Makefile'))) {
    projectInfo.type = 'make';
    projectInfo.frameworks.push('Make');
  }

  res.json(projectInfo);
});

// 5. Filesystem Tree & Operations (async — never block the event loop)
// Full-file writes can be large; scope a bigger body limit to these routes only
app.use('/api/files', express.json({ limit: '50mb' }));

app.get('/api/files/tree', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const MAX_DEPTH = 6;
  const MAX_NODES = 5000;
  let nodeCount = 0;

  async function buildTree(dir, depth = 0) {
    if (depth > MAX_DEPTH || nodeCount > MAX_NODES) return [];
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return [];
    }

    const nodes = [];
    for (const item of items) {
      if (IGNORED_DIRS.has(item.name)) continue;
      if (item.name.startsWith('.') && item.name !== '.env.example' && item.name !== '.gitignore') continue;
      if (nodeCount > MAX_NODES) break;

      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(wsPath, fullPath).replace(/\\/g, '/');
      nodeCount++;

      if (item.isDirectory()) {
        nodes.push({
          name: item.name,
          path: relPath,
          type: 'directory',
          children: await buildTree(fullPath, depth + 1)
        });
      } else if (item.isFile()) {
        let size = 0;
        try { size = (await fsp.stat(fullPath)).size; } catch (_) {}
        nodes.push({
          name: item.name,
          path: relPath,
          type: 'file',
          size,
          extension: path.extname(item.name).toLowerCase()
        });
      }
    }

    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });

    return nodes;
  }

  try {
    const tree = await buildTree(wsPath);
    res.json({ tree, root: path.basename(wsPath) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'File path is required' });

  const fullPath = resolveWithin(wsPath, file);
  if (!fullPath) {
    return res.status(403).json({ error: 'Access denied: path escapes workspace' });
  }

  try {
    const stat = await fsp.stat(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }
    if (isSensitiveRelPath(file) && !req.query.allowSecrets) {
      return res.status(403).json({ error: 'Refusing to read secret file (.env/key/pem). Use terminal if you really need it.' });
    }
    const content = await fsp.readFile(fullPath, 'utf8');
    res.json({ content, size: stat.size, path: file });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file, content } = req.body;
  if (!file) return res.status(400).json({ error: 'File path is required' });

  const fullPath = resolveWithin(wsPath, file);
  if (!fullPath) {
    return res.status(403).json({ error: 'Access denied: path escapes workspace' });
  }

  try {
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      await fsp.mkdir(parentDir, { recursive: true });
    }
    await fsp.writeFile(fullPath, typeof content === 'string' ? content : '', 'utf8');
    res.json({ status: 'success', path: file, size: (content || '').length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/files', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file } = req.body;
  if (!file) return res.status(400).json({ error: 'File path is required' });

  const fullPath = resolveWithin(wsPath, file);
  if (!fullPath || fullPath === wsPath) {
    return res.status(403).json({ error: 'Cannot delete workspace root or paths outside it' });
  }

  try {
    const stat = await fsp.stat(fullPath);
    if (stat.isDirectory()) {
      await fsp.rm(fullPath, { recursive: true, force: true });
    } else {
      await fsp.unlink(fullPath);
    }
    res.json({ status: 'success', message: `Deleted ${file}` });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File or directory not found' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files/rename', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'Old and new paths are required' });

  const fullOld = resolveWithin(wsPath, oldPath);
  const fullNew = resolveWithin(wsPath, newPath);

  if (!fullOld || !fullNew) {
    return res.status(403).json({ error: 'Access denied: path escapes workspace' });
  }

  try {
    const parentNew = path.dirname(fullNew);
    if (!fs.existsSync(parentNew)) {
      await fsp.mkdir(parentNew, { recursive: true });
    }
    await fsp.rename(fullOld, fullNew);
    res.json({ status: 'success', oldPath, newPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files/create-dir', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { dir } = req.body;
  if (!dir) return res.status(400).json({ error: 'Directory path is required' });

  const fullPath = resolveWithin(wsPath, dir);
  if (!fullPath) {
    return res.status(403).json({ error: 'Access denied: path escapes workspace' });
  }

  try {
    await fsp.mkdir(fullPath, { recursive: true });
    res.json({ status: 'success', path: dir });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/list', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const MAX_FILES = 20000;
  const results = [];

  async function walk(dir) {
    if (results.length >= MAX_FILES) return;
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const item of items) {
      if (results.length >= MAX_FILES) return;
      if (IGNORED_DIRS.has(item.name)) continue;
      if (item.name.startsWith('.')) continue;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(fullPath);
      } else if (item.isFile()) {
        const rel = path.relative(wsPath, fullPath).replace(/\\/g, '/');
        if (!isSensitiveRelPath(rel)) results.push(rel);
      }
    }
  }

  try {
    await walk(wsPath);
    res.json({ files: results, truncated: results.length >= MAX_FILES });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Workspace Search / Grep
app.post('/api/files/search', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { query, caseSensitive = false, maxResults = 100 } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const results = [];
  const flags = caseSensitive ? '' : 'i';

  let regex;
  try {
    regex = new RegExp(query, flags); // no 'g' flag: lastIndex statefulness skips matches
  } catch (e) {
    return res.status(400).json({ error: 'Invalid regular expression' });
  }

  const MAX_FILES_SCANNED = 20000;
  let filesScanned = 0;

  async function searchDir(dir) {
    if (results.length >= maxResults || filesScanned >= MAX_FILES_SCANNED) return;
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const item of items) {
      if (results.length >= maxResults) return;
      if (IGNORED_DIRS.has(item.name)) continue;
      if (item.name.startsWith('.')) continue;

      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await searchDir(fullPath);
      } else if (item.isFile()) {
        filesScanned++;
        try {
          const stat = await fsp.stat(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue;
          const relPath = path.relative(wsPath, fullPath).replace(/\\/g, '/');
          if (isSensitiveRelPath(relPath)) continue;

          const content = await fsp.readFile(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (results.length >= maxResults) return;
            if (regex.test(lines[lineIdx])) {
              results.push({
                file: relPath,
                line: lineIdx + 1,
                text: lines[lineIdx].trim().substring(0, 300)
              });
            }
          }
        } catch (_) {}
      }
    }
  }

  try {
    await searchDir(wsPath);
    res.json({ query, total: results.length, matches: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Full Git Suite API (argument-array spawns — injection-proof)
app.get('/api/git/status', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const isGit = await git(['rev-parse', '--is-inside-work-tree'], wsPath);
  if (isGit.code !== 0) {
    return res.json({ isGit: false, message: 'Not a git repository', path: wsPath });
  }

  const [branchRes, statusRes, upstreamRes] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD'], wsPath),
    git(['status', '--porcelain'], wsPath),
    git(['rev-parse', '--abbrev-ref', '@{u}'], wsPath)
  ]);

  const branch = branchRes.stdout.trim() || 'main';
  const statusShort = statusRes.stdout;

  const stagedFiles = [];
  const unstagedFiles = [];
  const untrackedFiles = [];

  if (statusShort) {
    statusShort.split('\n').forEach(line => {
      if (!line) return;
      const x = line[0];
      const y = line[1];
      let filepath = line.substring(3).trim();
      // porcelain renames look like "R  old -> new"
      const arrowIdx = filepath.indexOf(' -> ');
      if (arrowIdx !== -1) filepath = filepath.substring(arrowIdx + 4).trim();
      filepath = filepath.replace(/^"|"$/g, '');

      if (x !== ' ' && x !== '?') stagedFiles.push({ file: filepath, status: x });
      if (y !== ' ' && y !== '?') unstagedFiles.push({ file: filepath, status: y });
      if (x === '?' && y === '?') untrackedFiles.push({ file: filepath, status: '?' });
    });
  }

  let ahead = 0;
  let behind = 0;
  if (upstreamRes.code === 0) {
    const upstream = upstreamRes.stdout.trim();
    const countResult = await git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], wsPath);
    if (countResult.code === 0) {
      const parts = countResult.stdout.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    }
  }

  res.json({
    isGit: true,
    branch,
    ahead,
    behind,
    statusShort,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    totalChanges: stagedFiles.length + unstagedFiles.length + untrackedFiles.length,
    path: wsPath
  });
});

app.get('/api/git/diff', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file, staged = false } = req.query;
  const args = ['diff'];
  if (staged === 'true') args.push('--cached');
  else args.push('HEAD');
  if (file) args.push('--', String(file));

  const diffResult = await git(args, wsPath);
  res.json({
    diff: diffResult.stdout || diffResult.stderr || 'No differences',
    file: file || null,
    staged: staged === 'true'
  });
});

app.get('/api/git/branches', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const branchList = await git(['branch', '--all'], wsPath);
  if (branchList.code !== 0) {
    return res.status(400).json({ error: branchList.stderr || 'Failed to list branches' });
  }

  const branches = branchList.stdout.split('\n')
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => ({
      name: b.replace(/^\*\s*/, '').replace(/^remotes\//, ''),
      current: b.startsWith('*')
    }));

  res.json({ branches });
});

const SAFE_REF = /^(?!\/)(?!-)[\w./\-]+$/; // no leading dash (option injection), no spaces

app.post('/api/git/checkout', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { branch, create = false } = req.body;
  if (!branch || !SAFE_REF.test(branch)) {
    return res.status(400).json({ error: 'Invalid branch name' });
  }

  const result = create
    ? await git(['checkout', '-b', branch], wsPath)
    : await git(['checkout', branch], wsPath);

  if (result.code === 0) {
    res.json({ status: 'success', branch, message: result.stdout || result.stderr });
  } else {
    res.status(400).json({ error: result.stderr || 'Checkout failed' });
  }
});

app.post('/api/git/stage', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const files = Array.isArray(req.body.files) ? req.body.files.map(String) : [];
  const args = ['add', '--'];
  if (files.length === 0) args.push('-A');
  else args.push(...files.filter(f => !f.includes('..')));

  const result = await git(args, wsPath);
  if (result.code === 0) {
    res.json({ status: 'success', message: 'Staged changes' });
  } else {
    res.status(400).json({ error: result.stderr });
  }
});

app.post('/api/git/unstage', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const files = Array.isArray(req.body.files) ? req.body.files.map(String) : [];
  const args = ['restore', '--staged', '--'];
  if (files.length === 0) args.push('.');
  else args.push(...files.filter(f => !f.includes('..')));

  const result = await git(args, wsPath);
  if (result.code === 0) {
    res.json({ status: 'success', message: 'Unstaged changes' });
  } else {
    res.status(400).json({ error: result.stderr });
  }
});

app.post('/api/git/commit', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const message = String(req.body.message || '').trim();
  const authorName = String(req.body.authorName || 'Oroborous Agent').replace(/["\\\n\r]/g, '');
  const authorEmail = String(req.body.authorEmail || 'agent@oroborous.local').replace(/["\\\n\r]/g, '');

  if (!message) return res.status(400).json({ error: 'Commit message is required' });

  const result = await git(
    ['-c', `user.name=${authorName}`, '-c', `user.email=${authorEmail}`, 'commit', '-m', message],
    wsPath
  );

  if (result.code === 0) {
    const hashRes = await git(['rev-parse', 'HEAD'], wsPath);
    res.json({
      status: 'success',
      commitHash: hashRes.stdout.trim(),
      message: result.stdout
    });
  } else {
    res.status(400).json({ error: result.stderr || result.stdout });
  }
});

app.post('/api/git/push', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const result = await git(['push'], wsPath, 120000);
  if (result.code === 0) {
    res.json({ status: 'success', message: result.stdout || result.stderr });
  } else {
    res.status(400).json({ error: result.stderr || result.stdout });
  }
});

app.post('/api/git/pull', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const result = await git(['pull'], wsPath, 120000);
  if (result.code === 0) {
    res.json({ status: 'success', message: result.stdout || result.stderr });
  } else {
    res.status(400).json({ error: result.stderr || result.stdout });
  }
});

app.get('/api/git/log', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const result = await git(
    ['log', `-n`, String(limit), '--pretty=format:%H|%h|%an|%ar|%s'],
    wsPath
  );

  if (result.code !== 0) {
    return res.json({ commits: [] });
  }

  const commits = result.stdout.split('\n')
    .filter(Boolean)
    .map(line => {
      const [fullHash, shortHash, author, timeAgo, ...rest] = line.split('|');
      return { fullHash, shortHash, author, timeAgo, message: rest.join('|') };
    });

  res.json({ commits });
});

app.post('/api/git/discard', async (req, res) => {
  const wsPath = getActiveWorkspacePath();
  if (!wsPath) return res.status(400).json({ error: 'No active workspace' });

  const { file } = req.body;
  if (file) {
    if (!SAFE_REF.test(file) || file.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    const result = await git(['checkout', 'HEAD', '--', file], wsPath);
    if (result.code !== 0) return res.status(400).json({ error: result.stderr });
    return res.json({ status: 'success', message: 'Discarded changes' });
  }

  const reset = await git(['reset', '--hard', 'HEAD'], wsPath);
  if (reset.code !== 0) return res.status(400).json({ error: reset.stderr });
  await git(['clean', '-fd'], wsPath);
  res.json({ status: 'success', message: 'Discarded all changes' });
});

// 8. Terminal Command Execution (auth-gated arbitrary execution — by design)
app.post('/api/terminal/run', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'Command is required' });

  let wsPath = getActiveWorkspacePath() || process.cwd();
  if (cwd) {
    const resolvedCwd = resolveWithin(getActiveWorkspacePath() || process.cwd(), cwd);
    if (resolvedCwd) wsPath = resolvedCwd;
  }

  const result = await runCmd(command, wsPath);

  res.json({
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    elapsed: result.elapsed,
    cwd: wsPath
  });
});

// 9. AI Unified Proxy API
app.post('/api/ai/chat', express.json({ limit: '10mb' }), async (req, res) => {
  const { messages, model, systemPrompt, temperature = 0.2, maxTokens = 4096 } = req.body;
  const aiSettings = config.aiSettings || {};
  const provider = aiSettings.provider || 'openrouter';
  const apiKey = aiSettings.apiKey;
  const baseUrl = aiSettings.baseUrl || 'https://openrouter.ai/api/v1';

  try {
    let endpoint = '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    if (provider === 'anthropic' || provider === 'claude') {
      endpoint = `${baseUrl.replace(/\/$/, '')}/messages`;
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: model || aiSettings.primaryModel || 'claude-3-5-sonnet-20241022',
        system: systemPrompt || undefined,
        messages: (messages || []).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        max_tokens: maxTokens,
        temperature
      };
    } else if (provider === 'gemini') {
      endpoint = `${baseUrl.replace(/\/$/, '')}/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
      const contents = (messages || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      body = {
        contents,
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      };
    } else if (provider === 'ollama') {
      endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`;
      body = {
        model: model || aiSettings.primaryModel || 'llama3',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...(messages || [])
        ],
        stream: false,
        options: { temperature }
      };
    } else {
      endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/walsoup/Oroborous';
        headers['X-Title'] = 'Oroborous Agentic IDE';
      }
      body = {
        model: model || aiSettings.primaryModel || 'anthropic/claude-3.5-sonnet',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...(messages || [])
        ],
        temperature,
        max_tokens: maxTokens
      };
    }

    const upstreamAbort = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamAbort.abort(), 120000);

    // Propagate client cancellation to the upstream provider
    req.on('close', () => upstreamAbort.abort());

    let fetchResponse;
    try {
      fetchResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: upstreamAbort.signal
      });
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!fetchResponse.ok) {
      const errText = await fetchResponse.text();
      return res.status(fetchResponse.status).json({
        error: `AI Provider (${provider}) error: ${errText.slice(0, 2000)}`
      });
    }

    const data = await fetchResponse.json();
    let replyText = '';

    if (provider === 'anthropic' || provider === 'claude') {
      replyText = data.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'ollama') {
      replyText = data.message?.content || '';
    } else {
      replyText = data.choices?.[0]?.message?.content || '';
    }

    res.json({
      role: 'assistant',
      content: replyText,
      model: model || aiSettings.primaryModel,
      usage: data.usage || null
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(499).json({ error: 'Request cancelled' });
    }
    res.status(500).json({ error: `Agent Proxy Error: ${err.message}` });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🐍 Oroborous Server v2.0 listening on http://${HOST}:${PORT}`);
  if (HOST === '127.0.0.1') {
    console.log('   (localhost-only. Set HOST=0.0.0.0 to expose on LAN — at your own risk.)');
  }
  console.log(`🔑 Pairing token: ${config.authToken}`);
  console.log(`   Paste this into Oroborous Settings → Server Token.`);
});
