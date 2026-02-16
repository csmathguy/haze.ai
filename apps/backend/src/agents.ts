export type AgentState = "idle" | "running" | "error";

export interface Agent {
  id: string;
  name: string;
  state: AgentState;
  skills: string[];
  runTask(taskId: string): Promise<void>;
}

export interface AgentRegistry {
  list(): Agent[];
  getById(id: string): Agent | undefined;
  register(agent: Agent): void;
}

export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  list(): Agent[] {
    return [...this.agents.values()];
  }

  getById(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }
}
