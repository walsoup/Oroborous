import { Platform } from 'react-native';
import OroborousNative from 'oroborous-native';

const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3005' : 'http://localhost:3005';
let serverUrl = DEFAULT_URL;

export const getServerUrl = () => serverUrl;
export const setServerUrl = (url) => {
  if (url) {
    serverUrl = url.trim().replace(/\/$/, '');
  }
};

// Pairing token for the companion daemon (Authorization: Bearer <token>)
let serverToken = '';

export const getServerToken = () => serverToken;

const persistToken = async (token) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('oroborous-server-token', token);
    }
  } catch (_) {}
  try {
    if (OroborousNative) {
      await OroborousNative.writeConfigFile('oroborous-auth.json', JSON.stringify({ token }));
    }
  } catch (_) {}
};

export const setServerToken = (token) => {
  serverToken = (token || '').trim();
  persistToken(serverToken);
};

// Load persisted token at startup (call once from App before first screen)
export const initAuth = async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('oroborous-server-token');
      if (stored) {
        serverToken = stored;
        return;
      }
    }
  } catch (_) {}
  try {
    if (OroborousNative) {
      const raw = await OroborousNative.readConfigFile('oroborous-auth.json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token) serverToken = parsed.token;
      }
    }
  } catch (_) {}
};

let localConfig = {
  workspaces: [
    {
      id: 'demo-workspace',
      name: 'Oroborous Core',
      path: '/workspaces/oroborous'
    }
  ],
  activeWorkspaceId: 'demo-workspace',
  aiSettings: {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    primaryModel: 'anthropic/claude-3.5-sonnet',
    subAgentModel: 'meta-llama/llama-3.3-70b-instruct',
    miniAgentModel: 'google/gemini-2.0-flash-001',
    temperature: 0.2,
    maxTokens: 4096,
    autoApproval: true
  },
  vibeMode: true,
  theme: 'cyberpunk',
  onboardingCompleted: true
};

const loadLocalConfig = async () => {
  if (!OroborousNative) return localConfig;
  try {
    const content = await OroborousNative.readConfigFile('oroborous-config.json');
    if (content && typeof content === 'string') {
      localConfig = JSON.parse(content);
    }
  } catch (e) {
    console.warn('Failed to load local config:', e);
  }
  return localConfig;
};

const saveLocalConfig = async (newConfig) => {
  localConfig = { ...localConfig, ...newConfig };
  if (!OroborousNative) return localConfig;
  try {
    await OroborousNative.writeConfigFile('oroborous-config.json', JSON.stringify(localConfig, null, 2));
  } catch (e) {
    console.warn('Failed to save local config:', e);
  }
  return localConfig;
};

const request = async (endpoint, options = {}) => {
  const url = `${serverUrl}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 45000);

    // Combine caller-provided signal with our timeout signal
    let onExternalAbort = null;
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else {
        onExternalAbort = () => controller.abort();
        options.signal.addEventListener('abort', onExternalAbort);
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (serverToken) {
      headers['Authorization'] = `Bearer ${serverToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Request failed (${response.status})`;
        if (response.status === 401) {
          errMsg = 'Unauthorized: pairing token missing or invalid. Paste the token from the server console in Settings.';
        }
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errMsg;
        } catch (_) {
          if (errText) errMsg = errText;
        }
        throw new Error(errMsg);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
      if (onExternalAbort) options.signal.removeEventListener('abort', onExternalAbort);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
};

export const api = {
  getHealth: async () => {
    try {
      return await request('/api/health', { timeout: 3000 });
    } catch (e) {
      if (OroborousNative) {
        return { status: 'ok', message: 'Native Module Active', version: '2.0.0' };
      }
      throw e;
    }
  },

  getConfig: async () => {
    try {
      return await request('/api/config', { timeout: 3000 });
    } catch (_) {
      return loadLocalConfig();
    }
  },

  saveConfig: async (configData) => {
    try {
      return await request('/api/config', {
        method: 'POST',
        body: JSON.stringify(configData),
      });
    } catch (_) {
      await saveLocalConfig(configData);
      return { status: 'success', config: localConfig };
    }
  },

  getWorkspaces: async () => {
    try {
      return await request('/api/workspaces');
    } catch (_) {
      const cfg = await loadLocalConfig();
      return cfg.workspaces || [];
    }
  },

  selectWorkspace: async (dirPath) => {
    try {
      return await request('/api/workspaces/select', {
        method: 'POST',
        body: JSON.stringify({ dirPath }),
      });
    } catch (e) {
      if (OroborousNative) {
        const res = await OroborousNative.validateDirectory(dirPath);
        if (!res.exists || !res.isDirectory) {
          throw new Error(`Directory not found: ${dirPath}`);
        }
        await loadLocalConfig();
        const id = encodeURIComponent(res.absolutePath).replace(/%/g, '_');
        const existing = localConfig.workspaces.find(w => w.path === res.absolutePath);
        if (!existing) {
          localConfig.workspaces.push({ id, name: res.name || res.absolutePath, path: res.absolutePath });
        }
        localConfig.activeWorkspaceId = id;
        await saveLocalConfig(localConfig);
        return { status: 'success', activeWorkspaceId: id, workspaces: localConfig.workspaces };
      }
      throw e;
    }
  },

  activateWorkspace: async (id) => {
    try {
      return await request('/api/workspaces/activate', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    } catch (e) {
      await loadLocalConfig();
      const ws = localConfig.workspaces.find(w => w.id === id);
      if (!ws) throw new Error('Workspace not found');
      localConfig.activeWorkspaceId = id;
      await saveLocalConfig(localConfig);
      return { status: 'success', activeWorkspaceId: id, workspace: ws };
    }
  },

  deleteWorkspace: async (id) => {
    try {
      return await request(`/api/workspaces/${id}`, {
        method: 'DELETE',
      });
    } catch (_) {
      await loadLocalConfig();
      localConfig.workspaces = localConfig.workspaces.filter(w => w.id !== id);
      if (localConfig.activeWorkspaceId === id) {
        localConfig.activeWorkspaceId = localConfig.workspaces.length > 0 ? localConfig.workspaces[0].id : null;
      }
      await saveLocalConfig(localConfig);
      return { status: 'success', workspaces: localConfig.workspaces };
    }
  },

  cloneWorkspace: async (repoUrl, targetDir) => {
    return request('/api/workspaces/clone', {
      method: 'POST',
      body: JSON.stringify({ repoUrl, targetDir }),
    });
  },

  getProjectInfo: async () => {
    try {
      return await request('/api/project/detect');
    } catch (_) {
      return {
        type: 'generic',
        name: 'Workspace',
        scripts: { 'test': 'npm test', 'start': 'npm start' },
        frameworks: ['JavaScript']
      };
    }
  },

  getFileTree: async () => {
    return request('/api/files/tree');
  },

  readFile: async (file) => {
    if (!file) throw new Error('File path required');
    try {
      return await request(`/api/files?file=${encodeURIComponent(file)}`);
    } catch (e) {
      if (OroborousNative) {
        await loadLocalConfig();
        const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
        if (!activeWs) throw new Error('No active workspace');
        const content = await OroborousNative.readFileContent(activeWs.path, file);
        return { content: content || '', path: file };
      }
      throw e;
    }
  },

  writeFile: async (file, content) => {
    if (!file) throw new Error('File path required');
    try {
      return await request('/api/files', {
        method: 'POST',
        body: JSON.stringify({ file, content }),
      });
    } catch (e) {
      if (OroborousNative) {
        await loadLocalConfig();
        const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
        if (!activeWs) throw new Error('No active workspace');
        await OroborousNative.writeFileContent(activeWs.path, file, content);
        return { status: 'success', path: file };
      }
      throw e;
    }
  },

  deleteFile: async (file) => {
    return request('/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ file }),
    });
  },

  renameFile: async (oldPath, newPath) => {
    return request('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath }),
    });
  },

  createDir: async (dir) => {
    return request('/api/files/create-dir', {
      method: 'POST',
      body: JSON.stringify({ dir }),
    });
  },

  listFiles: async () => {
    try {
      return await request('/api/files/list');
    } catch (e) {
      if (OroborousNative) {
        await loadLocalConfig();
        const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
        if (!activeWs) throw new Error('No active workspace');
        const files = await OroborousNative.listFiles(activeWs.path);
        return { files: Array.isArray(files) ? files : [] };
      }
      throw e;
    }
  },

  searchFiles: async (query, caseSensitive = false) => {
    return request('/api/files/search', {
      method: 'POST',
      body: JSON.stringify({ query, caseSensitive }),
    });
  },

  getGitStatus: async () => {
    try {
      return await request('/api/git/status');
    } catch (e) {
      if (OroborousNative) {
        await loadLocalConfig();
        const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
        if (activeWs) return OroborousNative.getGitStatus(activeWs.path);
      }
      return { isGit: false, branch: 'main', ahead: 0, behind: 0, stagedFiles: [], unstagedFiles: [], untrackedFiles: [] };
    }
  },

  getGitDiff: async (file, staged = false) => {
    const params = new URLSearchParams();
    if (file) params.append('file', file);
    if (staged) params.append('staged', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/git/diff${query}`);
  },

  getGitBranches: async () => {
    return request('/api/git/branches');
  },

  checkoutBranch: async (branch, create = false) => {
    return request('/api/git/checkout', {
      method: 'POST',
      body: JSON.stringify({ branch, create }),
    });
  },

  stageGit: async (files = []) => {
    return request('/api/git/stage', {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  },

  unstageGit: async (files = []) => {
    return request('/api/git/unstage', {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  },

  commitGit: async (message, authorName, authorEmail) => {
    return request('/api/git/commit', {
      method: 'POST',
      body: JSON.stringify({ message, authorName, authorEmail }),
    });
  },

  pushGit: async () => {
    return request('/api/git/push', { method: 'POST' });
  },

  pullGit: async () => {
    return request('/api/git/pull', { method: 'POST' });
  },

  getGitLog: async (limit = 20) => {
    return request(`/api/git/log?limit=${limit}`);
  },

  discardGit: async (file = null) => {
    return request('/api/git/discard', {
      method: 'POST',
      body: JSON.stringify({ file }),
    });
  },

  runTerminalCommand: async (command, cwd) => {
    try {
      return await request('/api/terminal/run', {
        method: 'POST',
        body: JSON.stringify({ command, cwd }),
      });
    } catch (e) {
      if (OroborousNative) {
        await loadLocalConfig();
        const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
        const wsPath = cwd || (activeWs ? activeWs.path : '/');
        return OroborousNative.executeCommand(command, wsPath);
      }
      throw e;
    }
  },

  chatAI: async ({ messages, model, systemPrompt, temperature, maxTokens, signal }) => {
    return request('/api/ai/chat', {
      method: 'POST',
      signal,
      body: JSON.stringify({ messages, model, systemPrompt, temperature, maxTokens }),
      timeout: 90000
    });
  }
};
