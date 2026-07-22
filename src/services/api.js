import { Platform } from 'react-native';
import OroborousNative from 'oroborous-native';

// Default backend URL. On Android emulator, localhost is 10.0.2.2.
// For web, it's localhost.
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3005' : 'http://localhost:3005';

let serverUrl = DEFAULT_URL;

export const getServerUrl = () => serverUrl;
export const setServerUrl = (url) => {
  serverUrl = url;
};

// Local config cache for native mode
let localConfig = {
  workspaces: [],
  activeWorkspaceId: null,
  aiSettings: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3',
  },
  vibeMode: true
};

const loadLocalConfig = async () => {
  if (!OroborousNative) return;
  try {
    const content = await OroborousNative.readConfigFile('oroborous-config.json');
    if (content && typeof content === 'string') {
      localConfig = JSON.parse(content);
    }
  } catch (e) {
    console.warn('Failed to load local config:', e);
  }
};

const saveLocalConfig = async (newConfig) => {
  if (!OroborousNative) return;
  try {
    localConfig = { ...localConfig, ...newConfig };
    await OroborousNative.writeConfigFile('oroborous-config.json', JSON.stringify(localConfig, null, 2));
  } catch (e) {
    console.warn('Failed to save local config:', e);
  }
};

const request = async (endpoint, options = {}) => {
  const url = `${serverUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Request failed: ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return response.json();
};

export const api = {
  getHealth: async () => {
    if (OroborousNative) {
      return { status: 'ok', message: 'Oroborous Native Module is running' };
    }
    return request('/api/health');
  },
  
  getConfig: async () => {
    if (OroborousNative) {
      await loadLocalConfig();
      return localConfig;
    }
    return request('/api/config');
  },

  saveConfig: async (configData) => {
    if (OroborousNative) {
      await saveLocalConfig(configData);
      return { status: 'success', config: localConfig };
    }
    return request('/api/config', {
      method: 'POST',
      body: JSON.stringify(configData),
    });
  },

  getWorkspaces: async () => {
    if (OroborousNative) {
      await loadLocalConfig();
      return localConfig.workspaces || [];
    }
    return request('/api/workspaces');
  },

  selectWorkspace: async (dirPath) => {
    if (OroborousNative) {
      const res = await OroborousNative.validateDirectory(dirPath);
      if (!res.exists || !res.isDirectory) {
        throw new Error(`Directory does not exist: ${dirPath}`);
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
    return request('/api/workspaces/select', {
      method: 'POST',
      body: JSON.stringify({ dirPath }),
    });
  },

  activateWorkspace: async (id) => {
    if (OroborousNative) {
      await loadLocalConfig();
      const ws = localConfig.workspaces.find(w => w.id === id);
      if (!ws) throw new Error('Workspace not found');
      localConfig.activeWorkspaceId = id;
      await saveLocalConfig(localConfig);
      return { status: 'success', activeWorkspaceId: id };
    }
    return request('/api/workspaces/activate', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  deleteWorkspace: async (id) => {
    if (OroborousNative) {
      await loadLocalConfig();
      localConfig.workspaces = localConfig.workspaces.filter(w => w.id !== id);
      if (localConfig.activeWorkspaceId === id) {
        localConfig.activeWorkspaceId = localConfig.workspaces.length > 0 ? localConfig.workspaces[0].id : null;
      }
      await saveLocalConfig(localConfig);
      return { status: 'success', workspaces: localConfig.workspaces };
    }
    return request(`/api/workspaces/${id}`, {
      method: 'DELETE',
    });
  },

  cloneWorkspace: async (repoUrl, targetDir) => {
    if (OroborousNative) {
      const repoName = repoUrl.split('/').pop().replace(/\.git$/, '') || 'cloned-repo';
      // Default to /sdcard/Download/workspaces/ or internal app filesDir if targetDir not specified
      const clonePath = targetDir ? targetDir : `/sdcard/Download/workspaces/${repoName}`;
      
      // Async clone in background
      OroborousNative.executeCommand(`git clone "${repoUrl}" "${clonePath}"`, '/').then(async (res) => {
        if (res.code === 0) {
          await loadLocalConfig();
          const id = encodeURIComponent(clonePath).replace(/%/g, '_');
          localConfig.workspaces.push({ id, name: repoName, path: clonePath });
          localConfig.activeWorkspaceId = id;
          await saveLocalConfig(localConfig);
        }
      });

      return { status: 'started', message: 'Cloning repository...', path: clonePath };
    }
    return request('/api/workspaces/clone', {
      method: 'POST',
      body: JSON.stringify({ repoUrl, targetDir }),
    });
  },

  getGitStatus: async () => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      if (!activeWs) throw new Error('No active workspace selected');
      return OroborousNative.getGitStatus(activeWs.path);
    }
    return request('/api/git/status');
  },

  getGitDiff: async (file) => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      if (!activeWs) throw new Error('No active workspace selected');
      return OroborousNative.getGitDiff(activeWs.path, file || null);
    }
    const query = file ? `?file=${encodeURIComponent(file)}` : '';
    return request(`/api/git/diff${query}`);
  },

  runTerminalCommand: async (command) => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      const wsPath = activeWs ? activeWs.path : '/';
      return OroborousNative.executeCommand(command, wsPath);
    }
    return request('/api/terminal/run', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  },

  readFile: async (file) => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      if (!activeWs) throw new Error('No active workspace selected');
      const content = await OroborousNative.readFileContent(activeWs.path, file);
      const safeContent = (typeof content === 'string') ? content : '';
      if (safeContent.startsWith('Error:')) {
        throw new Error(safeContent);
      }
      return { content: safeContent };
    }
    return request(`/api/files?file=${encodeURIComponent(file)}`);
  },

  writeFile: async (file, content) => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      if (!activeWs) throw new Error('No active workspace selected');
      const success = await OroborousNative.writeFileContent(activeWs.path, file, content);
      if (!success) throw new Error(`Failed to write file: ${file}`);
      return { status: 'success' };
    }
    return request('/api/files', {
      method: 'POST',
      body: JSON.stringify({ file, content }),
    });
  },

  listFiles: async () => {
    if (OroborousNative) {
      await loadLocalConfig();
      const activeWs = localConfig.workspaces.find(w => w.id === localConfig.activeWorkspaceId);
      if (!activeWs) throw new Error('No active workspace selected');
      const files = await OroborousNative.listFiles(activeWs.path);
      return { files: Array.isArray(files) ? files : [] };
    }
    return request('/api/files/list');
  },
};
