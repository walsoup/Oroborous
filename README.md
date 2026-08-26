# 🐍 Oroborous `v1.2` (Stable Release)

> **The Mobile-First Agentic IDE.** Vibe code anywhere, right from your phone.
>
> **Developer:** [itswal](https://github.com/walsoup) • **Contact:** [me@itswal.me](mailto:me@itswal.me)

Oroborous is a next-generation mobile-first agentic IDE designed for developers who want to manage repositories, run full terminal sessions, interactively edit code with live line numbers & syntax snippets, and collaborate with autonomous coding agents directly on their mobile devices.

---

## 📱 Interface Preview

| 🔐 Login Screen | 📂 Workspaces Dashboard |
| :---: | :---: |
| ![Login Screen](assets/screenshots/login.png) | ![Dashboard](assets/screenshots/dashboard.png) |

| 💻 Workspace IDE Studio | ⚙️ Settings |
| :---: | :---: |
| ![Workspace IDE](assets/screenshots/workspace.png) | ![Settings](assets/screenshots/settings.png) |

---

## 🚀 Key Features

* 🤖 **Autonomous Multi-Agent Studio**:
  - Primary, Sub-Agents, and Mini-Agents powered by Claude 3.7 / 3.5 Sonnet, Gemini 2.0, DeepSeek, or OpenRouter.
  - Dual JSON schema & resilient XML tool calling protocol for 100% tool reliability.
  - Live Task Goal Plan HUD (`update_plan`) with real-time multi-step progress tracking.
  - Automatic git checkpoints with 1-tap time-travel rewind (Chat Only or Reset Code & Chat).
  - Quick action prompt chips (`/fix`, `/test`, `/explain`, `/refactor`, `/commit`, `/mini`).

* 📂 **Interactive Code Editor & Hierarchical File Tree**:
  - Live code editing with line numbers, search in file, syntax shortcuts bar, and unsaved state indicators.
  - Collapsible file explorer tree with file type icons, new file/folder modals, rename, and deletion.
  - Multi-tab open file buffers bar at the top for instant switching between files.

* 🌿 **Git Command Center**:
  - Visual branch switcher & new branch creation modal.
  - Ahead/behind commit counters, staged, unstaged, and untracked file groupings.
  - Syntax-colored unified diff viewer with addition (`+`) and deletion (`-`) statistics.
  - Smart commit & push/pull sync.

* ⚡ **Hyper-Terminal**:
  - Streaming command execution with ANSI color formatting and elapsed execution time.
  - Mobile quick-keys bar: `ESC`, `TAB`, `CTRL-C`, `|`, `~`, `/`, `-`, `_`, `&&`, `$`, `↑`, `↓`, `Clear`.
  - Command history memory and detected workspace script runners (npm, cargo, make, pytest).

* 🎨 **Cyberpunk Glassmorphic Design System**:
  - Material 3 Expressive aesthetics with multi-layered backdrop blurs, luminous borders, and ambient glowing orbs.
  - Tactile haptic feedback and fluid spring animations on every gesture.

* 🛠️ **Native Kotlin Layer + Companion Daemon**:
  - Custom Kotlin Expo Module (`oroborous-native`) for direct on-device shell execution and file I/O.
  - High-performance Node.js companion daemon for remote/desktop workspaces and AI proxying.

---

## 🛠️ Tech Stack

* **Frontend**: React Native, Expo (SDK 54), React Native Reanimated, Expo Haptics, Expo Blur, Expo Linear Gradient.
* **Backend**: Node.js companion daemon with Express, Git suite, filesystem grep search, and AI proxy.
* **Native Layer**: Custom Kotlin Expo Module (`oroborous-native`) for Android runtime.

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v18+)
* Android SDK / Device (for native build) or Web browser (for web preview)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/walsoup/Oroborous.git
   cd Oroborous
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Start the development environment**:
   * Start the backend daemon:
     ```bash
     node server/index.js
     ```
     The daemon binds to `127.0.0.1` only and prints a **pairing token** on startup. Paste that token into the app under **Settings → Server Pairing Token** — every API call is authenticated with it (bearer token), so nobody else on the network can run commands or read your AI keys.
   * Start the Expo client:
     ```bash
     npm run android # For Android build/run
     # OR
     npm run web     # For instant Web preview
     ```

> 🔒 **Security notes**: the daemon is localhost-only by default (`HOST=0.0.0.0` overrides), requires a bearer pairing token on all routes except `/api/health`, never echoes your provider `apiKey` back to clients, and confines all file operations inside the active workspace (traversal/symlink-safe).

---

## 📄 License

MIT © [itswal](https://github.com/walsoup)
