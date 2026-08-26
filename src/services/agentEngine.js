import { api } from './api';

// Registry of active running agents
const activeAgentControllers = new Map();

export const getActiveAgentsList = () => {
  return Array.from(activeAgentControllers.values()).map(a => ({
    id: a.id,
    type: a.type,
    task: a.task,
    startTime: a.startTime,
    status: a.status,
  }));
};

export const cancelAgentTask = (agentId) => {
  if (!agentId) return false;
  const agent = activeAgentControllers.get(agentId);
  if (agent) {
    agent.aborted = true;
    agent.status = 'cancelled';
    // Abort any in-flight model request immediately
    try { agent.abortController?.abort(); } catch (_) {}
    return true;
  }
  return false;
};

export const cancelAllAgents = () => {
  activeAgentControllers.forEach(a => {
    a.aborted = true;
    a.status = 'cancelled';
    try { a.abortController?.abort(); } catch (_) {}
  });
};

const MAX_TOOL_OUTPUT_CHARS = 8000;

// Truncate large tool outputs before they enter model context (head + tail)
function truncateForContext(text, maxChars = MAX_TOOL_OUTPUT_CHARS) {
  if (!text || text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(-Math.floor(maxChars * 0.25));
  return `${head}\n\n...[output truncated, ${text.length - maxChars} chars omitted]...\n\n${tail}`;
}

const PRIMARY_AGENT_PROMPT = `You are Oroborous, the elite mobile agentic software engineer.
You are running directly inside the user's workspace with real tools to inspect, edit, build, and test software.

CORE PHILOSOPHY (Claude Code & Cursor standards):
1. UNDERSTAND FIRST: Read directory structure, inspect existing code, and grep before modifying anything.
2. SURGICAL PRECISION: Make minimal, targeted, idiomatic changes. Never truncate with placeholders.
3. SELF-VERIFICATION: Always verify your changes (run tests, lint, or syntax checks) using run_command before concluding.
4. BE CONCISE & DIRECT: No chatty fluff or generic advice. Report technical actions and outcomes.
5. PLAN MULTI-STEP TASKS: Use update_plan to break complex work into clear actionable todo steps.

TOOLS AVAILABLE:
To call a tool, output a clean JSON block or XML tag:

JSON FORMAT:
\`\`\`json
{
  "tool": "tool_name",
  "args": { ... }
}
\`\`\`

OR XML FORMAT:
<tool_call name="tool_name">
{ ...json arguments... }
</tool_call>

TOOL DEFINITIONS:
1. read_file: { "path": "src/App.js", "startLine": 1, "endLine": 100 }
2. write_file: { "path": "src/App.js", "content": "full file content" }
3. patch_file: { "path": "src/App.js", "oldText": "code to replace", "newText": "replacement code" }
4. list_files: {}
5. search_code: { "query": "function calculateTotal", "caseSensitive": false }
6. run_command: { "command": "npm test" }
7. git_status: {}
8. git_diff: { "file": "optional/file.js" }
9. git_stage: { "files": ["src/App.js"] }
10. git_commit: { "message": "feat: add user auth" }
11. update_plan: { "todos": [{ "task": "Design schema", "status": "completed" }, { "task": "Implement route", "status": "in_progress" }] }

IMPORTANT FORMATTING RULES:
- When writing file content via write_file, do NOT include triple-backtick sequences inside the JSON string. Use single backticks instead.
- For patch_file, oldText must match the file content EXACTLY and UNIQUELY (one occurrence only).

When your work is done and verified, provide a final concise summary without tool calls.
`;

const SUBAGENT_PROMPT = `You are an Oroborous Sub-Agent delegated to complete a focused sub-task.
Focus strictly on the sub-task. Use list_files, read_file, patch_file, write_file, and run_command to accomplish and verify your goal.
Keep outputs minimal and technical. Report only results upon completion.`;

const MINIAGENT_PROMPT = `You are an Oroborous Mini-Agent. You handle fast, single-turn edits, quick fixes, or command verifications.
Make the change directly, verify it, and return a 1-2 sentence summary.`;

// Parser to extract tool calls from both JSON blocks and XML tags.
// Collects parse failures so callers can give the model corrective feedback.
export function parseToolCallsFromText(text) {
  const toolCalls = [];
  const parseErrors = [];

  // 1. Check for ```json { "tool": "...", "args": { ... } } ```
  const jsonCodeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = jsonCodeBlockRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let recognizedAny = false;
      for (const item of items) {
        if (item && (item.tool || item.name)) {
          recognizedAny = true;
          toolCalls.push({
            tool: item.tool || item.name,
            args: item.args || item.arguments || item.params || {}
          });
        }
      }
      // A valid JSON block that isn't a tool call is just prose/code — ignore silently.
      // But malformed JSON that LOOKS like it was meant to be a tool call is an error.
    } catch (e) {
      if (/"\s*tool\s*"|"\s*name\s*"/.test(raw)) {
        parseErrors.push(`Malformed JSON tool block failed to parse: ${e.message}. Block started with: ${raw.slice(0, 80)}`);
      }
    }
  }

  // 2. Check for XML format: <tool_call name="...">...</tool_call>
  const xmlToolCallRegex = /<tool_call\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/tool_call>/g;
  while ((match = xmlToolCallRegex.exec(text)) !== null) {
    const toolName = match[1];
    let args = {};
    try {
      args = JSON.parse(match[2].trim());
    } catch (e) {
      parseErrors.push(`Tool <${toolName}> arguments were not valid JSON: ${e.message}`);
      args = { content: match[2].trim() };
    }
    toolCalls.push({ tool: toolName, args });
  }

  // 3. Fallback check for direct XML tags (taught formats only)
  const directXmlTags = [
    { regex: /<read_file\s+path=["']([^"']+)["']\s*\/>/g, handler: (m) => ({ tool: 'read_file', args: { path: m[1] } }) },
    { regex: /<write_file\s+path=["']([^"']+)["']>([\s\S]*?)<\/write_file>/g, handler: (m) => ({ tool: 'write_file', args: { path: m[1], content: m[2] } }) },
    { regex: /<run_command>([\s\S]*?)<\/run_command>/g, handler: (m) => ({ tool: 'run_command', args: { command: m[1].trim() } }) },
    { regex: /<search_code\s+query=["']([^"']+)["']\s*\/>/g, handler: (m) => ({ tool: 'search_code', args: { query: m[1] } }) },
    { regex: /<list_files\s*\/>/g, handler: () => ({ tool: 'list_files', args: {} }) },
    { regex: /<git_status\s*\/>/g, handler: () => ({ tool: 'git_status', args: {} }) },
    { regex: /<git_diff(?:\s+file=["']([^"']+)["'])?\s*\/>/g, handler: (m) => ({ tool: 'git_diff', args: { file: m[1] || null } }) },
  ];

  for (const direct of directXmlTags) {
    let dMatch;
    while ((dMatch = direct.regex.exec(text)) !== null) {
      toolCalls.push(direct.handler(dMatch));
    }
  }

  return { toolCalls, parseErrors };
}

// Execute individual tool with full error resilience
async function executeTool(toolName, args, onEvent, depth) {
  switch (toolName) {
    case 'list_files': {
      const res = await api.listFiles();
      const files = res.files || [];
      return `Workspace files (${files.length} found):\n` + files.slice(0, 80).join('\n') + (files.length > 80 ? `\n...and ${files.length - 80} more files` : '');
    }

    case 'read_file': {
      const filePath = args.path || args.file;
      if (!filePath) throw new Error('Missing file path');
      const res = await api.readFile(filePath);
      const lines = res.content.split('\n');
      const start = Math.max(1, parseInt(args.startLine, 10) || 1);
      const end = Math.min(lines.length, parseInt(args.endLine, 10) || lines.length);
      const sliced = lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
      return truncateForContext(`File: ${filePath} (lines ${start}-${end} of ${lines.length})\n\`\`\`\n${sliced}\n\`\`\``);
    }

    case 'write_file': {
      const filePath = args.path || args.file;
      if (!filePath) throw new Error('Missing file path');
      await api.writeFile(filePath, args.content || '');
      return `Successfully wrote ${(args.content || '').length} characters to ${filePath}`;
    }

    case 'patch_file': {
      const filePath = args.path || args.file;
      if (!filePath) throw new Error('Missing file path');
      const oldText = args.oldText ?? args.old_text;
      const newText = args.newText ?? args.new_text ?? '';
      if (!oldText) throw new Error('Missing oldText to replace');

      const fileRes = await api.readFile(filePath);
      const content = fileRes.content;

      const firstIdx = content.indexOf(oldText);
      if (firstIdx === -1) {
        throw new Error(`Target text was not found in ${filePath}. Re-read the file and retry with EXACT text.`);
      }
      const secondIdx = content.indexOf(oldText, firstIdx + 1);
      if (secondIdx !== -1 && !args.replaceAll) {
        throw new Error(`Target text matches MULTIPLE locations in ${filePath}. Include more surrounding context in oldText to make it unique.`);
      }

      // Function-form replacement prevents "$&"-style pattern injection corrupting files
      const occurrences = secondIdx === -1 ? 1 : content.split(oldText).length - 1;
      const updated = args.replaceAll
        ? content.split(oldText).join(newText)
        : content.replace(oldText, () => newText);

      await api.writeFile(filePath, updated);
      return `Successfully patched ${filePath} (${occurrences} occurrence${occurrences === 1 ? '' : 's'} replaced)`;
    }

    case 'search_code': {
      const query = args.query || args.pattern;
      if (!query) throw new Error('Missing search query');
      const res = await api.searchFiles(query, args.caseSensitive || false);
      if (!res.matches || res.matches.length === 0) {
        return `No matches found for query: "${query}"`;
      }
      return truncateForContext(`Found ${res.total} matches for "${query}":\n` + res.matches.slice(0, 30).map(m => `${m.file}:${m.line}  ${m.text}`).join('\n'));
    }

    case 'run_command': {
      const command = args.command || args.cmd;
      if (!command) throw new Error('Missing command');
      const res = await api.runTerminalCommand(command);
      return truncateForContext(`Exit Code: ${res.code} (elapsed: ${res.elapsed || 0}ms)\nStdout:\n${res.stdout || '(none)'}\nStderr:\n${res.stderr || '(none)'}`);
    }

    case 'git_status': {
      const res = await api.getGitStatus();
      if (!res.isGit) return 'Not a git repository.';
      return `Git Status:\nBranch: ${res.branch} (Ahead: ${res.ahead}, Behind: ${res.behind})\nTotal Changes: ${res.totalChanges || 0}\n\nStaged:\n${(res.stagedFiles || []).map(f => `  [${f.status}] ${f.file}`).join('\n') || '  (none)'}\nUnstaged:\n${(res.unstagedFiles || []).map(f => `  [${f.status}] ${f.file}`).join('\n') || '  (none)'}\nUntracked:\n${(res.untrackedFiles || []).map(f => `  [?] ${f.file}`).join('\n') || '  (none)'}`;
    }

    case 'git_diff': {
      const res = await api.getGitDiff(args.file, args.staged || false);
      return truncateForContext(`Git Diff ${args.file ? `for ${args.file}` : '(all files)'}:\n\`\`\`diff\n${res.diff || 'No diff found'}\n\`\`\``);
    }

    case 'git_stage': {
      const files = args.files || (args.file ? [args.file] : []);
      await api.stageGit(files);
      return `Staged ${files.length ? files.join(', ') : 'all files'}`;
    }

    case 'git_commit': {
      if (!args.message) throw new Error('Commit message is required');
      const res = await api.commitGit(args.message);
      return `Committed: ${res.commitHash || 'success'} - "${args.message}"`;
    }

    case 'update_plan': {
      if (onEvent && args.todos) {
        onEvent({ type: 'plan_update', todos: args.todos });
      }
      return `Plan updated with ${args.todos?.length || 0} items.`;
    }

    case 'spawn_subagent':
    case 'spawn_miniagent': {
      if (depth >= 1) {
        return 'Sub-agent delegation is not allowed beyond depth 1. Handle this task directly with your own tools.';
      }
      const nestedType = toolName === 'spawn_subagent' ? 'sub' : 'mini';
      const label = toolName === 'spawn_subagent' ? 'Sub-Agent' : 'Mini-Agent';
      onEvent?.({ type: 'subagent_start', task: args.task });
      const result = await runAgentTask(args.task, (subEvent) => {
        onEvent?.({ ...subEvent, prefix: `[${label}]` });
      }, nestedType, depth + 1);
      return `${label} completed with result:\n${result}`;
    }

    default:
      throw new Error(`Unknown tool: "${toolName}". Available tools: list_files, read_file, write_file, patch_file, search_code, run_command, git_status, git_diff, git_stage, git_commit, update_plan, spawn_subagent, spawn_miniagent`);
  }
}

// Main autonomous agent runner. Returns final answer text.
// Emits agent_started event carrying agentId so UIs can wire cancellation.
export async function runAgentTask(taskPrompt, onEvent, agentType = 'primary', depth = 0) {
  const agentId = 'agent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const abortController = new AbortController();
  const controller = {
    id: agentId,
    type: agentType,
    task: taskPrompt,
    startTime: new Date(),
    status: 'running',
    aborted: false,
    abortController
  };

  activeAgentControllers.set(agentId, controller);

  try {
    const config = await api.getConfig();
    const aiSettings = config.aiSettings || {};

    let systemPrompt = PRIMARY_AGENT_PROMPT;
    let maxSteps = 20;

    if (agentType === 'sub') {
      systemPrompt = SUBAGENT_PROMPT;
      maxSteps = 10;
    } else if (agentType === 'mini') {
      systemPrompt = MINIAGENT_PROMPT;
      maxSteps = 5;
    }

    const messages = [
      { role: 'user', content: taskPrompt }
    ];

    onEvent?.({
      type: 'agent_started',
      agentId,
      agentType,
      task: taskPrompt,
      message: `Started ${agentType.toUpperCase()} Agent session`
    });

    let step = 0;
    let finalAnswer = '';

    while (step < maxSteps) {
      if (controller.aborted) {
        onEvent?.({ type: 'agent_aborted', message: 'Agent was stopped by user.' });
        controller.status = 'cancelled';
        return 'Task was cancelled by user.';
      }

      step++;
      onEvent?.({ type: 'step_start', step, maxSteps });

      // Call AI model (abortable)
      let replyContent = '';
      try {
        const modelToUse = agentType === 'sub'
          ? (aiSettings.subAgentModel || aiSettings.primaryModel)
          : agentType === 'mini'
          ? (aiSettings.miniAgentModel || aiSettings.primaryModel)
          : aiSettings.primaryModel;

        const aiResponse = await api.chatAI({
          messages,
          model: modelToUse,
          systemPrompt,
          temperature: aiSettings.temperature || 0.2,
          signal: abortController.signal
        });

        replyContent = aiResponse.content || '';
      } catch (err) {
        if (controller.aborted || err.name === 'AbortError') {
          onEvent?.({ type: 'agent_aborted', message: 'Agent was stopped by user.' });
          controller.status = 'cancelled';
          return 'Task was cancelled by user.';
        }
        onEvent?.({ type: 'error', message: `Model request failed: ${err.message}` });
        controller.status = 'failed';
        throw err;
      }

      messages.push({ role: 'assistant', content: replyContent });
      onEvent?.({ type: 'agent_thought', content: replyContent, step });

      // Parse tool calls (with failure reporting)
      const { toolCalls, parseErrors } = parseToolCallsFromText(replyContent);

      if (parseErrors.length > 0) {
        onEvent?.({ type: 'warning', message: `${parseErrors.length} tool block(s) failed to parse` });
        // Corrective feedback loop so the model can re-issue its broken tool calls
        messages.push({
          role: 'user',
          content: `Your previous reply contained tool call(s) that FAILED TO PARSE:\n${parseErrors.map(e => '- ' + e).join('\n')}\n\nRe-issue them as clean \`\`\`json blocks with "tool" and "args" fields. Do not repeat surrounding prose.`
        });
        continue;
      }

      if (toolCalls.length === 0) {
        finalAnswer = replyContent;
        onEvent?.({ type: 'final_answer', content: finalAnswer });
        controller.status = 'completed';
        return finalAnswer;
      }

      // Execute each tool call sequentially (ordering matters for file edits)
      const resultsSummary = [];
      for (const call of toolCalls) {
        if (controller.aborted) break;

        const callId = 'call-' + Math.random().toString(36).slice(2, 8);
        onEvent?.({
          type: 'tool_start',
          id: callId,
          tool: call.tool,
          args: call.args,
          details: JSON.stringify(call.args)
        });

        let output = '';
        let isError = false;

        try {
          output = await executeTool(call.tool, call.args, onEvent, depth);
        } catch (toolErr) {
          isError = true;
          output = `Error in tool ${call.tool}: ${toolErr.message}`;
        }

        onEvent?.({
          type: 'tool_end',
          id: callId,
          tool: call.tool,
          result: output,
          isError
        });

        resultsSummary.push(`[Result of ${call.tool}]:\n${output}`);
      }

      if (controller.aborted) {
        onEvent?.({ type: 'agent_aborted', message: 'Agent cancelled during tool execution.' });
        controller.status = 'cancelled';
        return 'Task cancelled.';
      }

      // Feed results back into conversation
      messages.push({
        role: 'user',
        content: `Tool Execution Output:\n\n${resultsSummary.join('\n\n---\n\n')}\n\nPlease analyze these results and proceed to the next step or conclude.`
      });
    }

    const limitMsg = 'Reached step limit without full conclusion. Last actions applied.';
    onEvent?.({ type: 'warning', message: limitMsg });
    controller.status = 'completed';
    return finalAnswer || limitMsg;
  } finally {
    activeAgentControllers.delete(agentId);
  }
}
