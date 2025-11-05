import type {
  AgentOutputEnvelope,
  EventBusPort,
  IntentEnvelope,
  TaskDispatchEnvelope
} from "./eventBusAdapter";

export interface PlannerContextProvider {
  resolveSession(sessionId: string): Promise<Record<string, unknown>>;
  getShortTermMemory(sessionId: string): Promise<Record<string, unknown>>;
}

export interface GuardrailService {
  evaluate(plan: TaskGraph): Promise<GuardrailVerdict>;
}

export type GuardrailVerdict =
  | { status: "allow" }
  | { status: "review"; reason: string }
  | { status: "block"; reason: string };

export interface TaskGraph {
  planId: string;
  intent: IntentEnvelope["payload"];
  tasks: TaskDispatchEnvelope["task"][];
  edges: Array<{ from: string; to: string; condition?: string }>;
}

export interface PlannerAdapterDeps {
  bus: EventBusPort;
  context: PlannerContextProvider;
  guardrails: GuardrailService;
  now: () => Date;
  idGenerator: () => string;
}

export interface PlannerAdapter {
  plan(intent: IntentEnvelope): Promise<TaskGraph>;
  dispatch(graph: TaskGraph): Promise<void>;
  handleAgentOutput(envelope: AgentOutputEnvelope): Promise<void>;
}

export function createPlannerAdapter(deps: PlannerAdapterDeps): PlannerAdapter {
  async function plan(intent: IntentEnvelope): Promise<TaskGraph> {
    const context = await deps.context.resolveSession(intent.headers.sessionId);
    const memory = await deps.context.getShortTermMemory(intent.headers.sessionId);

    const graph: TaskGraph = {
      planId: deps.idGenerator(),
      intent: intent.payload,
      tasks: [],
      edges: []
    };

    if (intent.payload.intentType === "upload.analyze") {
      const parseTask: TaskDispatchEnvelope["task"] = {
        taskType: "parse",
        assignee: "etl.agent",
        payload: {
          files: intent.payload.arguments.files,
          context,
          memory
        },
        timeoutMs: 5000
      };

      const validateTask: TaskDispatchEnvelope["task"] = {
        taskType: "validate",
        assignee: "validator.agent",
        payload: { planContext: { planId: graph.planId } },
        timeoutMs: 2000
      };

      graph.tasks.push(parseTask, validateTask);
      graph.edges.push({ from: "parse", to: "validate" });
    }

    return graph;
  }

  async function dispatch(graph: TaskGraph): Promise<void> {
    const verdict = await deps.guardrails.evaluate(graph);
    if (verdict.status === "block") {
      throw new Error(`Plan blocked by guardrails: ${verdict.reason}`);
    }

    for (const [index, task] of graph.tasks.entries()) {
      const headers = {
        traceId: deps.idGenerator(),
        agentId: "planner.agent",
        timestamp: deps.now().toISOString(),
        planId: graph.planId,
        taskId: task.taskType,
        sessionId: graph.intent.arguments?.sessionId
      } as const;

      await deps.bus.publishTask({
        schemaVersion: "1.0.0",
        headers,
        task
      });

      if (verdict.status === "review" && index === graph.tasks.length - 1) {
        await deps.bus.publishTelemetry({
          schemaVersion: "1.0.0",
          headers,
          metrics: {
            latencyMs: 0,
            status: "retry",
            errorCode: "PLAN_REVIEW_REQUIRED"
          }
        });
      }
    }
  }

  async function handleAgentOutput(envelope: AgentOutputEnvelope): Promise<void> {
    if (envelope.headers.status === "failure" && envelope.error) {
      await deps.bus.publishTelemetry({
        schemaVersion: "1.0.0",
        headers: {
          traceId: envelope.headers.traceId,
          agentId: "planner.agent",
          timestamp: deps.now().toISOString(),
          planId: envelope.headers.planId,
          taskId: envelope.headers.taskId
        },
        metrics: {
          latencyMs: 0,
          status: "failure",
          errorCode: envelope.error.code
        }
      });
    }
  }

  return { plan, dispatch, handleAgentOutput };
}
