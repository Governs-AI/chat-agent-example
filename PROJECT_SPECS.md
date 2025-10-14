# GovernsAI Demo Chat - Project Specifications

## Project Overview

A production-ready Next.js chat application that demonstrates GovernsAI's governance platform integration. The app showcases how every AI interaction can be automatically reviewed and governed by policy before execution, with secure user authentication and organization-based access control.

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Authentication**: Auth.js v5 (NextAuth) with OIDC provider
- **AI Providers**: OpenAI API, Ollama (OpenAI-compatible)
- **Streaming**: Server-Sent Events (SSE)
- **Governance**: GovernsAI SDK integration with precheck service
- **Database**: GovernsAI Platform API (external)

### System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Browser  │    │   Next.js App    │    │ GovernsAI Auth  │
│                 │    │                  │    │   (Keycloak)    │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │                 │
│ │ Login Page  │◄┼────┼─┤ Middleware   │ │    │                 │
│ └─────────────┘ │    │ └──────────────┘ │    │                 │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │                 │
│ │ Chat UI     │◄┼────┼─┤ Chat API     │◄┼────┤                 │
│ └─────────────┘ │    │ └──────────────┘ │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ GovernsAI SDK   │
                       │                  │
                       │ ┌──────────────┐ │
                       │ │ Precheck API │ │
                       │ └──────────────┘ │
                       │                  │
                       │ ┌──────────────┐ │
                       │ │ Platform API │ │
                       │ └──────────────┘ │
                       └──────────────────┘
```

## Authentication Flow

### OIDC Integration
- **Provider**: GovernsAI Keycloak (Railway)
- **Issuer**: `https://keycloak-production-31b9.up.railway.app/realms/governs-ai-prod`
- **Flow**: Authorization Code with PKCE
- **Scopes**: `openid profile email`

### Custom Claims
The application extracts these custom claims from the ID token:

| Claim | Type | Description | Usage |
|-------|------|-------------|-------|
| `governs_user_id` | string | Original dashboard user ID | Precheck API calls |
| `org_id` | string | Organization ID | Usage tracking, billing |
| `org_slug` | string | Organization slug/name | UI display |
| `org_role` | string | User's role in org | Access control |

### Session Management
- **Storage**: Server-side JWT tokens
- **Security**: HTTP-only cookies, CSRF protection
- **Expiration**: Configurable via Keycloak settings
- **Refresh**: Automatic token refresh

## API Endpoints

### Authentication Endpoints
- `GET /api/auth/signin` - Initiate OIDC login
- `GET /api/auth/callback/governsai` - OIDC callback handler
- `GET /api/auth/signout` - Logout endpoint
- `GET /api/auth/session` - Get current session

### Application Endpoints
- `POST /api/chat` - Streaming chat completions with governance
- `GET/POST /api/mcp` - Mock MCP tool calls with governance
- `POST /api/precheck/proxy` - Proxy to external precheck service

### Route Protection
- **Protected Routes**: All routes except `/login` and `/api/auth/*`
- **Middleware**: Automatic redirect to login for unauthenticated users
- **Session Validation**: Server-side session verification on every request

## Governance Integration

### Precheck Flow
1. **User Input** → Chat interface captures message
2. **Authentication** → Session validation and user context extraction
3. **Precheck** → Request sent to GovernsAI precheck service with user context
4. **Decision** → Policy decision returned (allow/redact/block/confirm)
5. **Processing** → If allowed, request sent to AI provider
6. **Streaming** → Response streamed back with decision badges
7. **Display** → User sees both content and governance decision

### Policy Decisions
The app demonstrates four types of governance decisions:

- 🟢 **Allow**: Request proceeds unchanged
- 🟡 **Redact**: Sensitive content is automatically redacted
- 🔵 **Confirm**: Request requires confirmation (with approval flow)
- 🔴 **Block**: Request is blocked due to policy violation

### Tool Governance
- **MCP Tools**: Mock Model Context Protocol tools with governance
- **Tool Categories**: Weather, Payment, Database, File, Web, Email, Calendar
- **Policy Enforcement**: Every tool call is prechecked before execution

## User Interface

### Login Page (`/login`)
- **Design**: Clean, branded interface with GovernsAI styling
- **Features**: "Login with GovernsAI" button, feature descriptions
- **Flow**: Automatic redirect after successful authentication

### Chat Interface (`/`)
- **Header**: User info display (name, organization, role)
- **Chat Area**: Message history with decision badges
- **Input**: Real-time message input with auto-resize
- **Examples**: Pre-configured example prompts for testing

### User Experience
- **Real-time Streaming**: Server-sent events for responsive chat
- **Decision Visualization**: Color-coded badges for policy decisions
- **Confirmation Flow**: Interactive confirmation for sensitive operations
- **Error Handling**: Graceful error messages and fallbacks

## Data Flow

### Chat Request Flow
```
User Input
    ↓
Session Validation (Middleware)
    ↓
User Context Extraction (governs_user_id, org_id)
    ↓
Precheck API Call (with user context)
    ↓
Policy Decision (allow/redact/block/confirm)
    ↓
AI Provider Call (if allowed)
    ↓
Streaming Response
    ↓
Usage Recording (with org context)
    ↓
UI Display (with decision badges)
```

### Tool Call Flow
```
Tool Call Request
    ↓
Session Validation
    ↓
MCP Precheck (with user context)
    ↓
Policy Decision
    ↓
Tool Execution (if allowed)
    ↓
Result Processing
    ↓
Usage Recording
    ↓
Response Display
```

## Environment Configuration

### Required Environment Variables

```env
# Authentication
AUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
GOVERNSAI_CLIENT_ID=your-client-id
GOVERNSAI_CLIENT_SECRET=your-client-secret

# AI Providers
PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b

# GovernsAI Integration
PRECHECK_URL=http://localhost:8080
PRECHECK_API_KEY=your-precheck-key
PLATFORM_URL=http://localhost:3002

# External Services
FIRECRAWL_API_KEY=fc-your-firecrawl-key
MCP_BASE_URL=http://localhost:9090
```

### Security Configuration
- **AUTH_SECRET**: 32+ byte random string (generate with `openssl rand -base64 32`)
- **NEXTAUTH_URL**: Must match the domain where the app is hosted
- **HTTPS**: Required in production for secure cookies

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts           # Auth.js API routes
│   │   ├── chat/
│   │   │   └── route.ts               # Chat API with governance
│   │   ├── mcp/
│   │   │   └── route.ts               # MCP API with governance
│   │   └── precheck/
│   │       └── proxy/
│   │           └── route.ts           # Precheck proxy
│   ├── login/
│   │   └── page.tsx                   # Login page
│   ├── dashboard/
│   │   └── page.tsx                   # API keys dashboard
│   ├── layout.tsx                     # Root layout with SessionProvider
│   └── page.tsx                       # Home page with chat
├── components/
│   ├── Chat.tsx                       # Main chat component
│   ├── Message.tsx                    # Message display component
│   ├── DecisionBadge.tsx             # Policy decision badges
│   ├── MCPToolTester.tsx              # Tool testing component
│   ├── ProviderSwitch.tsx             # AI provider switcher
│   ├── SessionProvider.tsx            # Auth session provider
│   └── UserInfo.tsx                   # User info display
├── lib/
│   ├── auth.ts                        # Auth.js configuration
│   ├── precheck.ts                    # Precheck service integration
│   ├── platform-api.ts                # GovernsAI platform API
│   ├── sdk-client.ts                  # GovernsAI SDK client
│   ├── providers/
│   │   ├── base.ts                    # Base provider interface
│   │   ├── openai.ts                  # OpenAI provider
│   │   └── ollama.ts                  # Ollama provider
│   ├── tools.ts                       # Available MCP tools
│   ├── mock-tools.ts                  # Mock tool implementations
│   ├── types.ts                       # TypeScript type definitions
│   └── utils.ts                       # Utility functions
├── middleware.ts                      # Route protection middleware
└── globals.css                        # Global styles
```

## Security Features

### Authentication Security
- **OIDC Standard**: Industry-standard OpenID Connect authentication
- **Server-side Sessions**: JWT tokens stored server-side only
- **CSRF Protection**: Built-in CSRF protection via Auth.js
- **Secure Cookies**: HTTP-only, secure, same-site cookies
- **Token Validation**: Automatic token validation and refresh

### API Security
- **Session Validation**: Every API call validates user session
- **User Context**: All requests include authenticated user context
- **API Key Protection**: Server-side API keys never exposed to client
- **Rate Limiting**: Built-in rate limiting on auth endpoints

### Data Protection
- **PII Detection**: Automatic PII detection and redaction
- **Content Filtering**: Policy-based content filtering
- **Audit Logging**: All actions logged with user context
- **Usage Tracking**: Organization-based usage tracking

## Performance Features

### Streaming
- **Server-Sent Events**: Real-time response streaming
- **Chunked Responses**: Efficient data transfer
- **Connection Management**: Automatic connection cleanup

### Caching
- **Session Caching**: Efficient session storage
- **Policy Caching**: Cached policy configurations
- **Tool Metadata**: Cached tool metadata for performance

### Optimization
- **Code Splitting**: Automatic code splitting for optimal loading
- **Image Optimization**: Next.js image optimization
- **Bundle Analysis**: Built-in bundle analysis tools

## Testing

### Test Categories
- **Authentication Flow**: Login/logout functionality
- **Chat Functionality**: Message sending and receiving
- **Tool Execution**: MCP tool calls with governance
- **Policy Decisions**: All four decision types
- **Error Handling**: Graceful error handling
- **Performance**: Response times and streaming

### Test Data
- **Example Prompts**: Pre-configured test scenarios
- **Mock Tools**: Comprehensive mock tool implementations
- **Test Users**: Multiple user roles and organizations
- **Policy Scenarios**: Various policy configurations

## Deployment

### Development
```bash
# Install dependencies
pnpm install

# Configure environment
cp env.example .env.local
# Edit .env.local with your credentials

# Start development server
pnpm dev
```

### Production
```bash
# Build application
pnpm build

# Start production server
pnpm start
```

### Environment Requirements
- **Node.js**: 18+ required
- **Memory**: 512MB+ recommended
- **Storage**: 1GB+ for dependencies
- **Network**: HTTPS required for production

## Monitoring and Observability

### Logging
- **Authentication Events**: Login/logout events
- **API Calls**: All API requests and responses
- **Policy Decisions**: Governance decision logging
- **Error Tracking**: Comprehensive error logging

### Metrics
- **Usage Metrics**: Token usage, API calls, tool executions
- **Performance Metrics**: Response times, throughput
- **User Metrics**: Active users, session duration
- **Error Metrics**: Error rates, failure patterns

### Health Checks
- **Authentication Health**: OIDC provider connectivity
- **API Health**: GovernsAI service connectivity
- **Database Health**: Platform API connectivity
- **External Services**: AI provider connectivity

## Integration Points

### GovernsAI Platform
- **Authentication**: OIDC integration with GovernsAI Keycloak
- **Precheck Service**: Policy enforcement via GovernsAI SDK
- **Platform API**: User management and organization data
- **Usage Tracking**: Billing and analytics integration

### AI Providers
- **OpenAI**: GPT models with tool calling
- **Ollama**: Local models with OpenAI-compatible API
- **Streaming**: Real-time response streaming
- **Tool Integration**: MCP tool calling support

### External Services
- **Firecrawl**: Web scraping and search
- **Mock Services**: Development and testing tools
- **Analytics**: Usage tracking and monitoring

## Future Enhancements

### Planned Features
- **Multi-tenant Support**: Multiple organization support
- **Advanced Policies**: More sophisticated policy rules
- **Custom Tools**: User-defined tool creation
- **Analytics Dashboard**: Advanced usage analytics
- **Mobile Support**: Responsive mobile interface

### Integration Opportunities
- **Enterprise SSO**: Additional authentication providers
- **Custom Models**: Support for custom AI models
- **Advanced Governance**: More granular policy controls
- **API Extensions**: Additional API endpoints and features

## Support and Maintenance

### Documentation
- **API Documentation**: Comprehensive API reference
- **Integration Guides**: Step-by-step integration guides
- **Troubleshooting**: Common issues and solutions
- **Best Practices**: Security and performance guidelines

### Community
- **GitHub Repository**: Open source code and issues
- **Documentation Site**: Comprehensive documentation
- **Support Channels**: Community and enterprise support
- **Regular Updates**: Security patches and feature updates

---

*This specification reflects the current implementation as of the latest integration with GovernsAI authentication and governance features.*
