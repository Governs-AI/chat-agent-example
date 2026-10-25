export interface Message {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  decision?: Decision;
  reasons?: string[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  confirmationRequired?: boolean;
  confirmationUrl?: string;
  correlationId?: string;
}

// Precheck returns allow | transform | deny | confirm; "redact" is the
// legacy name for transform and still accepted.
export type Decision = "allow" | "transform" | "deny" | "redact" | "confirm";

// Type guard function to check if a string is a valid Decision
export function isValidDecision(value: any): value is Decision {
  return typeof value === 'string' &&
    ['allow', 'transform', 'deny', 'redact', 'confirm'].includes(value);
}

export type Provider = "openai" | "ollama";

export interface PolicyDefaults {
  ingress: { action: string };
  egress: { action: string };
}

export interface ToolAccessRule {
  direction: "ingress" | "egress";
  action: Decision;
  allow_pii?: Record<string, string>; // PII type -> action mapping
}

export interface PolicyConfig {
  version: string;
  defaults: PolicyDefaults;
  tool_access: Record<string, ToolAccessRule>;
  deny_tools: string[];
  allow_tools?: string[];
  network_scopes: string[];
  network_tools: string[];
  on_error: "block" | "allow" | "redact";
}

export interface ToolConfigMetadata {
  tool_name: string;
  scope: string;
  direction: "ingress" | "egress";
  metadata: {
    category: string;
    risk_level: "low" | "medium" | "high" | "critical";
    requires_approval?: boolean;
  };
}

export interface PrecheckRequest {
  tool: string;
  scope: string;
  raw_text?: string;
  payload?: any;
  tags?: string[];
  corr_id?: string;
  policy_config?: PolicyConfig;
  tool_config?: ToolConfigMetadata;
  budget_context?: any; // ← Add budget context
}

export interface PrecheckResponse {
  decision: Decision;
  /** Precheck's output text — redacted when decision is transform. */
  raw_text_out?: string;
  policy_id?: string;
  content?: {
    messages?: Message[];
    [key: string]: any;
  };
  reasons?: string[];
  pii_findings?: any[];
  metadata?: Record<string, any>;
  // SDK spec additions for memory save intent
  intent?: { save?: boolean };
  suggestedActions?: Array<
    | { type: 'context.save'; content?: string; reason?: string; metadata?: Record<string, any> }
    | { type: string; [k: string]: any }
  >;
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  provider?: Provider;
  /** Continue a request a reviewer approved in the GovernsAI dashboard. */
  resume?: { correlationId: string };
}

export interface MCPRequest {
  tool: string;
  args: Record<string, any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  decision?: Decision;
  reasons?: string[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface StreamEvent {
  type:
    | "decision"
    | "content"
    | "error"
    | "done"
    | "tool_call"
    | "tool_result"
    // The request is held for approval: { correlationId, confirmationUrl, reasons }
    | "confirmation"
    // What the model actually received for the last user message: { content }
    | "redacted_input";
  data: any;
}
