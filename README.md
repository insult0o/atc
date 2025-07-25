# AI-Powered PDF Processing Platform

A modern platform for processing PDF documents with AI-driven extraction, merging, and quality assurance.

## Features

- PDF upload with real-time progress tracking
- Multi-tool extraction pipeline
- Dual-pane UI for content review
- Confidence-based merging logic
- Export to various formats
- Comprehensive test coverage

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: FastAPI, WebSocket
- **PDF Processing**: unstructured, pdfplumber, pymupdf, camelot, tabula
- **Testing**: Playwright MCP
- **Development**: BMAD-METHOD v4

## Prerequisites

- Node.js v20 or newer
- Git
- BMAD-METHOD v4

## Installation

1. Clone the repository:
```bash
git clone https://github.com/insult0o/atc.git
cd atc
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Development

This project follows the BMAD-METHOD v4 workflow. Key directories:

- `/app`: Frontend components and pages
- `/lib`: Backend logic
- `/pdf-processing`: PDF extraction tools
- `/tests`: Playwright test files
- `/docs`: Documentation and stories

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run in debug mode
npm run test:debug
```

## Contributing

1. Create a feature branch
2. Follow BMAD-METHOD conventions
3. Write tests
4. Submit a pull request

## License

MIT 