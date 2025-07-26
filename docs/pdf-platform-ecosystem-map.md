# 🗺️ PDF Intelligence Platform - Complete Ecosystem Map

> A comprehensive visual guide to all workflows, interactions, and tools in the PDF Intelligence Platform

## 📍 Table of Contents

1. [Platform Overview](#platform-overview)
2. [User Journey Flows](#user-journey-flows)
3. [System Architecture](#system-architecture)
4. [Component Interactions](#component-interactions)
5. [Tool Inventory](#tool-inventory)
6. [Data Flow Patterns](#data-flow-patterns)

---

## 🌐 Platform Overview

```mermaid
graph TB
    subgraph "User Entry Points"
        Web[Web Interface]
        API[REST API]
        CLI[CLI Tool]
    end
    
    subgraph "Core Platform"
        Upload[Upload System]
        Process[Processing Engine]
        View[Viewer System]
        Edit[Editor System]
        Export[Export System]
    end
    
    subgraph "Backend Services"
        FastAPI[FastAPI Server]
        WebSocket[WebSocket Server]
        Database[(PostgreSQL/Supabase)]
        Storage[File Storage]
    end
    
    Web --> Upload
    API --> Process
    CLI --> Export
    
    Upload --> Process
    Process --> View
    View --> Edit
    Edit --> Export
    
    Process --> FastAPI
    View --> WebSocket
    Export --> Database
```

## 🚶 User Journey Flows

### 1. Complete Document Processing Flow

```mermaid
journey
    title PDF Processing Journey
    section Upload
      Select PDF: 5: User
      Drag & Drop: 5: User
      File Validation: 3: System
    section Processing
      Multi-tool Analysis: 5: System
      Zone Detection: 4: System
      Content Extraction: 4: System
    section Review
      View in Dual-Pane: 5: User
      Review Zones: 4: User
      Edit Content: 5: User
    section Export
      Select Format: 5: User
      Configure Options: 3: User
      Download Result: 5: User
```

### 2. Detailed Workflow Diagram

```mermaid
flowchart TB
    Start([User Starts]) --> ChooseAction{Choose Action}
    
    ChooseAction -->|New Document| Upload[Upload PDF]
    ChooseAction -->|Existing Document| SelectDoc[Select Document]
    
    Upload --> Validate{Valid PDF?}
    Validate -->|No| Error[Show Error]
    Validate -->|Yes| Process[Process PDF]
    
    Process --> MultiTool{Multi-Tool Processing}
    MultiTool --> Tool1[Unstructured.io]
    MultiTool --> Tool2[PDFPlumber]
    MultiTool --> Tool3[PyMuPDF]
    MultiTool --> Tool4[Camelot]
    MultiTool --> Tool5[Tabula]
    
    Tool1 & Tool2 & Tool3 & Tool4 & Tool5 --> Aggregate[Aggregate Results]
    
    Aggregate --> DetectZones[Detect Zones]
    DetectZones --> ClassifyZones{Classify Zones}
    
    ClassifyZones --> TextZone[Text Zones]
    ClassifyZones --> TableZone[Table Zones]
    ClassifyZones --> ImageZone[Image Zones]
    ClassifyZones --> DiagramZone[Diagram Zones]
    
    TextZone & TableZone & ImageZone & DiagramZone --> StoreZones[Store in Database]
    
    StoreZones --> OpenViewer[Open Dual-Pane Viewer]
    SelectDoc --> OpenViewer
    
    OpenViewer --> ViewerActions{Viewer Actions}
    
    ViewerActions -->|Navigate| PageNav[Page Navigation]
    ViewerActions -->|Zoom| ZoomControl[Zoom In/Out]
    ViewerActions -->|Select| ZoneSelect[Select Zones]
    ViewerActions -->|Edit| ContentEdit[Edit Content]
    
    ZoneSelect --> ZoneActions{Zone Actions}
    ZoneActions -->|Highlight| Highlight[Highlight Zone]
    ZoneActions -->|Edit| EditZone[Edit Zone]
    ZoneActions -->|Merge| MergeZones[Merge Zones]
    ZoneActions -->|Split| SplitZone[Split Zone]
    ZoneActions -->|Delete| DeleteZone[Delete Zone]
    
    ContentEdit --> EditorFeatures{Editor Features}
    EditorFeatures -->|Text| TextEdit[Text Editing]
    EditorFeatures -->|Format| Formatting[Rich Formatting]
    EditorFeatures -->|Save| AutoSave[Auto-Save]
    
    ViewerActions -->|Export| ExportFlow[Export System]
    
    ExportFlow --> SelectZones[Select Zones to Export]
    SelectZones --> ChooseFormat{Choose Format}
    
    ChooseFormat -->|RAG| ConfigRAG[Configure RAG]
    ChooseFormat -->|JSONL| ConfigJSONL[Configure JSONL]
    ChooseFormat -->|Corrections| ConfigCorrections[Configure Corrections]
    
    ConfigRAG --> RAGOptions[Set Chunk Size, Overlap, Tokens]
    ConfigJSONL --> JSONLOptions[Set Structure, Metadata]
    ConfigCorrections --> CorrOptions[Set Correction Types]
    
    RAGOptions & JSONLOptions & CorrOptions --> Validate2{Validate Export}
    
    Validate2 -->|Invalid| ShowWarnings[Show Warnings]
    Validate2 -->|Valid| GenerateExport[Generate Export]
    
    ShowWarnings --> FixIssues[Fix Issues]
    FixIssues --> Validate2
    
    GenerateExport --> Progress[Show Progress]
    Progress --> Download[Download File]
    
    Download --> End([Complete])
```

## 🏗️ System Architecture

### Component Hierarchy

```mermaid
graph TD
    subgraph "Frontend Layer"
        UI[Next.js App]
        UI --> Pages[Pages/Routes]
        UI --> Components[React Components]
        UI --> Hooks[Custom Hooks]
        UI --> Services[API Services]
        
        Components --> Viewer[Viewer Components]
        Components --> Editor[Editor Components]
        Components --> Export[Export Components]
        Components --> Common[Common Components]
        
        Viewer --> PDFViewer[PDF Viewer]
        Viewer --> ZoneHighlight[Zone Highlighter]
        Viewer --> Controls[Viewer Controls]
        
        Editor --> Monaco[Monaco Editor]
        Editor --> Toolbar[Editor Toolbar]
        Editor --> Preview[Preview Panel]
        
        Export --> Selection[Selection Panel]
        Export --> Config[Config Panel]
        Export --> Validation[Validation Panel]
    end
    
    subgraph "State Management"
        Store[Zustand Store]
        Store --> DocState[Document State]
        Store --> ViewState[Viewer State]
        Store --> EditState[Editor State]
        Store --> ExportState[Export State]
        
        ReactQuery[React Query]
        ReactQuery --> Cache[Query Cache]
        ReactQuery --> Mutations[Mutations]
    end
    
    subgraph "Backend Layer"
        API[FastAPI Server]
        API --> Routes[API Routes]
        API --> Models[Pydantic Models]
        API --> Services2[Business Logic]
        
        WS[WebSocket Server]
        WS --> Events[Event Handlers]
        WS --> Broadcast[Broadcasting]
        
        Workers[Background Workers]
        Workers --> Celery[Celery Tasks]
        Workers --> Processing[PDF Processing]
    end
    
    subgraph "Data Layer"
        DB[PostgreSQL]
        DB --> Tables[Database Tables]
        Tables --> Documents[Documents]
        Tables --> Zones[Zones]
        Tables --> Exports[Export History]
        Tables --> Users[User Data]
        
        S3[S3 Storage]
        S3 --> PDFs[PDF Files]
        S3 --> Exports2[Export Files]
    end
```

### Technology Stack Map

```mermaid
mindmap
  root((Tech Stack))
    Frontend
      Framework
        Next.js 14.2.30
        React 18
        TypeScript 5.x
      Styling
        Tailwind CSS
        CSS Modules
        Styled Components
      State
        Zustand
        React Query
        Context API
      UI Libraries
        PDF.js
        Monaco Editor
        Lucide Icons
        Radix UI
    Backend
      Framework
        FastAPI
        Python 3.11+
        Pydantic v2
      Real-time
        WebSockets
        Server-Sent Events
      Processing
        Celery
        Redis Queue
        Multi-threading
      Database
        PostgreSQL
        SQLAlchemy
        Alembic
    PDF Tools
      Extraction
        Unstructured.io
        PDFPlumber
        PyMuPDF
        Camelot
        Tabula
      Analysis
        NLTK
        spaCy
        Tiktoken
    Infrastructure
      Hosting
        Vercel/Next.js
        AWS/GCP
        Docker
      Storage
        S3/Cloud Storage
        CDN
        Local Cache
      Monitoring
        Sentry
        LogRocket
        Analytics
```

## 🔄 Component Interactions

### Real-time Synchronization Flow

```mermaid
sequenceDiagram
    participant User1 as User 1
    participant UI1 as UI 1
    participant WS as WebSocket Server
    participant DB as Database
    participant UI2 as UI 2
    participant User2 as User 2
    
    User1->>UI1: Select Zone
    UI1->>WS: Send Selection Event
    WS->>DB: Update Selection State
    WS->>UI2: Broadcast Selection
    UI2->>User2: Show Selection
    
    User2->>UI2: Edit Content
    UI2->>WS: Send Edit Event
    WS->>DB: Save Changes
    WS->>UI1: Broadcast Update
    UI1->>User1: Show Updated Content
    
    Note over WS: WebSocket maintains persistent connection
    Note over DB: Changes persisted in real-time
```

### Cross-Component Event System

```mermaid
graph LR
    subgraph "Event Bus System"
        EventBus[Central Event Bus]
        
        subgraph "Publishers"
            PDFView[PDF Viewer]
            TextEdit[Text Editor]
            ZoneMgr[Zone Manager]
        end
        
        subgraph "Subscribers"
            Highlight[Highlighter]
            Sync[Sync Manager]
            Export[Export System]
        end
        
        PDFView -->|zone.selected| EventBus
        TextEdit -->|content.changed| EventBus
        ZoneMgr -->|zone.modified| EventBus
        
        EventBus -->|zone.selected| Highlight
        EventBus -->|content.changed| Sync
        EventBus -->|zone.modified| Export
    end
```

## 🛠️ Tool Inventory

### Complete Feature Matrix

| Category | Tool/Feature | Description | Status | Integration Points |
|----------|--------------|-------------|--------|-------------------|
| **PDF Processing** |||||
| | Unstructured.io | General-purpose extraction | ✅ Active | API, Zone Detection |
| | PDFPlumber | Text and table extraction | ✅ Active | API, Table Parser |
| | PyMuPDF | Fast PDF rendering | ✅ Active | Viewer, Thumbnails |
| | Camelot | Advanced table extraction | ✅ Active | Table Detection |
| | Tabula | Java-based table parser | ✅ Active | Table Export |
| **Viewer Features** |||||
| | PDF.js | Client-side PDF rendering | ✅ Active | React, Canvas |
| | Dual-pane View | Side-by-side comparison | ✅ Active | Layout System |
| | Zone Highlighting | Visual zone indicators | ✅ Active | Event Bus |
| | Synchronized Scrolling | Linked viewport scrolling | ✅ Active | Scroll Manager |
| | Page Navigation | Thumbnail & page jump | ✅ Active | Navigation Bar |
| | Zoom Controls | Dynamic zoom levels | ✅ Active | Viewport Manager |
| **Editor Features** |||||
| | Monaco Editor | VSCode-based editor | ✅ Active | React Integration |
| | Rich Text Editing | Formatting tools | ✅ Active | Toolbar |
| | Markdown Support | MD preview & export | ✅ Active | Markdown Parser |
| | JSON Editing | Structured data edit | ✅ Active | JSON Schema |
| | Auto-save | Periodic saving | ✅ Active | Debounced Save |
| | Word Count | Real-time statistics | ✅ Active | Text Analysis |
| **Zone Management** |||||
| | Zone Selection | Multi-select capability | ✅ Active | Selection Manager |
| | Zone Editing | Modify zone boundaries | ✅ Active | Canvas Overlay |
| | Zone Merging | Combine multiple zones | ✅ Active | Zone Algorithm |
| | Zone Splitting | Divide single zone | ✅ Active | Split Logic |
| | Zone Reordering | Drag-drop ordering | ✅ Active | DnD Library |
| | Confidence Display | Show extraction confidence | ✅ Active | Visual Indicators |
| **Export System** |||||
| | RAG Chunking | LLM-optimized chunks | ✅ Active | Tiktoken |
| | JSONL Export | Training data format | ✅ Active | JSON Generator |
| | Corrections Export | Edit tracking | ✅ Active | Diff Algorithm |
| | Manifest Generation | Document metadata | ✅ Active | Meta Collector |
| | Batch Export | Multiple formats | ✅ Active | Queue System |
| | Progress Tracking | Real-time progress | ✅ Active | Progress API |
| **Validation** |||||
| | Schema Validation | Format checking | ✅ Active | AJV |
| | Content Validation | Quality assurance | ✅ Active | Custom Rules |
| | Token Counting | Size estimation | ✅ Active | Tiktoken |
| | Error Reporting | Detailed feedback | ✅ Active | Error System |
| | Override System | Manual approval | ✅ Active | Approval Flow |
| **Collaboration** |||||
| | Real-time Updates | Live synchronization | ✅ Active | WebSocket |
| | Multi-user Editing | Concurrent editing | 🔄 Planned | CRDT/OT |
| | Comment System | Annotations | 🔄 Planned | Comment API |
| | Version Control | Change history | 🔄 Planned | Git Integration |
| **API Features** |||||
| | REST API | Standard endpoints | ✅ Active | FastAPI |
| | GraphQL | Flexible queries | 🔄 Planned | GraphQL Server |
| | Webhooks | Event notifications | ✅ Active | Event System |
| | API Keys | Authentication | 🔄 Planned | Auth System |

## 📊 Data Flow Patterns

### Document Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Uploaded: User uploads PDF
    Uploaded --> Processing: Start processing
    Processing --> MultiTool: Extract with multiple tools
    MultiTool --> Aggregating: Combine results
    Aggregating --> ZoneDetection: Detect zones
    ZoneDetection --> Processed: Save to database
    
    Processed --> Viewing: User opens document
    Viewing --> Editing: User edits content
    Editing --> Viewing: Save changes
    
    Viewing --> Exporting: User exports
    Exporting --> Validating: Check export
    Validating --> Generating: Create export
    Generating --> Complete: Download ready
    
    Complete --> [*]: Process complete
    
    Editing --> Collaborating: Share with others
    Collaborating --> Editing: Real-time sync
```

### Zone State Machine

```mermaid
stateDiagram-v2
    [*] --> Detected: Auto-detected
    Detected --> Selected: User selects
    Selected --> Highlighted: Visual feedback
    
    Selected --> Editing: Edit mode
    Editing --> Modified: Content changed
    Modified --> Selected: Save changes
    
    Selected --> Merging: Merge action
    Merging --> Modified: Zones combined
    
    Selected --> Splitting: Split action
    Splitting --> Modified: Zone divided
    
    Selected --> Deleting: Delete action
    Deleting --> [*]: Zone removed
    
    Modified --> Exporting: Include in export
    Exporting --> Exported: Export complete
    Exported --> [*]: Process done
```

## 🎯 Key User Workflows

### 1. Quick Extract Workflow
```
Upload PDF → Auto-process → View results → Quick export (RAG chunks)
Time: ~2-3 minutes
```

### 2. Detailed Review Workflow
```
Upload → Process → Review all zones → Edit/correct content → Validate → Configure export → Download
Time: ~10-15 minutes
```

### 3. Collaborative Workflow
```
Upload → Process → Share link → Multiple users edit → Review changes → Approve → Export
Time: Variable
```

### 4. Batch Processing Workflow
```
Upload multiple PDFs → Queue processing → Bulk zone review → Batch configuration → Mass export
Time: ~5 minutes per document
```

### 5. API Integration Workflow
```
API upload → Webhook notification → Automated processing → Programmatic export → API response
Time: ~1-2 minutes
```

## 🔗 Integration Points

### External Services
- **Storage**: S3, Google Cloud Storage, Azure Blob
- **Authentication**: Auth0, Supabase Auth, Custom JWT
- **Analytics**: Google Analytics, Mixpanel, Custom Events
- **Monitoring**: Sentry, LogRocket, DataDog
- **LLM Services**: OpenAI, Anthropic, Local Models

### Internal APIs
- **Document API**: CRUD operations for documents
- **Zone API**: Zone management endpoints
- **Export API**: Export generation and download
- **WebSocket API**: Real-time synchronization
- **Processing API**: PDF processing triggers

---

This ecosystem map provides a complete overview of the PDF Intelligence Platform, showing how all components work together to deliver a comprehensive PDF processing solution.