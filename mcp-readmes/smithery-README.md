# Smithery MCP Server

AI-powered gateway for accessing thousands of MCP tools and services.

## Current Status

The Smithery gateway is configured and ready to use with your API key. The gateway provides access to thousands of AI-native tools and services through a unified interface.

## Configuration

The server is configured in your Cursor IDE config (`~/.config/mcp/cursor-config.json`):

```json
{
  "mcpServers": {
    "smithery": {
      "command": "npx",
      "args": ["@smithery/gateway", "--api-key", "deliberate-perch-56S7Rv"],
      "env": {
        "SMITHERY_API_KEY": "deliberate-perch-56S7Rv"
      }
    }
  }
}
```

## Available Tools

Through the Smithery gateway, you have access to thousands of tools across various categories:

1. Web Search (158+ tools)
2. Browser Automation (133+ tools)
3. Memory Management (6+ tools)
4. AI Integration Frameworks (682+ tools)
5. Domain Data Connectors (398+ tools)
6. Social Media Analytics (14+ tools)

## Usage

To use any tool through Smithery:

1. Restart Cursor IDE to apply the configuration
2. Use natural language to describe what you want to do
3. The gateway will automatically route your request to the appropriate tool

### Example Commands

```typescript
// Web search
"Search for recent articles about Model Context Protocol"

// Browser automation
"Navigate to a website and extract data"

// Memory management
"Store this information for later use"

// AI integration
"Connect to an external AI service"

// Data connectors
"Fetch data from a specific API"

// Analytics
"Analyze social media trends"
```

## Best Practices

1. Be specific in your requests
2. Include relevant context
3. Use natural language
4. Let the gateway handle tool selection
5. Check tool documentation for advanced features

## Security

- Your API key is securely stored in the configuration
- All requests are made through the official Smithery gateway
- Each tool has its own security review score
- Data handling follows Smithery's privacy policy

## Troubleshooting

If you encounter issues:

1. Verify your API key is correct
2. Ensure Cursor IDE has been restarted
3. Check the Cursor IDE logs
4. Visit the Smithery documentation for detailed guides
5. Join the Smithery Discord community for support

## Additional Resources

- [Smithery Documentation](https://smithery.ai/docs)
- [Tool Registry](https://smithery.ai/registry)
- [Security Policy](https://smithery.ai/security)
- [Discord Community](https://discord.gg/smithery) 