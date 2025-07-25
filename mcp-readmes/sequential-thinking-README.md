# Sequential Thinking MCP Server

Dynamic and reflective problem-solving through thought sequences.

## Features

- **Thought Chains**: Build connected reasoning steps
- **Problem Analysis**: Break down complex problems
- **Solution Planning**: Create structured solutions
- **Reflection**: Review and improve thinking process

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/sequentialthinking`.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Operations

```typescript
// Start thinking sequence
startSequence({
  problem: "How to optimize database queries",
  context: "High-load production system"
})

// Add thought step
addThought({
  sequence: "db-optimization",
  step: "Analyze current query patterns",
  reasoning: "Identify bottlenecks"
})

// Review sequence
reviewSequence("db-optimization")

// Get solution
getSolution("db-optimization")

// Reflect on process
reflectOnSequence("db-optimization")
```

## Configuration

No additional configuration required. Uses in-memory storage by default.

## Process Flow

1. Problem Definition
2. Context Analysis
3. Step-by-Step Thinking
4. Solution Formation
5. Reflection and Learning

## Security

- Local processing only
- No external dependencies
- Data validation
- Safe state management

## Troubleshooting

1. Check sequence state
2. Verify thought connections
3. Review process logs
4. Check Node.js installation

## Best Practices

- Define clear problems
- Provide complete context
- Build logical sequences
- Review and refine solutions
