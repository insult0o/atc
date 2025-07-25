# Git MCP Server

Tools to read, search, and manipulate Git repositories.

## Features

- **Repository Operations**: Clone, pull, push
- **Branch Management**: Create, switch, merge
- **Commit Operations**: Log, diff, status
- **Search Capabilities**: Search commits and code

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/git` and runs in the Python virtual environment.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Operations

```python
# Get repository status
git_status("/path/to/repo")

# View commit history
git_log("/path/to/repo")

# Search commits
search_commits("/path/to/repo", "fix: bug")

# Get file history
file_history("/path/to/repo", "file.txt")

# View changes
view_diff("/path/to/repo", "HEAD~1")
```

## Configuration

No additional configuration required. Uses system Git installation.

## Dependencies

- gitpython
- click
- pydantic

## Security Features

- Safe command execution
- Path validation
- Credential handling
- Access controls

## Troubleshooting

1. Check Git installation
2. Verify repository access
3. Check Python environment
4. Review Git credentials

## Best Practices

- Keep repositories up to date
- Use meaningful commit messages
- Handle merge conflicts carefully
- Follow Git workflow practices
