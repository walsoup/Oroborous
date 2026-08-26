import { runAgentTask as runEngineTask, getActiveAgentsList, cancelAgentTask, cancelAllAgents } from './agentEngine';

export const getActiveAgents = getActiveAgentsList;
export const stopAgent = cancelAgentTask;
export const stopAllAgents = cancelAllAgents;

export async function runAgentTask(taskPrompt, onStepCallback, agentType = 'primary') {
  return runEngineTask(taskPrompt, (event) => {
    if (!onStepCallback) return;

    if (event.type === 'agent_started') {
      // Preserve agentId so the UI can wire the Stop button to this session
      onStepCallback({ type: 'info', text: event.message, agentId: event.agentId });
    } else if (event.type === 'step_start') {
      onStepCallback({ type: 'info', text: `Step ${event.step}/${event.maxSteps}: Reasoning...` });
    } else if (event.type === 'agent_thought') {
      onStepCallback({ type: 'thought', text: event.content });
    } else if (event.type === 'tool_start') {
      onStepCallback({ type: 'tool_start', tool: event.tool, details: event.details, id: event.id });
    } else if (event.type === 'tool_end') {
      onStepCallback({ type: 'tool_end', tool: event.tool, result: event.result, id: event.id, isError: event.isError });
    } else if (event.type === 'final_answer') {
      onStepCallback({ type: 'final_answer', text: event.content });
    } else if (event.type === 'error') {
      onStepCallback({ type: 'error', text: event.message || event.text });
    } else if (event.type === 'warning') {
      onStepCallback({ type: 'warning', text: event.message });
    } else if (event.type === 'plan_update') {
      onStepCallback({ type: 'plan_update', todos: event.todos });
    } else if (event.type === 'subagent_start' || event.type === 'miniagent_start') {
      onStepCallback({ type: 'info', text: `${event.prefix || '[Agent]'} Delegating: ${event.task}` });
    } else if (event.type === 'agent_aborted') {
      onStepCallback({ type: 'warning', text: event.message });
    }
  }, agentType);
}
