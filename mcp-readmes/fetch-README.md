# Fetch MCP Server

Web content fetching and conversion for efficient LLM usage.

## Features

- **Web Fetching**: Retrieve content from any URL
- **Content Conversion**: Convert HTML to clean text/markdown
- **Efficient Processing**: Optimized for LLM consumption
- **Error Handling**: Robust error recovery and reporting

## Installation

The server is installed in `/home/insulto/atc/mcp-servers/official/src/fetch` and runs in the Python virtual environment.

## Usage

The server is configured in your Cursor IDE config and runs automatically when needed.

### Example Usage

```python
# Fetch webpage content
fetch_url("https://example.com")

# Convert HTML to markdown
html_to_markdown("<h1>Hello</h1>")

# Get clean text
get_clean_text("<div>Complex HTML</div>")
```

## Configuration

No additional configuration required. The server uses default settings for optimal performance.

## Dependencies

- httpx
- markdownify
- readabilipy
- beautifulsoup4
- lxml

## Troubleshooting

1. Check Python virtual environment activation
2. Verify network connectivity
3. Check URL accessibility
4. Review server logs for errors

## Security

- URLs are validated before fetching
- Content is sanitized before processing
- Rate limiting is enforced
- No sensitive data is cached
