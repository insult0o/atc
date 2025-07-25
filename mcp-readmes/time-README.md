# Time MCP Server

Time and timezone conversion capabilities.

## Features

- **Time Conversion**: Convert between timezones
- **Format Handling**: Parse and format time strings
- **Timezone Management**: Work with multiple timezones
- **Date Operations**: Add, subtract, compare times

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/time` and runs in the Python virtual environment.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Operations

```python
# Get current time
get_current_time()

# Convert timezone
convert_timezone("2024-03-20 14:30:00", "UTC", "America/New_York")

# Format time
format_time("2024-03-20T14:30:00Z", "YYYY-MM-DD HH:mm:ss")

# Add duration
add_duration("2024-03-20 14:30:00", hours=2, minutes=30)

# Compare times
compare_times("2024-03-20 14:30:00", "2024-03-20 15:00:00")
```

## Configuration

No additional configuration required. Uses system timezone data.

## Dependencies

- tzdata
- tzlocal
- pydantic

## Security

- Safe time operations
- Input validation
- Error handling
- No external API calls

## Troubleshooting

1. Check timezone database
2. Verify Python environment
3. Review time formats
4. Check system time settings

## Best Practices

- Use ISO format when possible
- Include timezone information
- Handle DST transitions
- Validate input formats
