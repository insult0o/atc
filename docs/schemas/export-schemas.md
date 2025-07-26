# Export Format Schemas

## Overview
This document defines the JSON schemas for all export formats used in the PDF Intelligence Platform.

## RAG Chunks Schema (`rag_chunks.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["metadata", "chunks"],
  "properties": {
    "metadata": {
      "type": "object",
      "required": ["document_id", "title", "processed_at", "total_pages"],
      "properties": {
        "document_id": { "type": "string" },
        "title": { "type": "string" },
        "processed_at": { "type": "string", "format": "date-time" },
        "total_pages": { "type": "integer", "minimum": 1 },
        "total_chunks": { "type": "integer", "minimum": 1 }
      }
    },
    "chunks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["chunk_id", "content", "zone_id", "page", "confidence"],
        "properties": {
          "chunk_id": { "type": "string" },
          "content": { "type": "string" },
          "zone_id": { "type": "string" },
          "page": { "type": "integer", "minimum": 1 },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "type": { 
            "type": "string",
            "enum": ["text", "table", "diagram"]
          },
          "tool": { "type": "string" },
          "position": {
            "type": "object",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" },
              "width": { "type": "number" },
              "height": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

## Fine-tuning Data Schema (`fine_tune.jsonl`)

Each line in the JSONL file must conform to:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["instruction", "input", "output"],
  "properties": {
    "instruction": {
      "type": "string",
      "description": "Task instruction for the model"
    },
    "input": {
      "type": "object",
      "required": ["content", "context"],
      "properties": {
        "content": { "type": "string" },
        "context": {
          "type": "object",
          "properties": {
            "zone_id": { "type": "string" },
            "page": { "type": "integer" },
            "type": {
              "type": "string",
              "enum": ["text", "table", "diagram"]
            }
          }
        }
      }
    },
    "output": {
      "type": "string",
      "description": "Expected model output"
    }
  }
}
```

## User Corrections Schema (`corrections.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["document_id", "corrections"],
  "properties": {
    "document_id": { "type": "string" },
    "corrections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["zone_id", "timestamp", "user_id", "original", "corrected"],
        "properties": {
          "zone_id": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "user_id": { "type": "string" },
          "original": {
            "type": "object",
            "properties": {
              "content": { "type": "string" },
              "tool": { "type": "string" },
              "confidence": { "type": "number" }
            }
          },
          "corrected": {
            "type": "object",
            "required": ["content"],
            "properties": {
              "content": { "type": "string" },
              "reason": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## Zone Manifest Schema (`zone_manifest.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["document_id", "zones"],
  "properties": {
    "document_id": { "type": "string" },
    "zones": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["zone_id", "type", "page", "status", "processing_history"],
        "properties": {
          "zone_id": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["text", "table", "diagram"]
          },
          "page": { "type": "integer", "minimum": 1 },
          "status": {
            "type": "string",
            "enum": ["auto", "manual_override", "error"]
          },
          "position": {
            "type": "object",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" },
              "width": { "type": "number" },
              "height": { "type": "number" }
            }
          },
          "processing_history": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["timestamp", "tool", "confidence", "status"],
              "properties": {
                "timestamp": { "type": "string", "format": "date-time" },
                "tool": { "type": "string" },
                "confidence": { "type": "number" },
                "status": {
                  "type": "string",
                  "enum": ["success", "failure", "partial"]
                },
                "error": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

## Export Log Format (`export_log.md`)

The export log is a human-readable Markdown file with the following sections:

```markdown
# Export Log for [Document ID]

## Document Information
- Title: [Document Title]
- Pages: [Page Count]
- Processed: [Timestamp]
- Export ID: [UUID]

## Processing Summary
- Total Zones: [Count]
- Successful Extractions: [Count]
- Manual Overrides: [Count]
- Errors: [Count]

## Tool Usage
- unstructured: [Count] zones
- pdfplumber: [Count] zones
- pymupdf: [Count] zones
- camelot: [Count] zones
- tabula: [Count] zones

## Zone Details
### Page [N]
- Zone [ID]: [Status] ([Tool]) - Confidence: [Score]
  - Type: [text/table/diagram]
  - [Additional Details if error/override]

## Export Details
- Format: [Format Name]
- Files Generated: [List of Files]
- Schema Version: [Version]
- Export Time: [Duration]

## Validation Results
- Schema Validation: [Pass/Fail]
- Content Validation: [Pass/Fail]
- Error Details: [If any]
``` 