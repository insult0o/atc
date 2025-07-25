# Memory MCP Server

Knowledge graph-based persistent memory system.

## Features

- **Knowledge Storage**: Save and retrieve information
- **Graph Structure**: Connected knowledge representation
- **Persistence**: Data survives across sessions
- **Query Capabilities**: Search and filter stored data

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/memory`.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Operations

```typescript
// Store new knowledge
storeMemory({
  title: "Project Setup",
  content: "Install dependencies with npm install"
})

// Retrieve memory
getMemory("Project Setup")

// Search memories
searchMemories("npm")

// Update memory
updateMemory("Project Setup", {
  content: "Updated setup instructions"
})

// Delete memory
deleteMemory("Project Setup")
```

## Configuration

No additional configuration required. Memory is stored locally.

## Storage

- Memory is persisted to disk
- Uses JSON format
- Maintains relationships between items
- Automatic garbage collection

## Security

- Local storage only
- No external access
- Data validation
- Safe file operations

## Troubleshooting

1. Check storage permissions
2. Verify file access
3. Review memory logs
4. Check Node.js installation

## Best Practices

- Use descriptive titles
- Keep content concise
- Maintain relationships
- Regular cleanup of old data
