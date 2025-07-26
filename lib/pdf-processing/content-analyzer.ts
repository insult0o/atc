import { PDFDocumentProxy } from 'pdfjs-dist';
import { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

// Core interfaces for content analysis
export interface ContentAnalysisResult {
  zones: DetectedZone[];
  confidence: number;
  analysisMethod: 'text-flow' | 'grid-detection' | 'visual-pattern' | 'hybrid';
  metadata: AnalysisMetadata;
  processingTime: number;
  documentCharacteristics: DocumentCharacteristics;
}

export interface DetectedZone {
  id: string;
  coordinates: ZoneCoordinates;
  contentType: 'text' | 'table' | 'diagram' | 'mixed' | 'header' | 'footer';
  confidence: number;
  characteristics: ContentCharacteristics;
  recommendedTools: ToolRecommendation[];
  boundingBox: BoundingBox;
  pageNumber: number;
  textContent?: string;
  visualFeatures?: VisualFeatures;
}

export interface ZoneCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ContentCharacteristics {
  textDensity: number;        // Characters per unit area
  lineSpacing: number;        // Average line spacing
  wordSpacing: number;        // Average word spacing
  fontSizes: number[];        // Detected font sizes
  hasStructure: boolean;      // Tables, lists, etc.
  hasImages: boolean;         // Contains visual elements
  complexity: 'low' | 'medium' | 'high';
  readingOrder: number;       // Suggested reading sequence
  language?: string;          // Detected language
}

export interface ToolRecommendation {
  toolName: string;
  suitabilityScore: number;   // 0-1 confidence in tool effectiveness
  reasoning: string;          // Why this tool was recommended
  estimatedAccuracy: number;  // Expected accuracy for this content
  priority: number;           // Processing priority (1-10)
  metadata: ToolMetadata;
}

export interface ToolMetadata {
  expectedProcessingTime: number;
  memoryRequirement: number;
  complexity: 'low' | 'medium' | 'high';
  supportedContentTypes: string[];
}

export interface AnalysisMetadata {
  algorithmVersion: string;
  processingDate: Date;
  documentHash: string;
  pageCount: number;
  analysisSettings: AnalysisSettings;
  performanceMetrics: PerformanceMetrics;
}

export interface AnalysisSettings {
  enableTextFlow: boolean;
  enableGridDetection: boolean;
  enableVisualPattern: boolean;
  confidenceThreshold: number;
  maxZonesPerPage: number;
  minZoneSize: number;
}

export interface PerformanceMetrics {
  totalTime: number;
  textFlowTime: number;
  gridDetectionTime: number;
  visualPatternTime: number;
  mergeTime: number;
  zonesDetected: number;
  averageConfidence: number;
}

export interface DocumentCharacteristics {
  pageCount: number;
  averageTextDensity: number;
  hasMultiColumn: boolean;
  hasTablesDetected: boolean;
  hasDiagramsDetected: boolean;
  primaryLanguage: string;
  documentType: 'academic' | 'business' | 'technical' | 'mixed' | 'unknown';
}

export interface VisualFeatures {
  hasLines: boolean;
  hasBorders: boolean;
  hasShading: boolean;
  hasImages: boolean;
  colorComplexity: number;
  imageCount: number;
}

// Zone conflict resolution interfaces
export interface ZoneConflictResolution {
  strategy: 'merge' | 'split' | 'priority_based' | 'user_intervention';
  overlapThreshold: number;
  confidenceWeighting: number;
  userInterventionThreshold: number;
  mergeRules: ZoneMergeRule[];
  splitCriteria: ZoneSplitCriteria[];
}

export interface ZoneMergeRule {
  contentTypes: string[];
  maxConfidenceDifference: number;
  spatialProximity: number;
}

export interface ZoneSplitCriteria {
  minSeparation: number;
  contentTypeChange: boolean;
  confidenceThreshold: number;
}

// Text flow analysis interfaces
interface TextFlowAnalysis {
  textItems: ProcessedTextItem[];
  lineGroups: LineGroup[];
  paragraphs: Paragraph[];
  columns: Column[];
  readingOrder: ReadingOrder[];
}

interface ProcessedTextItem {
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  confidence: number;
}

interface LineGroup {
  items: ProcessedTextItem[];
  baseline: number;
  lineHeight: number;
  confidence: number;
}

interface Paragraph {
  lines: LineGroup[];
  boundingBox: BoundingBox;
  alignment: 'left' | 'center' | 'right' | 'justified';
  indentation: number;
  spacing: number;
}

interface Column {
  paragraphs: Paragraph[];
  boundingBox: BoundingBox;
  columnIndex: number;
  textFlow: 'normal' | 'reverse' | 'mixed';
}

interface ReadingOrder {
  zoneId: string;
  sequence: number;
  confidence: number;
  dependencies: string[];
}

// Grid detection interfaces
interface GridAnalysis {
  tables: DetectedTable[];
  gridLines: GridLine[];
  cells: GridCell[];
  confidence: number;
}

interface DetectedTable {
  boundingBox: BoundingBox;
  rows: number;
  columns: number;
  cells: GridCell[][];
  headerRow?: boolean;
  confidence: number;
  complexity: 'simple' | 'complex' | 'nested';
}

interface GridLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  type: 'horizontal' | 'vertical';
  confidence: number;
}

interface GridCell {
  boundingBox: BoundingBox;
  content: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  hasContent: boolean;
  confidence: number;
}

// Main ContentAnalyzer class
export class ContentAnalyzer {
  private settings: AnalysisSettings;
  private conflictResolver: ZoneConflictResolver;
  private performanceTracker: PerformanceTracker;

  constructor(settings: Partial<AnalysisSettings> = {}) {
    this.settings = {
      enableTextFlow: true,
      enableGridDetection: true,
      enableVisualPattern: true,
      confidenceThreshold: 0.7,
      maxZonesPerPage: 50,
      minZoneSize: 100,
      ...settings
    };
    
    this.conflictResolver = new ZoneConflictResolver({
      strategy: 'priority_based',
      overlapThreshold: 0.3,
      confidenceWeighting: 0.4,
      userInterventionThreshold: 0.1,
      mergeRules: [],
      splitCriteria: []
    });
    
    this.performanceTracker = new PerformanceTracker();
  }

  async analyzeDocument(pdfDocument: PDFDocumentProxy): Promise<ContentAnalysisResult> {
    const startTime = performance.now();
    this.performanceTracker.start();

    try {
      const documentCharacteristics = await this.analyzeDocumentCharacteristics(pdfDocument);
      const allZones: DetectedZone[] = [];
      let totalConfidence = 0;

      // Process each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const pageZones = await this.analyzePage(pdfDocument, pageNum);
        allZones.push(...pageZones);
        
        // Calculate page confidence
        const pageConfidence = pageZones.reduce((sum, zone) => sum + zone.confidence, 0) / pageZones.length || 0;
        totalConfidence += pageConfidence;
      }

      // Resolve conflicts between overlapping zones
      const resolvedZones = await this.conflictResolver.resolveConflicts(allZones);
      
      // Calculate overall confidence
      const overallConfidence = totalConfidence / pdfDocument.numPages;
      const processingTime = performance.now() - startTime;

      return {
        zones: resolvedZones,
        confidence: overallConfidence,
        analysisMethod: 'hybrid',
        metadata: {
          algorithmVersion: '1.0.0',
          processingDate: new Date(),
          documentHash: await this.calculateDocumentHash(pdfDocument),
          pageCount: pdfDocument.numPages,
          analysisSettings: this.settings,
          performanceMetrics: this.performanceTracker.getMetrics()
        },
        processingTime,
        documentCharacteristics
      };
    } catch (error) {
      console.error('Content analysis failed:', error);
      throw new Error(`Content analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzePage(pdfDocument: PDFDocumentProxy, pageNum: number): Promise<DetectedZone[]> {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const zones: DetectedZone[] = [];

    try {
      // Text flow analysis
      if (this.settings.enableTextFlow) {
        const textZones = await this.performTextFlowAnalysis(page, pageNum);
        zones.push(...textZones);
      }

      // Grid detection analysis
      if (this.settings.enableGridDetection) {
        const tableZones = await this.performGridDetection(page, pageNum);
        zones.push(...tableZones);
      }

      // Visual pattern analysis
      if (this.settings.enableVisualPattern) {
        const visualZones = await this.performVisualPatternAnalysis(page, pageNum);
        zones.push(...visualZones);
      }

      return zones;
    } catch (error) {
      console.error(`Page ${pageNum} analysis failed:`, error);
      return [];
    }
  }

  private async performTextFlowAnalysis(page: any, pageNum: number): Promise<DetectedZone[]> {
    const textContent = await page.getTextContent();
    const zones: DetectedZone[] = [];

    if (!textContent.items || textContent.items.length === 0) {
      return zones;
    }

    // Group text items into lines
    const lineGroups = this.groupTextIntoLines(textContent.items);
    
    // Group lines into paragraphs
    const paragraphs = this.groupLinesIntoParagraphs(lineGroups);
    
    // Create zones from paragraphs
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const zone = this.createTextZone(paragraph, pageNum, i);
      
      if (zone.characteristics.textDensity > 0.1) { // Filter out low-density zones
        zones.push(zone);
      }
    }

    return zones;
  }

  private groupTextIntoLines(textItems: any[]): LineGroup[] {
    const lines: LineGroup[] = [];
    const processedItems: ProcessedTextItem[] = textItems.map(item => ({
      content: item.str || '',
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: item.height || 0,
      fontSize: item.transform[0] || 12,
      fontFamily: item.fontName || 'default',
      confidence: 0.9
    }));

    // Sort by Y coordinate (top to bottom)
    processedItems.sort((a, b) => b.y - a.y);

    let currentLine: ProcessedTextItem[] = [];
    let currentBaseline: number | null = null;
    const lineThreshold = 5; // pixels

    for (const item of processedItems) {
      if (currentBaseline === null || Math.abs(item.y - currentBaseline) <= lineThreshold) {
        currentLine.push(item);
        currentBaseline = item.y;
      } else {
        if (currentLine.length > 0) {
          lines.push({
            items: [...currentLine].sort((a, b) => a.x - b.x),
            baseline: currentBaseline,
            lineHeight: Math.max(...currentLine.map(i => i.height)),
            confidence: 0.8
          });
        }
        currentLine = [item];
        currentBaseline = item.y;
      }
    }

    // Add the last line
    if (currentLine.length > 0) {
      lines.push({
        items: [...currentLine].sort((a, b) => a.x - b.x),
        baseline: currentBaseline!,
        lineHeight: Math.max(...currentLine.map(i => i.height)),
        confidence: 0.8
      });
    }

    return lines;
  }

  private groupLinesIntoParagraphs(lines: LineGroup[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    let currentParagraph: LineGroup[] = [];
    
    const paragraphSpacingThreshold = 15; // pixels

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      currentParagraph.push(currentLine);

      // Check if this is the end of a paragraph
      if (!nextLine || 
          Math.abs(currentLine.baseline - nextLine.baseline) > paragraphSpacingThreshold) {
        
        if (currentParagraph.length > 0) {
          const boundingBox = this.calculateParagraphBoundingBox(currentParagraph);
          paragraphs.push({
            lines: [...currentParagraph],
            boundingBox,
            alignment: this.detectAlignment(currentParagraph),
            indentation: this.calculateIndentation(currentParagraph),
            spacing: this.calculateSpacing(currentParagraph)
          });
        }
        currentParagraph = [];
      }
    }

    return paragraphs;
  }

  private createTextZone(paragraph: Paragraph, pageNum: number, index: number): DetectedZone {
    const textContent = paragraph.lines
      .map(line => line.items.map(item => item.content).join(' '))
      .join('\n');

    const characteristics = this.analyzeTextCharacteristics(paragraph);
    const tools = this.recommendToolsForText(characteristics);

    return {
      id: `text-${pageNum}-${index}`,
      coordinates: {
        x: paragraph.boundingBox.left,
        y: paragraph.boundingBox.top,
        width: paragraph.boundingBox.right - paragraph.boundingBox.left,
        height: paragraph.boundingBox.bottom - paragraph.boundingBox.top
      },
      contentType: 'text',
      confidence: this.calculateTextConfidence(paragraph),
      characteristics,
      recommendedTools: tools,
      boundingBox: paragraph.boundingBox,
      pageNumber: pageNum,
      textContent
    };
  }

  private async performGridDetection(page: any, pageNum: number): Promise<DetectedZone[]> {
    // Simplified grid detection - in a real implementation, this would use
    // computer vision techniques to detect table structures
    const zones: DetectedZone[] = [];
    
    try {
      // This is a placeholder for actual grid detection algorithm
      // Real implementation would analyze page graphics and detect table structures
      const mockTable = this.createMockTableZone(pageNum);
      if (mockTable) {
        zones.push(mockTable);
      }
    } catch (error) {
      console.error('Grid detection failed:', error);
    }

    return zones;
  }

  private async performVisualPatternAnalysis(page: any, pageNum: number): Promise<DetectedZone[]> {
    // Simplified visual pattern analysis - in a real implementation, this would use
    // image processing to detect diagrams, charts, and other visual elements
    const zones: DetectedZone[] = [];
    
    try {
      // This is a placeholder for actual visual pattern analysis
      // Real implementation would analyze page images and detect visual patterns
      const mockDiagram = this.createMockDiagramZone(pageNum);
      if (mockDiagram) {
        zones.push(mockDiagram);
      }
    } catch (error) {
      console.error('Visual pattern analysis failed:', error);
    }

    return zones;
  }

  // Helper methods
  private calculateParagraphBoundingBox(lines: LineGroup[]): BoundingBox {
    let left = Infinity, top = -Infinity, right = -Infinity, bottom = Infinity;

    for (const line of lines) {
      for (const item of line.items) {
        left = Math.min(left, item.x);
        right = Math.max(right, item.x + item.width);
        top = Math.max(top, item.y + item.height);
        bottom = Math.min(bottom, item.y);
      }
    }

    return { left, top, right, bottom };
  }

  private detectAlignment(lines: LineGroup[]): 'left' | 'center' | 'right' | 'justified' {
    if (lines.length === 0) return 'left';

    const leftMargins = lines.map(line => 
      line.items.length > 0 ? line.items[0].x : 0
    );
    
    const variance = this.calculateVariance(leftMargins);
    
    if (variance < 5) return 'left';
    if (variance > 50) return 'justified';
    
    return 'left'; // Default
  }

  private calculateIndentation(lines: LineGroup[]): number {
    if (lines.length === 0) return 0;
    
    const firstLineX = lines[0].items[0]?.x || 0;
    const otherLinesX = lines.slice(1).map(line => line.items[0]?.x || 0);
    
    return Math.max(0, firstLineX - Math.min(...otherLinesX));
  }

  private calculateSpacing(lines: LineGroup[]): number {
    if (lines.length < 2) return 0;
    
    const spacings = [];
    for (let i = 1; i < lines.length; i++) {
      spacings.push(Math.abs(lines[i-1].baseline - lines[i].baseline));
    }
    
    return spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
  }

  private analyzeTextCharacteristics(paragraph: Paragraph): ContentCharacteristics {
    const totalArea = (paragraph.boundingBox.right - paragraph.boundingBox.left) *
                     (paragraph.boundingBox.top - paragraph.boundingBox.bottom);
    
    const textLength = paragraph.lines
      .reduce((sum, line) => sum + line.items.reduce((s, item) => s + item.content.length, 0), 0);
    
    const fontSizes = paragraph.lines
      .flatMap(line => line.items.map(item => item.fontSize))
      .filter((size, index, arr) => arr.indexOf(size) === index);

    return {
      textDensity: textLength / totalArea,
      lineSpacing: this.calculateSpacing(paragraph.lines),
      wordSpacing: 5, // Simplified
      fontSizes,
      hasStructure: this.detectTextStructure(paragraph),
      hasImages: false, // Text zones don't contain images
      complexity: this.classifyComplexity(textLength, fontSizes.length),
      readingOrder: 1, // Will be calculated later
      language: 'en' // Simplified - would use language detection
    };
  }

  private recommendToolsForText(characteristics: ContentCharacteristics): ToolRecommendation[] {
    const tools: ToolRecommendation[] = [];
    
    // Unstructured - good for general text
    tools.push({
      toolName: 'unstructured',
      suitabilityScore: 0.9,
      reasoning: 'Excellent for general text extraction',
      estimatedAccuracy: 0.95,
      priority: 1,
      metadata: {
        expectedProcessingTime: 100,
        memoryRequirement: 50,
        complexity: 'low',
        supportedContentTypes: ['text', 'mixed']
      }
    });

    // PDFPlumber - good for structured text
    if (characteristics.hasStructure) {
      tools.push({
        toolName: 'pdfplumber',
        suitabilityScore: 0.8,
        reasoning: 'Good for structured text with consistent formatting',
        estimatedAccuracy: 0.88,
        priority: 2,
        metadata: {
          expectedProcessingTime: 150,
          memoryRequirement: 75,
          complexity: 'medium',
          supportedContentTypes: ['text', 'table']
        }
      });
    }

    return tools.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  private calculateTextConfidence(paragraph: Paragraph): number {
    // Base confidence on text density, structure, and consistency
    const textLength = paragraph.lines
      .reduce((sum, line) => sum + line.items.reduce((s, item) => s + item.content.length, 0), 0);
    
    let confidence = 0.7; // Base confidence
    
    // Boost confidence for longer texts
    if (textLength > 50) confidence += 0.1;
    if (textLength > 200) confidence += 0.1;
    
    // Boost confidence for consistent formatting
    const fontSizes = paragraph.lines
      .flatMap(line => line.items.map(item => item.fontSize));
    
    if (this.calculateVariance(fontSizes) < 2) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private detectTextStructure(paragraph: Paragraph): boolean {
    // Simplified structure detection
    const text = paragraph.lines
      .map(line => line.items.map(item => item.content).join(' '))
      .join('\n');
    
    // Check for list indicators, numbers, bullets, etc.
    const structurePatterns = [
      /^\d+\./,           // Numbered lists
      /^[•\-\*]/,         // Bullet points
      /^[A-Za-z]\)/,      // Lettered lists
      /:\s*$/,            // Colons (headings/labels)
    ];
    
    return structurePatterns.some(pattern => pattern.test(text.trim()));
  }

  private classifyComplexity(textLength: number, fontVariations: number): 'low' | 'medium' | 'high' {
    if (textLength < 100 && fontVariations <= 2) return 'low';
    if (textLength < 500 && fontVariations <= 4) return 'medium';
    return 'high';
  }

  private createMockTableZone(pageNum: number): DetectedZone | null {
    // Mock table detection - replace with actual algorithm
    return {
      id: `table-${pageNum}-1`,
      coordinates: { x: 100, y: 400, width: 400, height: 200 },
      contentType: 'table',
      confidence: 0.85,
      characteristics: {
        textDensity: 0.3,
        lineSpacing: 20,
        wordSpacing: 10,
        fontSizes: [12],
        hasStructure: true,
        hasImages: false,
        complexity: 'medium',
        readingOrder: 2
      },
      recommendedTools: [{
        toolName: 'camelot',
        suitabilityScore: 0.9,
        reasoning: 'Optimized for table extraction',
        estimatedAccuracy: 0.92,
        priority: 1,
        metadata: {
          expectedProcessingTime: 200,
          memoryRequirement: 100,
          complexity: 'high',
          supportedContentTypes: ['table']
        }
      }],
      boundingBox: { left: 100, top: 600, right: 500, bottom: 400 },
      pageNumber: pageNum
    };
  }

  private createMockDiagramZone(pageNum: number): DetectedZone | null {
    // Mock diagram detection - replace with actual algorithm
    return {
      id: `diagram-${pageNum}-1`,
      coordinates: { x: 50, y: 100, width: 300, height: 250 },
      contentType: 'diagram',
      confidence: 0.75,
      characteristics: {
        textDensity: 0.1,
        lineSpacing: 0,
        wordSpacing: 0,
        fontSizes: [],
        hasStructure: false,
        hasImages: true,
        complexity: 'high',
        readingOrder: 3
      },
      recommendedTools: [{
        toolName: 'visual_analyzer',
        suitabilityScore: 0.8,
        reasoning: 'Specialized for visual content analysis',
        estimatedAccuracy: 0.75,
        priority: 1,
        metadata: {
          expectedProcessingTime: 500,
          memoryRequirement: 200,
          complexity: 'high',
          supportedContentTypes: ['diagram', 'image']
        }
      }],
      boundingBox: { left: 50, top: 350, right: 350, bottom: 100 },
      pageNumber: pageNum,
      visualFeatures: {
        hasLines: true,
        hasBorders: true,
        hasShading: false,
        hasImages: true,
        colorComplexity: 0.6,
        imageCount: 1
      }
    };
  }

  private async analyzeDocumentCharacteristics(pdfDocument: PDFDocumentProxy): Promise<DocumentCharacteristics> {
    // Simplified document analysis
    return {
      pageCount: pdfDocument.numPages,
      averageTextDensity: 0.5,
      hasMultiColumn: false,
      hasTablesDetected: true,
      hasDiagramsDetected: true,
      primaryLanguage: 'en',
      documentType: 'mixed'
    };
  }

  private async calculateDocumentHash(pdfDocument: PDFDocumentProxy): Promise<string> {
    // Simplified hash calculation
    return `doc-${pdfDocument.numPages}-${Date.now()}`;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  }
}

// Supporting classes
class ZoneConflictResolver {
  private config: ZoneConflictResolution;

  constructor(config: ZoneConflictResolution) {
    this.config = config;
  }

  async resolveConflicts(zones: DetectedZone[]): Promise<DetectedZone[]> {
    const resolvedZones: DetectedZone[] = [];
    const processedZones = new Set<string>();

    for (const zone of zones) {
      if (processedZones.has(zone.id)) continue;

      const overlappingZones = this.findOverlappingZones(zone, zones);
      
      if (overlappingZones.length === 0) {
        resolvedZones.push(zone);
        processedZones.add(zone.id);
      } else {
        const resolved = await this.resolveZoneGroup([zone, ...overlappingZones]);
        resolved.forEach(z => {
          resolvedZones.push(z);
          processedZones.add(z.id);
        });
      }
    }

    return resolvedZones;
  }

  private findOverlappingZones(targetZone: DetectedZone, allZones: DetectedZone[]): DetectedZone[] {
    return allZones.filter(zone => 
      zone.id !== targetZone.id && 
      zone.pageNumber === targetZone.pageNumber &&
      this.calculateOverlap(targetZone, zone) > this.config.overlapThreshold
    );
  }

  private calculateOverlap(zone1: DetectedZone, zone2: DetectedZone): number {
    const intersection = this.calculateIntersection(zone1.boundingBox, zone2.boundingBox);
    const union = this.calculateUnion(zone1.boundingBox, zone2.boundingBox);
    return intersection / union;
  }

  private calculateIntersection(box1: BoundingBox, box2: BoundingBox): number {
    const left = Math.max(box1.left, box2.left);
    const right = Math.min(box1.right, box2.right);
    const top = Math.min(box1.top, box2.top);
    const bottom = Math.max(box1.bottom, box2.bottom);

    if (left < right && bottom < top) {
      return (right - left) * (top - bottom);
    }
    return 0;
  }

  private calculateUnion(box1: BoundingBox, box2: BoundingBox): number {
    const area1 = (box1.right - box1.left) * (box1.top - box1.bottom);
    const area2 = (box2.right - box2.left) * (box2.top - box2.bottom);
    const intersection = this.calculateIntersection(box1, box2);
    return area1 + area2 - intersection;
  }

  private async resolveZoneGroup(zones: DetectedZone[]): Promise<DetectedZone[]> {
    switch (this.config.strategy) {
      case 'merge':
        return [this.mergeZones(zones)];
      case 'priority_based':
        return [this.selectBestZone(zones)];
      case 'split':
        return this.splitZones(zones);
      default:
        return zones;
    }
  }

  private mergeZones(zones: DetectedZone[]): DetectedZone {
    // Take the zone with highest confidence as base
    const bestZone = zones.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    // Merge bounding boxes
    const mergedBoundingBox = zones.reduce((merged, zone) => ({
      left: Math.min(merged.left, zone.boundingBox.left),
      right: Math.max(merged.right, zone.boundingBox.right),
      top: Math.max(merged.top, zone.boundingBox.top),
      bottom: Math.min(merged.bottom, zone.boundingBox.bottom)
    }), zones[0].boundingBox);

    return {
      ...bestZone,
      id: `merged-${zones.map(z => z.id).join('-')}`,
      boundingBox: mergedBoundingBox,
      coordinates: {
        x: mergedBoundingBox.left,
        y: mergedBoundingBox.bottom,
        width: mergedBoundingBox.right - mergedBoundingBox.left,
        height: mergedBoundingBox.top - mergedBoundingBox.bottom
      },
      confidence: zones.reduce((sum, z) => sum + z.confidence, 0) / zones.length,
      contentType: 'mixed'
    };
  }

  private selectBestZone(zones: DetectedZone[]): DetectedZone {
    return zones.reduce((best, current) => {
      const bestScore = this.calculateZoneScore(best);
      const currentScore = this.calculateZoneScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateZoneScore(zone: DetectedZone): number {
    return zone.confidence * this.config.confidenceWeighting +
           zone.characteristics.textDensity * 0.3 +
           (zone.recommendedTools[0]?.suitabilityScore || 0) * 0.3;
  }

  private splitZones(zones: DetectedZone[]): DetectedZone[] {
    // Simplified splitting - return original zones
    return zones;
  }
}

class PerformanceTracker {
  private startTime: number = 0;
  private metrics: PerformanceMetrics = {
    totalTime: 0,
    textFlowTime: 0,
    gridDetectionTime: 0,
    visualPatternTime: 0,
    mergeTime: 0,
    zonesDetected: 0,
    averageConfidence: 0
  };

  start(): void {
    this.startTime = performance.now();
  }

  getMetrics(): PerformanceMetrics {
    this.metrics.totalTime = performance.now() - this.startTime;
    return { ...this.metrics };
  }

  updateZoneMetrics(zones: DetectedZone[]): void {
    this.metrics.zonesDetected = zones.length;
    this.metrics.averageConfidence = zones.length > 0 
      ? zones.reduce((sum, z) => sum + z.confidence, 0) / zones.length 
      : 0;
  }
}

// Export default instance
export const contentAnalyzer = new ContentAnalyzer(); 