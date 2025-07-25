# Backend Architecture

## Technology Stack
- FastAPI (Python)
- TypeScript for type definitions
- WebSocket support
- PDF processing tools
- Document database (MongoDB)
- Redis for caching

## API Gateway

### FastAPI Application
```python
# main.py
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, document_id: str):
        await websocket.accept()
        self.active_connections[document_id] = websocket

    async def disconnect(self, document_id: str):
        if document_id in self.active_connections:
            del self.active_connections[document_id]

    async def send_update(self, document_id: str, data: dict):
        if document_id in self.active_connections:
            await self.active_connections[document_id].send_json(data)

manager = ConnectionManager()
```

### API Routes
```python
# routes/processing.py
from fastapi import APIRouter, UploadFile, File
from typing import List

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # Handle document upload
    pass

@router.get("/zones/{document_id}")
async def get_zones(document_id: str):
    # Get zones for document
    pass

@router.post("/process/{zone_id}")
async def process_zone(zone_id: str, tool: str):
    # Process specific zone
    pass

@router.post("/export")
async def export_document(document_id: str, format: str, zones: List[str]):
    # Handle document export
    pass
```

## Orchestration Engine

### Tool Management
```python
# core/tool_manager.py
from typing import Dict, Type
from abc import ABC, abstractmethod

class ExtractionTool(ABC):
    @abstractmethod
    async def process(self, content: bytes) -> Dict:
        pass

    @abstractmethod
    async def validate(self, result: Dict) -> bool:
        pass

class ToolManager:
    def __init__(self):
        self.tools: Dict[str, Type[ExtractionTool]] = {}
        self.register_tools()

    def register_tools(self):
        self.tools.update({
            'unstructured': UnstructuredTool,
            'pdfplumber': PDFPlumberTool,
            'pymupdf': PyMuPDFTool,
            'camelot': CamelotTool,
            'tabula': TabulaTool,
        })

    async def get_tool(self, name: str) -> ExtractionTool:
        if name not in self.tools:
            raise ValueError(f"Unknown tool: {name}")
        return self.tools[name]()

    async def process_with_tool(self, tool_name: str, content: bytes) -> Dict:
        tool = await self.get_tool(tool_name)
        result = await tool.process(content)
        if not await tool.validate(result):
            raise ValueError("Tool output validation failed")
        return result
```

### Confidence Management
```python
# core/confidence_manager.py
from typing import List, Dict

class ConfidenceManager:
    def __init__(self):
        self.thresholds = {
            'text': 0.80,
            'table': 0.70,
            'diagram': 0.60
        }

    async def calculate_confidence(
        self,
        results: List[Dict],
        weights: Dict[str, float]
    ) -> float:
        if not results:
            return 0.0

        weighted_sum = 0
        total_weight = 0

        for result in results:
            tool = result['tool']
            confidence = result['confidence']
            weight = weights.get(tool, 1.0)
            
            weighted_sum += confidence * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    async def validate_confidence(
        self,
        content_type: str,
        confidence: float
    ) -> bool:
        threshold = self.thresholds.get(content_type, 0.80)
        return confidence >= threshold
```

### Export Management
```python
# core/export_manager.py
from typing import List, Dict
import json

class ExportManager:
    async def export_rag_json(self, zones: List[Dict]) -> Dict:
        chunks = []
        for zone in zones:
            chunk = {
                'content': zone['content'],
                'metadata': {
                    'zone_id': zone['id'],
                    'confidence': zone['confidence'],
                    'tool': zone['tool'],
                    'page': zone['page']
                }
            }
            chunks.append(chunk)
        return {'chunks': chunks}

    async def export_fine_tune_jsonl(self, zones: List[Dict]) -> List[str]:
        records = []
        for zone in zones:
            record = {
                'instruction': f"Extract content from page {zone['page']}",
                'input': zone['original_content'],
                'output': zone['content'],
                'metadata': {
                    'tool': zone['tool'],
                    'confidence': zone['confidence']
                }
            }
            records.append(json.dumps(record))
        return records

    async def generate_manifest(self, document_id: str, zones: List[Dict]) -> Dict:
        return {
            'document_id': document_id,
            'total_zones': len(zones),
            'zones': [{
                'id': zone['id'],
                'type': zone['type'],
                'tool': zone['tool'],
                'confidence': zone['confidence'],
                'status': zone['status']
            } for zone in zones]
        }
```

## Database Schema

### MongoDB Collections
```python
# db/models.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Zone(BaseModel):
    id: str
    document_id: str
    type: str
    page: int
    bounds: Dict[str, float]
    content: str
    tool: str
    confidence: float
    status: str
    created_at: datetime
    updated_at: datetime

class Document(BaseModel):
    id: str
    filename: str
    total_pages: int
    status: str
    zones: List[str]
    created_at: datetime
    updated_at: datetime

class ProcessingHistory(BaseModel):
    zone_id: str
    tool: str
    confidence: float
    status: str
    error: Optional[str]
    timestamp: datetime
```

## Caching Strategy

### Redis Implementation
```python
# cache/redis_manager.py
from redis import Redis
from typing import Optional, Any
import json

class CacheManager:
    def __init__(self):
        self.redis = Redis(host='localhost', port=6379, db=0)
        self.default_ttl = 3600  # 1 hour

    async def get(self, key: str) -> Optional[Any]:
        value = self.redis.get(key)
        return json.loads(value) if value else None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        ttl = ttl or self.default_ttl
        return self.redis.setex(
            key,
            ttl,
            json.dumps(value)
        )

    async def delete(self, key: str) -> bool:
        return self.redis.delete(key) > 0

    async def cache_zone_result(
        self,
        zone_id: str,
        tool: str,
        result: Dict
    ) -> bool:
        key = f"zone:{zone_id}:tool:{tool}"
        return await self.set(key, result)
```

## Error Handling

### Custom Exceptions
```python
# core/exceptions.py
class ProcessingError(Exception):
    def __init__(self, message: str, tool: str, zone_id: str):
        self.message = message
        self.tool = tool
        self.zone_id = zone_id
        super().__init__(self.message)

class ValidationError(Exception):
    def __init__(self, message: str, errors: List[str]):
        self.message = message
        self.errors = errors
        super().__init__(self.message)

class ExportError(Exception):
    def __init__(self, message: str, format: str):
        self.message = message
        self.format = format
        super().__init__(self.message)
```

### Error Middleware
```python
# middleware/error_handler.py
from fastapi import Request
from fastapi.responses import JSONResponse
from core.exceptions import ProcessingError, ValidationError, ExportError

async def error_handler(request: Request, call_next):
    try:
        return await call_next(request)
    except ProcessingError as e:
        return JSONResponse(
            status_code=400,
            content={
                'error': 'processing_error',
                'message': str(e),
                'tool': e.tool,
                'zone_id': e.zone_id
            }
        )
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={
                'error': 'validation_error',
                'message': str(e),
                'errors': e.errors
            }
        )
    except ExportError as e:
        return JSONResponse(
            status_code=400,
            content={
                'error': 'export_error',
                'message': str(e),
                'format': e.format
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                'error': 'internal_error',
                'message': str(e)
            }
        )
``` 