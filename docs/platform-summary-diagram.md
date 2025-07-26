# PDF Intelligence Platform - Quick Reference Diagram

## 🎯 Platform at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PDF INTELLIGENCE PLATFORM ECOSYSTEM                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  USER ENTRY POINTS           CORE SYSTEMS              BACKEND SERVICES      │
│  ┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐  │
│  │ 🌐 Web Browser  │───────▶│ 📤 Upload System │──────▶│ 🚀 FastAPI      │  │
│  │ 🔌 REST API     │        │ ⚙️ Processing    │       │ 🔄 WebSocket    │  │
│  │ 💻 CLI Tool     │        │ 👁️ Viewer        │       │ 🗄️ PostgreSQL   │  │
│  └─────────────────┘        │ ✏️ Editor        │       │ ☁️ S3 Storage   │  │
│                             │ 📥 Export System │       └─────────────────┘  │
│                             └─────────────────┘                             │
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                              PROCESSING PIPELINE                              │
│                                                                               │
│  PDF Input ──▶ [Unstructured] ──▶ [PDFPlumber] ──▶ [PyMuPDF] ──┐           │
│                     │                   │                │        │           │
│                     └───────────────────┴────────────────┘        ▼           │
│                                                              Zone Detection    │
│  [Camelot] ──────────────▶ [Tabula] ─────────────────────▶ & Aggregation    │
│                                                                    │           │
│                                                                    ▼           │
│                                                              📊 Results       │
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                              KEY FEATURES                                     │
│                                                                               │
│  VIEWER                    EDITOR                    EXPORT                   │
│  ├─ Dual-pane View        ├─ Monaco Editor         ├─ RAG Chunks            │
│  ├─ Zone Highlighting     ├─ Rich Text             ├─ JSONL Format          │
│  ├─ Sync Scrolling        ├─ Auto-save             ├─ Corrections           │
│  └─ Cross-highlighting    └─ Word Count            └─ Batch Export          │
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                              TECH STACK                                       │
│                                                                               │
│  Frontend: Next.js 14.2.30, React 18, TypeScript, Tailwind CSS              │
│  Backend:  FastAPI, Python 3.11+, Celery, Redis                             │
│  Database: PostgreSQL, Supabase, S3 Storage                                 │
│  PDF Tools: PDF.js, Monaco Editor, Tiktoken                                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Core Workflows

```
1. QUICK EXTRACT
   Upload ──▶ Process ──▶ View ──▶ Export
   (2-3 minutes)

2. DETAILED REVIEW
   Upload ──▶ Process ──▶ Review ──▶ Edit ──▶ Validate ──▶ Export
   (10-15 minutes)

3. COLLABORATIVE
   Upload ──▶ Share ──▶ Multi-Edit ──▶ Review ──▶ Export
   (Variable time)

4. API INTEGRATION
   API Upload ──▶ Webhook ──▶ Auto-Process ──▶ API Export
   (1-2 minutes)
```

## 📊 Zone Types & Export Formats

```
ZONE TYPES                          EXPORT FORMATS
┌─────────────┐                    ┌──────────────────┐
│ 📝 Text     │                    │ 🤖 RAG Chunks    │
│ 📊 Table    │       ────▶        │ 📋 JSONL         │
│ 🖼️ Image    │                    │ ✏️ Corrections   │
│ 📈 Diagram  │                    │ 📄 Manifest      │
└─────────────┘                    │ 📜 Export Log    │
                                   └──────────────────┘
```

## 🎛️ System Components

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Pages     │  │ Components  │  │   Hooks     │    │
│  │  /upload    │  │  Viewer     │  │ useDocument │    │
│  │  /viewer    │  │  Editor     │  │ useZones    │    │
│  │  /export    │  │  Export     │  │ useExport   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    STATE MANAGEMENT                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Zustand   │  │React Query  │  │  WebSocket  │    │
│  │   Store     │  │   Cache     │  │   State     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    BACKEND LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Routes    │  │  Services   │  │   Workers   │    │
│  │  /api/*     │  │ Processing  │  │   Celery    │    │
│  │  /ws/*      │  │ Validation  │  │   Tasks     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 🔗 Integration Points

- **Storage**: AWS S3, Google Cloud Storage, Azure Blob
- **Auth**: Auth0, Supabase Auth, JWT
- **Analytics**: Google Analytics, Mixpanel
- **Monitoring**: Sentry, LogRocket
- **LLMs**: OpenAI API, Anthropic API

## 📈 Platform Statistics

- **35+** Active Features
- **5** PDF Processing Tools
- **4** Zone Types
- **5** Export Formats
- **Real-time** Collaboration
- **Multi-tool** Processing
- **Session-based** Export System

---

*This diagram provides a high-level overview of the PDF Intelligence Platform ecosystem. For detailed documentation, see the full ecosystem map.*