import * as pdfjsLib from 'pdfjs-dist';
import type { Document, Zone, ProcessingStatus, ProcessingTool } from '@pdf-platform/shared';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

interface ProcessingResult {
  documentId: string;
  zones: Zone[];
  overallConfidence: number;
  processingTime: number;
  errors: ProcessingError[];
}

interface ZoneResult {
  zoneId: string;
  content: string;
  confidence: number;
  tool: string;
  metadata: ProcessingMetadata;
}

interface ProcessingError {
  code: string;
  message: string;
  zoneId?: string;
  tool?: string;
}

interface ProcessingMetadata {
  processingTime: number;
  attempt: number;
  fallbackUsed: boolean;
  originalTool?: string;
}

interface ZoneDetectionResult {
  zones: Omit<Zone, 'id' | 'lastUpdated'>[];
  confidence: number;
  metadata: {
    processingTime: number;
    detectionMethod: string;
  };
}

export class ProcessingOrchestrator {
  private availableTools: ProcessingTool[];
  private confidenceThreshold: number;

  constructor(options: {
    confidenceThreshold?: number;
  } = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.availableTools = this.initializeTools();
  }

  /**
   * Process entire document - main entry point
   */
  async processDocument(
    document: Document,
    onProgress?: (status: ProcessingStatus) => void
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: ProcessingError[] = [];
    
    try {
      console.log(`Starting processing for document ${document.id}`);
      
      // Step 1: Detect zones in the PDF
      const detectionResult = await this.detectZones(document);
      
      if (detectionResult.zones.length === 0) {
        throw new Error('No processable zones detected in document');
      }

      // Step 2: Assign unique IDs to zones and convert to full Zone objects
      const zones: Zone[] = detectionResult.zones.map((zone, index) => ({
        ...zone,
        id: `${document.id}-zone-${index + 1}`,
        status: 'processing',
        lastUpdated: new Date()
      }));

      // Step 3: Process each zone with appropriate tools
      const processedZones: Zone[] = [];
      const totalZones = zones.length;
      
      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        
        // Update progress
        if (onProgress) {
          onProgress({
            totalZones,
            completedZones: i,
            currentlyProcessing: [zone.id],
            estimatedTimeRemaining: this.estimateRemainingTime(i, totalZones, startTime)
          });
        }

        try {
          const processedZone = await this.processZone(zone);
          processedZones.push(processedZone);
        } catch (error) {
          console.error(`Failed to process zone ${zone.id}:`, error);
          errors.push({
            code: 'ZONE_PROCESSING_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            zoneId: zone.id
          });
          
          // Add zone with error status
          processedZones.push({
            ...zone,
            status: 'error',
            confidence: 0,
            content: '',
            lastUpdated: new Date()
          });
        }
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          totalZones,
          completedZones: totalZones,
          currentlyProcessing: [],
          estimatedTimeRemaining: 0
        });
      }

      const processingTime = Date.now() - startTime;
      const overallConfidence = this.calculateOverallConfidence(processedZones);

      console.log(`Document processing completed in ${processingTime}ms`);

      return {
        documentId: document.id,
        zones: processedZones,
        overallConfidence,
        processingTime,
        errors
      };

    } catch (error) {
      console.error('Document processing failed:', error);
      errors.push({
        code: 'DOCUMENT_PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        documentId: document.id,
        zones: [],
        overallConfidence: 0,
        processingTime: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Process a single zone with the best available tool
   */
  async processZone(zone: Zone, preferredTool?: string): Promise<Zone> {
    console.log(`Processing zone ${zone.id} (type: ${zone.type})`);
    
    const tools = preferredTool 
      ? this.availableTools.filter(t => t.name === preferredTool)
      : this.getToolsForZoneType(zone.type);

    if (tools.length === 0) {
      throw new Error(`No tools available for zone type: ${zone.type}`);
    }

    let lastError: Error | null = null;
    
    // Try tools in priority order
    for (const tool of tools) {
      try {
        const result = await this.executeToolOnZone(zone, tool);
        
        if (result.confidence >= this.confidenceThreshold) {
          return {
            ...zone,
            content: result.content,
            confidence: result.confidence,
            tool: result.tool,
            status: 'completed',
            lastUpdated: new Date()
          };
        } else {
          console.log(`Tool ${tool.name} confidence (${result.confidence}) below threshold (${this.confidenceThreshold})`);
        }
        
      } catch (error) {
        console.error(`Tool ${tool.name} failed for zone ${zone.id}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    // If we get here, all tools failed or didn't meet confidence threshold
    throw lastError || new Error('All processing tools failed or below confidence threshold');
  }

  /**
   * Detect zones in the PDF document
   */
  private async detectZones(document: Document): Promise<ZoneDetectionResult> {
    const startTime = Date.now();
    console.log(`Detecting zones in document ${document.id}`);

    try {
      // Read PDF file and extract text positions
      const pdfPath = document.filePath.startsWith('/') 
        ? document.filePath.substring(1) 
        : document.filePath;
      
      // For now, we'll simulate zone detection
      // In a real implementation, this would use actual PDF analysis tools
      const zones = await this.simulateZoneDetection(document);
      
      const processingTime = Date.now() - startTime;
      console.log(`Zone detection completed in ${processingTime}ms, found ${zones.length} zones`);

      return {
        zones,
        confidence: 0.85, // Simulated confidence
        metadata: {
          processingTime,
          detectionMethod: 'coordinate-based'
        }
      };

    } catch (error) {
      console.error('Zone detection failed:', error);
      throw new Error(`Zone detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate zone detection (placeholder for actual implementation)
   */
  private async simulateZoneDetection(document: Document): Promise<Omit<Zone, 'id' | 'lastUpdated'>[]> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const zones: Omit<Zone, 'id' | 'lastUpdated'>[] = [];
    
    // Generate mock zones for each page
    for (let page = 1; page <= document.pageCount; page++) {
      // Simulate finding 1-3 zones per page
      const zonesPerPage = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < zonesPerPage; i++) {
        const zoneType = ['text', 'table', 'diagram'][Math.floor(Math.random() * 3)] as 'text' | 'table' | 'diagram';
        
        zones.push({
          page,
          coordinates: {
            x: Math.floor(Math.random() * 400) + 50,
            y: Math.floor(Math.random() * 600) + 50,
            width: Math.floor(Math.random() * 200) + 100,
            height: Math.floor(Math.random() * 100) + 50
          },
          content: '',
          confidence: 0,
          type: zoneType,
          status: 'processing',
          tool: ''
        });
      }
    }

    return zones;
  }

  /**
   * Execute a specific tool on a zone
   */
  private async executeToolOnZone(zone: Zone, tool: ProcessingTool): Promise<ZoneResult> {
    console.log(`Executing tool ${tool.name} on zone ${zone.id}`);
    
    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, tool.estimatedTime));
    
    // Simulate extraction results based on zone type and tool
    const confidence = this.simulateToolConfidence(zone.type, tool.name);
    const content = this.simulateExtractedContent(zone.type);
    
    return {
      zoneId: zone.id,
      content,
      confidence,
      tool: tool.name,
      metadata: {
        processingTime: tool.estimatedTime,
        attempt: 1,
        fallbackUsed: false
      }
    };
  }

  /**
   * Get tools suitable for a specific zone type
   */
  private getToolsForZoneType(zoneType: string): ProcessingTool[] {
    return this.availableTools
      .filter(tool => tool.supportedTypes.includes(zoneType))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Initialize available processing tools
   */
  private initializeTools(): ProcessingTool[] {
    return [
      {
        name: 'unstructured',
        supportedTypes: ['text', 'table'],
        priority: 10,
        estimatedTime: 2000
      },
      {
        name: 'pdfplumber',
        supportedTypes: ['text', 'table'],
        priority: 8,
        estimatedTime: 1500
      },
      {
        name: 'pymupdf',
        supportedTypes: ['text', 'diagram'],
        priority: 6,
        estimatedTime: 1000
      },
      {
        name: 'camelot',
        supportedTypes: ['table'],
        priority: 9,
        estimatedTime: 3000
      },
      {
        name: 'tabula',
        supportedTypes: ['table'],
        priority: 7,
        estimatedTime: 2500
      }
    ];
  }

  /**
   * Calculate overall confidence score for all zones
   */
  private calculateOverallConfidence(zones: Zone[]): number {
    if (zones.length === 0) return 0;
    
    const totalConfidence = zones.reduce((sum, zone) => sum + zone.confidence, 0);
    return totalConfidence / zones.length;
  }

  /**
   * Estimate remaining processing time
   */
  private estimateRemainingTime(completed: number, total: number, startTime: number): number {
    if (completed === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const avgTimePerZone = elapsed / completed;
    const remaining = total - completed;
    
    return Math.round((remaining * avgTimePerZone) / 1000); // Return in seconds
  }

  /**
   * Simulate tool confidence based on zone type and tool compatibility
   */
  private simulateToolConfidence(zoneType: string, toolName: string): number {
    const baseConfidence = {
      unstructured: { text: 0.9, table: 0.85, diagram: 0.6 },
      pdfplumber: { text: 0.85, table: 0.8, diagram: 0.5 },
      pymupdf: { text: 0.8, table: 0.7, diagram: 0.8 },
      camelot: { text: 0.6, table: 0.95, diagram: 0.4 },
      tabula: { text: 0.5, table: 0.9, diagram: 0.3 }
    };

    const confidence = baseConfidence[toolName as keyof typeof baseConfidence]?.[zoneType as keyof typeof baseConfidence['unstructured']] || 0.5;
    
    // Add some randomness
    const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
    return Math.max(0.1, Math.min(1.0, confidence + variance));
  }

  /**
   * Simulate extracted content based on zone type
   */
  private simulateExtractedContent(zoneType: string): string {
    const templates = {
      text: [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco.'
      ],
      table: [
        'Name\tValue\tDescription\nRow 1\t100\tSample data\nRow 2\t200\tMore data',
        'Product\tPrice\tQuantity\nWidget\t$10.00\t5\nGadget\t$15.00\t3'
      ],
      diagram: [
        '[Diagram: Flowchart showing process steps]',
        '[Diagram: Chart with data visualization]',
        '[Diagram: Technical schematic]'
      ]
    };

    const options = templates[zoneType as keyof typeof templates] || templates.text;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get current processing status
   */
  async getProcessingStatus(documentId: string): Promise<ProcessingStatus> {
    // TODO: In a real implementation, this would query the job status from a database or queue
    return {
      totalZones: 0,
      completedZones: 0,
      currentlyProcessing: [],
      estimatedTimeRemaining: 0
    };
  }

  /**
   * Cancel ongoing processing
   */
  async cancelProcessing(documentId: string): Promise<void> {
    console.log(`Cancelling processing for document ${documentId}`);
    // TODO: Implement actual cancellation logic
  }
}

// Export singleton instance
export const processingOrchestrator = new ProcessingOrchestrator(); 