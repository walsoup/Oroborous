import { api } from './api';

// Registry of active agents
let activeAgents = [];

export const getActiveAgents = () => activeAgents;

// Claude Code-inspired System Prompts
const PRIMARY_SYSTEM_PROMPT = `You are the Oroborous Primary Agent, a highly capable software engineering assistant running inside the user's workspace.
Your goal is to help the user design, write, debug, and test code efficiently. You have direct access to the workspace via tools.

CLAUDE CODE STYLE RULES:
1. Be concise, direct, and professional. Avoid conversational filler, excessive apologies, or chatty preambles.
2. Gather context first. Before making edits, use list_files, read_file, or git_status to understand the workspace.
3. Make precise, minimal edits. Avoid rewriting entire files when a small, targeted change is sufficient.
4. Verify your work. Always run test suites or build commands (using run_command) after making changes to verify correctness.
5. Do not make assumptions. If a file or configuration is missing, inspect the workspace or ask.
6. When your task is complete and verified, output a concise summary of your changes and the verification results as your final response.

AVAILABLE TOOLS (Use XML-like tags):

<list_files />
- Lists all files in the workspace recursively (excluding node_modules, .git, etc.).

<read_file path="path/to/file.js" />
- Reads the content of a file.

<write_file path="path/to/file.js">
content
</write_file>
- Writes or overwrites a file.

<run_command>command</run_command>
- Runs a shell command in the active workspace directory. Use this to run tests, lint, or compile.

<git_status />
- Checks git status (modified files, branch, ahead/behind counts).

<git_diff file="optional/file.js" />
- Views git diffs for modified files.

<spawn_sub_agent task="task description" />
- Delegate a sub-task to a Sub-Agent. The sub-agent runs in its own context and returns its final answer. Use this to parallelize or delegate complex sub-tasks.

<spawn_mini_agent task="task description" />
- Delegate a quick, simple edit or verification to a Mini-Agent. Uses a smaller, faster model.

To execute a tool, write the XML tag. You can call multiple tools in a single step.
`;

const SUB_AGENT_SYSTEM_PROMPT = `You are the Oroborous Sub-Agent. You have been spawned by the Primary Agent to handle a specific, delegated sub-task.
You have the same tools available. Focus strictly on the sub-task assigned to you.

RULES:
1. Do not deviate from the assigned sub-task.
2. Make your edits clean and minimal.
3. Verify your specific changes before reporting back.
4. Keep your responses extremely concise. Report only the technical outcomes and any errors encountered.

AVAILABLE TOOLS:
<list_files />
<read_file path="path/to/file.js" />
<write_file path="path/to/file.js">content</write_file>
<run_command>command</run_command>
<git_status />
<git_diff file="optional/file.js" />
`;

const MINI_AGENT_SYSTEM_PROMPT = `You are the Oroborous Mini-Agent. You are a fast, lightweight agent optimized for small edits, quick fixes, and simple tasks.
You use a smaller, faster model. Be extremely brief.

RULES:
1. Do not write long explanations.
2. Make the edit directly and run a quick test/command to verify.
3. Keep your conversation to the absolute minimum.

AVAILABLE TOOLS:
<list_files />
<read_file path="path/to/file.js" />
<write_file path="path/to/file.js">content</write_file>
<run_command>command</run_command>
<git_status />
<git_diff file="optional/file.js" />
`;

// Helper to call LLM based on agent type and settings
async function callLLM(settings, messages, agentType = 'primary') {
  const { provider, baseUrl, apiKey, primaryModel, subAgentModel, miniAgentModel } = settings;

  // Select the model based on agent type
  let model = primaryModel;
  let systemPrompt = PRIMARY_SYSTEM_PROMPT;

  if (agentType === 'sub') {
    model = subAgentModel || primaryModel;
    systemPrompt = SUB_AGENT_SYSTEM_PROMPT;
  } else if (agentType === 'mini') {
    model = miniAgentModel || primaryModel;
    systemPrompt = MINI_AGENT_SYSTEM_PROMPT;
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  let url = '';
  let body = {};

  if (provider === 'ollama') {
    url = `${baseUrl}/api/chat`;
    body = {
      model: model || 'llama3',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: false
    };
  } else if (provider === 'claude') {
    url = `${baseUrl}/v1/messages`;
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: model || 'claude-3-5-sonnet-20241022',
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      max_tokens: 4000
    };
  } else if (provider === 'gemini') {
    if (baseUrl.includes('googleapis.com')) {
      url = `${baseUrl}/models/${model || 'gemini-1.5-pro'}:generateContent?key=${apiKey}`;
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      body = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };
    } else {
      url = `${baseUrl}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model || 'gemini-1.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      };
    }
  } else {
    url = `${baseUrl}/chat/completions`;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    body = {
      model: model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();

  if (provider === 'ollama') {
    return json.message.content;
  } else if (provider === 'claude') {
    return json.content[0].text;
  } else if (provider === 'gemini' && baseUrl.includes('googleapis.com')) {
    return json.candidates[0].content.parts[0].text;
  } else {
    return json.choices[0].message.content;
  }
}

// Main Agent Loop
export async function runAgentTask(taskPrompt, onStepCallback, agentType = 'primary') {
  const agentId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 4);
  activeAgents.push({
    id: agentId,
    type: agentType,
    task: taskPrompt,
    startTime: new Date()
  });

  try {
    const config = await api.getConfig();
    const settings = config.aiSettings;

    if (!settings || !settings.baseUrl) {
      throw new Error('AI Provider is not configured. Please go to Settings to set it up.');
    }

    let processedPrompt = taskPrompt;
    let isGoalCommand = false;

    if (taskPrompt.trim().startsWith('/goal ')) {
      isGoalCommand = true;
      processedPrompt = taskPrompt.trim().substring(6);
      onStepCallback({ type: 'info', text: '🏆 Goal Command detected. Breaking down goal into plan...' });
    }

    const messages = [{ role: 'user', content: processedPrompt }];
    let step = 0;
    const maxSteps = agentType === 'mini' ? 5 : 15;

    onStepCallback({ type: 'info', text: `Initializing Oroborous ${agentType.toUpperCase()} Agent...` });

    while (step < maxSteps) {
      step++;
      onStepCallback({ type: 'info', text: `Step ${step}: Thinking...` });

      const reply = await callLLM(settings, messages, agentType);
      messages.push({ role: 'assistant', content: reply });

      onStepCallback({ type: 'thought', text: reply });

      const toolCalls = [];

      // Parse tool tags
      const listFilesRegex = /<list_files\s*\/>/g;
      let match;
      while ((match = listFilesRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'list_files', raw: match[0] });
      }

      const readFileRegex = /<read_file\s+path="([^"]+)"\s*\/>/g;
      while ((match = readFileRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'read_file', path: match[1], raw: match[0] });
      }

      const writeFileRegex = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;
      while ((match = writeFileRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'write_file', path: match[1], content: match[2], raw: match[0] });
      }

      const runCommandRegex = /<run_command>([\s\S]*?)<\/run_command>/g;
      while ((match = runCommandRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'run_command', command: match[1], raw: match[0] });
      }

      const gitStatusRegex = /<git_status\s*\/>/g;
      while ((match = gitStatusRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'git_status', raw: match[0] });
      }

      const gitDiffRegex = /<git_diff\s*(?:file="([^"]+)")?\s*\/>/g;
      while ((match = gitDiffRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'git_diff', file: match[1] || null, raw: match[0] });
      }

      // Parse sub-agent & mini-agent delegation tags
      const spawnSubRegex = /<spawn_sub_agent\s+task="([^"]+)"\s*\/>/g;
      while ((match = spawnSubRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'spawn_sub_agent', task: match[1], raw: match[0] });
      }

      const spawnMiniRegex = /<spawn_mini_agent\s+task="([^"]+)"\s*\/>/g;
      while ((match = spawnMiniRegex.exec(reply)) !== null) {
        toolCalls.push({ name: 'spawn_mini_agent', task: match[1], raw: match[0] });
      }

      if (toolCalls.length === 0) {
        onStepCallback({ type: 'final_answer', text: reply });
        return reply;
      }

      // Execute tool calls
      const toolResults = [];
      for (const tool of toolCalls) {
        onStepCallback({ type: 'tool_start', tool: tool.name, details: tool.path || tool.command || tool.task || '' });
        let result = '';

        try {
          if (tool.name === 'list_files') {
            const res = await api.listFiles();
            result = `Files in workspace:\n${res.files.join('\n')}`;
          } else if (tool.name === 'read_file') {
            const res = await api.readFile(tool.path);
            result = `Content of ${tool.path}:\n\`\`\`\n${res.content}\n\`\`\``;
          } else if (tool.name === 'write_file') {
            await api.writeFile(tool.path, tool.content);
            result = `Successfully wrote content to ${tool.path}`;
          } else if (tool.name === 'run_command') {
            const res = await api.runTerminalCommand(tool.command);
            result = `Exit Code: ${res.code}\nStdout:\n${res.stdout}\nStderr:\n${res.stderr}`;
          } else if (tool.name === 'git_status') {
            const res = await api.getGitStatus();
            result = `Git Status:\nBranch: ${res.branch}\nAhead: ${res.ahead}, Behind: ${res.behind}\nModified:\n${res.statusShort || 'none'}`;
          } else if (tool.name === 'git_diff') {
            const res = await api.getGitDiff(tool.file);
            result = `Git Diff:\n${res.diff}`;
          } else if (tool.name === 'spawn_sub_agent') {
            onStepCallback({ type: 'info', text: `Delegating task to Sub-Agent: "${tool.task}"` });
            result = await runAgentTask(
              tool.task,
              (nestedStep) => {
                if (nestedStep.type === 'info') {
                  onStepCallback({ type: 'info', text: `↳ [Sub-Agent] ${nestedStep.text}` });
                } else if (nestedStep.type === 'tool_start') {
                  onStepCallback({ type: 'tool_start', tool: `Sub-${nestedStep.tool}`, details: nestedStep.details });
                } else if (nestedStep.type === 'tool_end') {
                  onStepCallback({ type: 'tool_end', tool: `Sub-${nestedStep.tool}`, result: nestedStep.result });
                }
              },
              'sub'
            );
          } else if (tool.name === 'spawn_mini_agent') {
            onStepCallback({ type: 'info', text: `Delegating task to Mini-Agent: "${tool.task}"` });
            result = await runAgentTask(
              tool.task,
              (nestedStep) => {
                if (nestedStep.type === 'info') {
                  onStepCallback({ type: 'info', text: `↳ [Mini-Agent] ${nestedStep.text}` });
                } else if (nestedStep.type === 'tool_start') {
                  onStepCallback({ type: 'tool_start', tool: `Mini-${nestedStep.tool}`, details: nestedStep.details });
                } else if (nestedStep.type === 'tool_end') {
                  onStepCallback({ type: 'tool_end', tool: `Mini-${nestedStep.tool}`, result: nestedStep.result });
                }
              },
              'mini'
            );
          }
        } catch (err) {
          result = `Error executing tool ${tool.name}: ${err.message}`;
        }

        onStepCallback({ type: 'tool_end', tool: tool.name, result });
        toolResults.push(`Tool ${tool.name} result:\n${result}`);
      }

      messages.push({
        role: 'user',
        content: `Tool execution results:\n\n${toolResults.join('\n\n')}\n\nPlease proceed with the task.`
      });
    }

    onStepCallback({ type: 'error', text: 'Reached maximum agent steps without completion.' });
  } catch (error) {
    onStepCallback({ type: 'error', text: `Agent Error: ${error.message}` });
  } finally {
    activeAgents = activeAgents.filter(a => a.id !== agentId);
  }
}
