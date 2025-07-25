# PDF Processing Platform Overview

## Vision
An AI-powered PDF processing platform that extracts, processes, and manages content from PDF documents with high accuracy and user control. The system uses multiple extraction tools, provides a dual-pane interface for verification, and supports comprehensive export options.

## Core Features

### 1. PDF Content Extraction
- Multi-tool extraction pipeline using unstructured, pdfplumber, pymupdf, camelot, and tabula
- Content type support: paragraphs, tables, diagrams/charts
- Zone-based processing with tool-specific metadata
- Confidence scoring and thresholds:
  - Paragraphs: ≥ 0.80
  - Tables: ≥ 0.70
  - Diagrams: ≥ 0.60

### 2. Dual-Pane Interface
- Split view showing original PDF and extracted content
- Visual confidence indicators (bright vs greyed out)
- Interactive zone selection and reprocessing
- Manual correction capabilities
- Undo/revert functionality

### 3. Processing Pipeline
- Tool priority and fallback system
- Weighted confidence merging
- Error handling and placeholder insertion
- Manual intervention flagging
- Zone-specific metadata tracking

### 4. Export System
- Multiple output formats (RAG JSON, JSONL, logs)
- Export validation and blocking
- Partial export support
- Comprehensive logging and manifest generation 