type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface EnvelopeHeaders {
  traceId: string;
  agentId: string;
  timestamp: string;
  sessionId?: string;
  causationId?: string;
  planId?: string;
  taskId?: string;
}

export interface IntentEnvelope {
  schemaVersion: "1.0.0";
  headers: EnvelopeHeaders & { sessionId: string };
  payload: {
    intentType: "upload.analyze" | "report.refresh" | "chat.prompt" | "export.generate";
    arguments: Record<string, JsonValue>;
  };
}

export interface TaskDispatchEnvelope {
  schemaVersion: "1.0.0";
  headers: EnvelopeHeaders & { planId: string; taskId: string; retryCount?: number };
  task: {
    taskType: string;
    assignee: string;
    payload: Record<string, JsonValue>;
    timeoutMs?: number;
    deadlineMs?: number;
  };
}

export interface AgentOutputEnvelope {
  schemaVersion: "1.0.0";
  headers: EnvelopeHeaders & { taskId: string; status: "success" | "failure" | "partial" };
  result?: {
    contentType: string;
    payload: Record<string, JsonValue>;
    rationale?: Array<{
      statement: string;
      confidence: number;
      sources?: string[];
    }>;
    attachments?: Array<{
      uri: string;
      hash: string;
      expiresAt?: string;
    }>;
  };
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface TelemetryEventEnvelope {
  schemaVersion: "1.0.0";
  headers: EnvelopeHeaders & { planId?: string; taskId?: string };
  metrics: {
    latencyMs: number;
    status: "success" | "failure" | "retry";
    cpuMs?: number;
    memoryMb?: number;
    modelTokens?: number;
    costUsd?: number;
    errorCode?: string;
  };
}

export interface EventBusPort {
  publishIntent(envelope: IntentEnvelope): Promise<void>;
  publishTask(envelope: TaskDispatchEnvelope): Promise<void>;
  publishAgentOutput(envelope: AgentOutputEnvelope): Promise<void>;
  publishTelemetry(envelope: TelemetryEventEnvelope): Promise<void>;
  registerHandler<T extends JsonValue>(
    topic: string,
    handler: (message: T, headers: EnvelopeHeaders) => Promise<void>
  ): void;
}

export interface EventBusAdapterDependencies {
  serialize: <T>(value: T) => string;
  deserialize: <T>(value: string) => T;
  validate: (topic: string, payload: unknown) => void;
  send: (topic: string, message: string, headers: EnvelopeHeaders) => Promise<void>;
}

export function createEventBusAdapter(deps: EventBusAdapterDependencies): EventBusPort {
  return {
    async publishIntent(envelope) {
      deps.validate("intents.v1", envelope);
      await deps.send("intents.v1", deps.serialize(envelope), envelope.headers);
    },
    async publishTask(envelope) {
      deps.validate("tasks.dispatch.v1", envelope);
      await deps.send("tasks.dispatch.v1", deps.serialize(envelope), envelope.headers);
    },
    async publishAgentOutput(envelope) {
      deps.validate("agent.output.v1", envelope);
      await deps.send("agent.output.v1", deps.serialize(envelope), envelope.headers);
    },
    async publishTelemetry(envelope) {
      deps.validate("telemetry.events.v1", envelope);
      await deps.send("telemetry.events.v1", deps.serialize(envelope), envelope.headers);
    },
    registerHandler(topic, handler) {
      // Consumer registration handled externally; this placeholder documents the contract.
      void topic;
      void handler;
    }
  };
}
