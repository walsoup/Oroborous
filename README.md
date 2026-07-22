# 🐍 Oroborous `v1.1` (Stable Dev Release)

> **The Mobile-First Agentic IDE.** Vibe code anywhere, right from your phone.
>
> **Developer:** [itswal](https://github.com/walsoup) • **Contact:** [me@itswal.me](mailto:me@itswal.me)

Oroborous is a premium, mobile-first agentic IDE designed for developers who want to manage repositories, run terminal commands, and collaborate with autonomous coding agents directly on their mobile devices. 

---

## 📱 Interface Preview

Here is a look at the modern, premium glassmorphic interface designed with Material 3 Expressive principles:

| 🔐 Login Screen | 📂 Repositories Dashboard |
| :---: | :---: |
| ![Login Screen](assets/screenshots/login.png) | ![Dashboard](assets/screenshots/dashboard.png) |

| 💻 Workspace IDE | ⚙️ AI Settings |
| :---: | :---: |
| ![Workspace IDE](assets/screenshots/workspace.png) | ![Settings](assets/screenshots/settings.png) |

---

## 🚀 Key Features

*   🤖 **Multi-Agent Coding System**: Run autonomous coding agents (Primary, Sub, and Mini-agents) using Claude, Gemini, OpenRouter, or local Ollama models.
*   💻 **Integrated Terminal**: Execute shell commands, run test suites, and compile code directly in your workspace.
*   🌿 **Git & Diff Viewer**: Track modified files, inspect side-by-side diffs, stage changes, commit, and push natively to GitHub.
*   🎨 **Material 3 Expressive Design**: A premium dark-mode interface featuring glassmorphic panels, bouncy spring-based animations, and haptic feedback.
*   🛠️ **Native File & Shell Access**: Direct filesystem integration via custom native Android modules.

---

## 🛠️ Tech Stack

*   **Frontend**: React Native, Expo, React Native Reanimated (for spring animations), Expo Haptics (for premium feedback).
*   **Backend**: Node.js, Express (for remote workspace and terminal execution).
*   **Native Layer**: Custom Kotlin Expo Module (`oroborous-native`) for direct filesystem access and shell execution.

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   Android SDK / Device (for native build)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/walsoup/Oroborous.git
    cd Oroborous
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    cd server && npm install && cd ..
    ```

3.  **Start the development servers**:
    *   Start the backend server:
        ```bash
        node server/index.js
        ```
    *   Start the Expo frontend:
        ```bash
        npm run android # Runs prebuild and starts on Android
        ```
