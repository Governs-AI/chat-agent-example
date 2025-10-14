# GovernsAI TypeScript SDK

A comprehensive TypeScript SDK for the GovernsAI platform, providing secure control over AI interactions, budget management, and policy enforcement.

## Features

- **Precheck Integration**: Request validation and budget checking before AI calls
- **Confirmation Workflows**: User approval for sensitive operations
- **Budget Management**: Real-time budget checking and usage tracking
- **Tool Management**: Tool registration and metadata handling
- **Analytics**: Comprehensive analytics and monitoring
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling with retry logic
- **Developer Experience**: Easy to use and well-documented

## Installation

```bash
npm install @governs-ai/sdk
```

## Quick Start

```typescript
import { GovernsAIClient, createClientFromEnv } from "@governs-ai/sdk";

// Create client from environment variables
const client = createClientFromEnv();

// Or create client with explicit configuration
const client = new GovernsAIClient({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:3002",
  orgId: "org-456", // Organization context (static)
});

// Test connection
const isConnected = await client.testConnection();
console.log("Connected:", isConnected);

// Precheck a request for a specific user (userId is dynamic)
const userId = "user-123";
const precheckResponse = await client.precheckRequest(
  {
    tool: "model.chat",
    scope: "net.external",
    raw_text: "Hello, how are you?",
    payload: { messages: [{ role: "user", content: "Hello" }] },
    tags: ["demo", "chat"],
  },
  userId
);

if (precheckResponse.decision === "deny") {
  console.log("Request blocked:", precheckResponse.reasons);
} else if (precheckResponse.decision === "confirm") {
  console.log("Confirmation required");
  // Handle confirmation flow...
} else {
  console.log("Request allowed");
  // Proceed with AI call...
}
```

## Configuration

### Environment Variables

```bash
# Required
GOVERNS_API_KEY=your-api-key

# Optional
GOVERNS_BASE_URL=http://localhost:3002
GOVERNS_USER_ID=user-123
GOVERNS_ORG_ID=org-456
GOVERNS_TIMEOUT=30000
GOVERNS_RETRIES=3
GOVERNS_RETRY_DELAY=1000
```

### Programmatic Configuration

```typescript
const client = new GovernsAIClient({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:3002",
  userId: "user-123",
  orgId: "org-456",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
});
```

## Core Features

### Precheck Integration

Validate requests before AI operations:

```typescript
// Check a chat message
const precheckResponse = await client.precheck({
  tool: 'model.chat',
  scope: 'net.external',
  raw_text: 'Hello, how are you?',
  payload: { messages: [{ role: 'user', content: 'Hello' }] },
  tags: ['demo', 'chat'],
});

// Check a tool call
const toolPrecheck = await client.precheck.checkToolCall('weather_current', {
  latitude: 52.52,
  longitude: 13.41,
  location_name: 'Berlin',
});

// Handle different decisions
switch (precheckResponse.decision) {
  case 'allow':
    // Proceed with AI call
    break;
  case 'deny':
  case 'block':
    // Block the request
    console.log('Request blocked:', precheckResponse.reasons);
    break;
  case 'confirm':
    // Require user confirmation
    const confirmation = await client.createConfirmation(
      'correlation-id',
      'chat',
      'Chat request',
      { messages: [...] },
      precheckResponse.reasons
    );
    break;
  case 'redact':
    // Use redacted content
    const redactedContent = precheckResponse.content;
    break;
}
```

### Confirmation Workflows

Handle user approval for sensitive operations:

```typescript
// Create confirmation request
const confirmation = await client.createConfirmation(
  "correlation-id",
  "tool_call",
  "Execute payment tool",
  { tool: "payment_process", args: { amount: 99.99 } },
  ["High risk operation"]
);

// Poll for approval
await client.pollConfirmation(
  confirmation.confirmation.correlationId,
  (status) => {
    console.log("Confirmation status:", status);
  }
);

// Wait for approval
const approvedConfirmation = await client.confirmation.waitForApproval(
  confirmation.confirmation.correlationId,
  {
    interval: 2000,
    timeout: 300000,
    onStatusChange: (status) => console.log("Status:", status),
  }
);
```

### Budget Management

Track and manage AI usage costs:

```typescript
// Get budget context
const budgetContext = await client.getBudgetContext();
console.log("Remaining budget:", budgetContext.remaining_budget);

// Check if budget allows a cost
const budgetStatus = await client.budget.checkBudget(50.0);
if (!budgetStatus.allowed) {
  console.log("Insufficient budget:", budgetStatus.reason);
}

// Record usage after AI call
await client.recordUsage({
  userId: "user-123",
  orgId: "org-456",
  provider: "openai",
  model: "gpt-4",
  inputTokens: 100,
  outputTokens: 50,
  cost: 0.15,
  costType: "external",
  tool: "chat",
  correlationId: "corr-123",
});

// Get spend analytics
const spendData = await client.analytics.getSpendAnalytics("30d");
console.log("Total spend:", spendData.spend.totalSpend);
console.log("Monthly spend:", spendData.spend.monthlySpend);
console.log("Over budget:", spendData.spend.isOverBudget);
```

### Tool Management

Register and manage tools:

```typescript
// Register tools
const tools = [
  {
    type: "function",
    function: {
      name: "weather_current",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number", description: "Latitude coordinate" },
          longitude: { type: "number", description: "Longitude coordinate" },
        },
        required: ["latitude", "longitude"],
      },
    },
  },
];

await client.tools.registerTools(tools);

// Execute tool with governance checks
const toolResult = await client.tools.executeTool("weather_current", {
  latitude: 52.52,
  longitude: 13.41,
});

// Get tool metadata
const metadata = await client.tools.getToolMetadata("weather_current");
console.log("Risk level:", metadata.metadata.risk_level);
```

### Analytics

Get comprehensive analytics and reporting:

```typescript
// Get decision analytics
const decisions = await client.analytics.getDecisions({
  timeRange: "30d",
  includeStats: true,
});

console.log("Total decisions:", decisions.stats.total);
console.log("By decision:", decisions.stats.byDecision);

// Get spend analytics
const spendData = await client.analytics.getSpendAnalytics("30d");
console.log("Spend breakdown:", {
  total: spendData.spend.totalSpend,
  monthly: spendData.spend.monthlySpend,
  byTool: spendData.spend.toolSpend,
  byModel: spendData.spend.modelSpend,
});

// Get usage records
const usageRecords = await client.analytics.getUsageRecords({
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  limit: 100,
});

// Get comprehensive dashboard data
const dashboardData = await client.analytics.getDashboardData(
  "org-slug",
  "30d"
);
```

## Error Handling

The SDK provides comprehensive error handling with retry logic:

```typescript
import { GovernsAIError, PrecheckError, BudgetError } from "@governs-ai/sdk";

try {
  const response = await client.precheck(request);
} catch (error) {
  if (error instanceof PrecheckError) {
    console.error("Precheck failed:", error.message);
    if (error.retryable) {
      // Retry the operation
    }
  } else if (error instanceof BudgetError) {
    console.error("Budget error:", error.message);
  } else if (error instanceof GovernsAIError) {
    console.error("SDK error:", error.message);
  }
}
```

## Advanced Usage

### Custom Retry Configuration

```typescript
// Configure retry behavior
client.updateConfig({
  retries: 5,
  retryDelay: 2000,
});

// Use with custom retry logic
await client.withRetry(async () => {
  return await client.precheck(request);
}, "custom operation");
```

### Batch Operations

```typescript
// Batch precheck multiple requests
const requests = [
  { tool: "model.chat", scope: "net.external", raw_text: "Hello" },
  { tool: "weather_current", scope: "net.external", raw_text: "Weather" },
];

const results = await client.precheck.checkBatch(requests);

// Batch tool execution
const toolCalls = [
  { tool: "weather_current", args: { latitude: 52.52, longitude: 13.41 } },
  { tool: "payment_process", args: { amount: 99.99 } },
];

const results = await client.tools.executeBatchTools(toolCalls);
```

### Health Monitoring

```typescript
// Check service health
const healthStatus = await client.getHealthStatus();
console.log("Platform status:", healthStatus.status);
console.log("Services:", healthStatus.services);

// Test individual services
const precheckStatus = await client.precheck.getServiceStatus();
const budgetStatus = await client.budget.getServiceStatus();
```

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts` - Basic SDK functionality
- `chat-integration.ts` - Chat application integration
- `tool-calling.ts` - Tool calling with governance
- `dashboard-analytics.ts` - Analytics and reporting

## API Reference

### GovernsAIClient

Main client class that orchestrates all SDK functionality.

#### Methods

- `precheck(request: PrecheckRequest): Promise<PrecheckResponse>`
- `getBudgetContext(): Promise<BudgetContext>`
- `recordUsage(usage: UsageRecord): Promise<void>`
- `createConfirmation(...): Promise<ConfirmationResponse>`
- `getConfirmationStatus(correlationId: string): Promise<ConfirmationStatus>`
- `pollConfirmation(...): Promise<void>`
- `testConnection(): Promise<boolean>`
- `getHealthStatus(): Promise<HealthStatus>`

### Feature Clients

- **PrecheckClient**: Request validation and governance compliance
- **ConfirmationClient**: User approval workflows
- **BudgetClient**: Budget management and usage tracking
- **ToolClient**: Tool registration and execution
- **AnalyticsClient**: Analytics and reporting

## TypeScript Support

The SDK provides comprehensive TypeScript definitions for all types, interfaces, and methods. All API responses and request parameters are fully typed.

```typescript
import {
  PrecheckRequest,
  PrecheckResponse,
  BudgetContext,
  UsageRecord,
  Decision,
  Tool,
  Message,
} from "@governs-ai/sdk";
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:

- GitHub Issues: [Create an issue](https://github.com/governs-ai/typescript-sdk/issues)
- Documentation: [SDK Documentation](https://docs.governsai.com/sdk)
