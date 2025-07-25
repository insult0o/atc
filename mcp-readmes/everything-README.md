# Everything MCP Server

A reference/test server that demonstrates all MCP protocol features.

## Features

- **Tools**: Echo, Add, Long-running operations, LLM sampling, Image handling
- **Resources**: Test resources in plaintext and binary formats
- **Prompts**: Simple and complex prompts with arguments
- **Logging**: Periodic log messages at various levels

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/everything`.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Tools

```typescript
// Echo a message
echo("Hello World")

// Add numbers
add(5, 3)

// Long-running operation
longRunningOperation(10, 5)

// Sample from LLM
sampleLLM("What is the weather?", 100)

// Get test image
getTinyImage()
```

### Example Resources

```typescript
// Get plaintext resource
getResource("test://static/resource/2")

// Get binary resource
getResource("test://static/resource/1")
```

## Configuration

No additional configuration required. The server is ready to use with default settings.

## Troubleshooting

1. Check server logs for errors
2. Verify Node.js installation
3. Ensure TypeScript compilation succeeded
4. Check file permissions

## Security

This is a test server - do not use for sensitive data or production environments.
