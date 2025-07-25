# Filesystem MCP Server

Secure file operations with configurable access controls.

## Features

- **File Operations**: Read, write, list, and delete files
- **Directory Management**: Create, list, and navigate directories
- **Access Controls**: Configurable permissions and paths
- **Path Validation**: Secure path handling and validation

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/filesystem`.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Operations

```typescript
// List directory contents
listDirectory("/path/to/dir")

// Read file content
readFile("/path/to/file.txt")

// Write file
writeFile("/path/to/new.txt", "content")

// Delete file
deleteFile("/path/to/old.txt")

// Check file exists
fileExists("/path/to/check.txt")
```

## Configuration

The server is configured with a root path to restrict file access:
```json
{
  "filesystem": {
    "command": "node",
    "args": ["/path/to/dist/index.js", "/allowed/root/path"],
    "env": {}
  }
}
```

## Security Features

- Path validation and sanitization
- Root path restrictions
- No access outside allowed paths
- Safe file operations

## Troubleshooting

1. Check file permissions
2. Verify path configurations
3. Review access logs
4. Check Node.js installation

## Best Practices

- Use absolute paths when possible
- Handle file operation errors
- Check file existence before operations
- Follow least privilege principle
