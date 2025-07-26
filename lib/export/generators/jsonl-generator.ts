/**
 * Fine-Tuning JSONL Generator
 * Creates high-quality training data in JSONL format for LLM fine-tuning
 */

import {
  FineTuningExample,
  FineTuningMessage,
  FineTuningMetadata,
  JSONLExportOptions,
  ContentType,
  ExportResult,
  ExportError,
  ExportWarning
} from '../schemas';

interface Zone {
  id: string;
  content: string;
  pageNumber: number;
  confidence: number;
  contentType: ContentType;
  tool: string;
  metadata?: Record<string, any>;
}

interface Document {
  id: string;
  name: string;
  pageCount: number;
  zones: Zone[];
}

interface ConversationPair {
  question: string;
  answer: string;
  context?: string;
  metadata: Partial<FineTuningMetadata>;
}

export class JSONLGenerator {
  private options: JSONLExportOptions;
  private qualityScorer: QualityScorer;

  constructor(options: Partial<JSONLExportOptions> = {}) {
    this.options = {
      qualityThreshold: options.qualityThreshold || 0.7,
      maxExamplesPerDocument: options.maxExamplesPerDocument || 100,
      conversationStyle: options.conversationStyle || 'qa',
      systemPrompt: options.systemPrompt || 'You are a helpful assistant that extracts and explains information from documents.',
      includeLowQuality: options.includeLowQuality || false,
      balanceExamples: options.balanceExamples || true
    };

    this.qualityScorer = new QualityScorer();
  }

  /**
   * Generate fine-tuning examples from a document
   */
  async generateExamples(document: Document): Promise<ExportResult> {
    const startTime = Date.now();
    const examples: FineTuningExample[] = [];
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    try {
      // Extract conversation pairs from zones
      const pairs = await this.extractConversationPairs(document);
      
      // Filter by quality
      const qualityPairs = this.filterByQuality(pairs);
      
      if (qualityPairs.length === 0) {
        warnings.push({
          code: 'NO_QUALITY_EXAMPLES',
          message: 'No examples met the quality threshold',
          suggestion: 'Lower quality threshold or improve content extraction'
        });
      }

      // Balance examples if requested
      const balancedPairs = this.options.balanceExamples 
        ? this.balanceExamples(qualityPairs)
        : qualityPairs;

      // Limit examples per document
      const limitedPairs = balancedPairs.slice(0, this.options.maxExamplesPerDocument);
      
      if (balancedPairs.length > limitedPairs.length) {
        warnings.push({
          code: 'EXAMPLES_TRUNCATED',
          message: `Truncated ${balancedPairs.length - limitedPairs.length} examples to meet limit`,
          suggestion: 'Increase maxExamplesPerDocument if needed'
        });
      }

      // Convert to fine-tuning format
      for (const pair of limitedPairs) {
        try {
          const example = this.createFineTuningExample(pair, document);
          examples.push(example);
        } catch (error) {
          errors.push({
            code: 'EXAMPLE_CREATION_ERROR',
            message: 'Failed to create fine-tuning example',
            details: error
          });
        }
      }

      // Validate examples
      const validationResults = this.validateExamples(examples);
      warnings.push(...validationResults.warnings);

      return {
        exportId: `jsonl-${document.id}-${Date.now()}`,
        format: 'jsonl',
        status: errors.length === 0 ? 'success' : 'partial',
        itemCount: examples.length,
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          averageQuality: this.calculateAverageQuality(examples),
          conversationStyle: this.options.conversationStyle,
          documentName: document.name
        }
      };
    } catch (error) {
      return {
        exportId: `jsonl-${document.id}-${Date.now()}`,
        format: 'jsonl',
        status: 'failure',
        errors: [{
          code: 'GENERATION_FAILED',
          message: 'Failed to generate JSONL examples',
          details: error
        }],
        warnings,
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Extract conversation pairs from document zones
   */
  private async extractConversationPairs(document: Document): Promise<ConversationPair[]> {
    const pairs: ConversationPair[] = [];

    // Strategy 1: Extract Q&A from structured content
    const qaPairs = this.extractQAPairs(document.zones);
    pairs.push(...qaPairs);

    // Strategy 2: Generate questions from statements
    const generatedPairs = this.generateQuestionsFromContent(document.zones);
    pairs.push(...generatedPairs);

    // Strategy 3: Extract table/diagram explanations
    const explanationPairs = this.extractExplanationPairs(document.zones);
    pairs.push(...explanationPairs);

    // Strategy 4: Create summarization tasks
    const summaryPairs = this.createSummarizationPairs(document.zones);
    pairs.push(...summaryPairs);

    return pairs;
  }

  /**
   * Extract Q&A pairs from content
   */
  private extractQAPairs(zones: Zone[]): ConversationPair[] {
    const pairs: ConversationPair[] = [];
    
    zones.forEach((zone, index) => {
      // Look for question-answer patterns
      const lines = zone.content.split('\n');
      
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();
        
        // Simple heuristic: lines ending with ? followed by content
        if (line.endsWith('?') && nextLine.length > 20) {
          pairs.push({
            question: line,
            answer: nextLine,
            metadata: {
              pageNumber: zone.pageNumber,
              quality_score: zone.confidence,
              example_type: 'qa',
              complexity: this.assessComplexity(nextLine)
            }
          });
        }
      }
      
      // Look for FAQ-style patterns
      const faqPattern = /^(?:Q:|Question:)\s*(.+?)(?:\n|$)(?:A:|Answer:)\s*(.+?)(?:\n|$)/gmi;
      let match;
      
      while ((match = faqPattern.exec(zone.content)) !== null) {
        pairs.push({
          question: match[1].trim(),
          answer: match[2].trim(),
          metadata: {
            pageNumber: zone.pageNumber,
            quality_score: zone.confidence * 0.9, // Slightly lower for pattern-based
            example_type: 'qa',
            complexity: this.assessComplexity(match[2])
          }
        });
      }
    });
    
    return pairs;
  }

  /**
   * Generate questions from declarative content
   */
  private generateQuestionsFromContent(zones: Zone[]): ConversationPair[] {
    const pairs: ConversationPair[] = [];
    
    zones.forEach(zone => {
      if (zone.contentType !== 'text' || zone.content.length < 50) {
        return;
      }
      
      const sentences = this.splitIntoSentences(zone.content);
      
      sentences.forEach(sentence => {
        // Skip very short sentences
        if (sentence.split(' ').length < 5) return;
        
        // Generate different types of questions
        const questionTypes = [
          { prefix: 'What does the document say about', type: 'factual' },
          { prefix: 'Explain', type: 'explanation' },
          { prefix: 'What is the significance of', type: 'analysis' },
          { prefix: 'Summarize the information about', type: 'summary' }
        ];
        
        // Extract key subject from sentence
        const subject = this.extractKeySubject(sentence);
        if (!subject) return;
        
        // Create one question per sentence (randomly selected type)
        const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
        
        pairs.push({
          question: `${questionType.prefix} ${subject}?`,
          answer: sentence,
          context: zone.content.substring(0, 200) + '...',
          metadata: {
            pageNumber: zone.pageNumber,
            quality_score: zone.confidence * 0.8,
            example_type: 'instruction',
            complexity: this.assessComplexity(sentence),
            domain: this.detectDomain(zone.content)
          }
        });
      });
    });
    
    return pairs;
  }

  /**
   * Extract explanation pairs for tables and diagrams
   */
  private extractExplanationPairs(zones: Zone[]): ConversationPair[] {
    const pairs: ConversationPair[] = [];
    
    zones.forEach(zone => {
      if (zone.contentType === 'table' || zone.contentType === 'diagram') {
        // Create explanation request
        const questionTemplates = [
          'Explain the data shown in this table',
          'What information does this table present?',
          'Summarize the key findings from this table',
          'What patterns can be observed in this data?'
        ];
        
        const question = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
        
        pairs.push({
          question: question,
          answer: this.generateTableExplanation(zone.content),
          context: `This is a ${zone.contentType} from page ${zone.pageNumber}`,
          metadata: {
            pageNumber: zone.pageNumber,
            quality_score: zone.confidence,
            example_type: 'extraction',
            complexity: 'complex',
            domain: this.detectDomain(zone.content)
          }
        });
      }
    });
    
    return pairs;
  }

  /**
   * Create summarization training pairs
   */
  private createSummarizationPairs(zones: Zone[]): ConversationPair[] {
    const pairs: ConversationPair[] = [];
    
    // Group zones by page for page-level summaries
    const zonesByPage = new Map<number, Zone[]>();
    zones.forEach(zone => {
      const pageZones = zonesByPage.get(zone.pageNumber) || [];
      pageZones.push(zone);
      zonesByPage.set(zone.pageNumber, pageZones);
    });
    
    // Create summaries for pages with sufficient content
    zonesByPage.forEach((pageZones, pageNumber) => {
      const combinedContent = pageZones
        .filter(z => z.contentType === 'text')
        .map(z => z.content)
        .join('\n');
      
      if (combinedContent.length > 200) {
        pairs.push({
          question: `Summarize the main points from page ${pageNumber}`,
          answer: this.generateSummary(combinedContent),
          context: combinedContent.substring(0, 500) + '...',
          metadata: {
            pageNumber: pageNumber,
            quality_score: this.calculateAverageConfidence(pageZones),
            example_type: 'instruction',
            complexity: 'moderate',
            domain: this.detectDomain(combinedContent)
          }
        });
      }
    });
    
    return pairs;
  }

  /**
   * Filter pairs by quality score
   */
  private filterByQuality(pairs: ConversationPair[]): ConversationPair[] {
    const filtered = pairs.filter(pair => {
      const score = pair.metadata.quality_score || 0;
      return this.options.includeLowQuality || score >= this.options.qualityThreshold;
    });
    
    // Sort by quality score descending
    return filtered.sort((a, b) => 
      (b.metadata.quality_score || 0) - (a.metadata.quality_score || 0)
    );
  }

  /**
   * Balance examples across different types
   */
  private balanceExamples(pairs: ConversationPair[]): ConversationPair[] {
    // Group by example type
    const grouped = new Map<string, ConversationPair[]>();
    
    pairs.forEach(pair => {
      const type = pair.metadata.example_type || 'qa';
      const typePairs = grouped.get(type) || [];
      typePairs.push(pair);
      grouped.set(type, typePairs);
    });
    
    // Calculate target count per type
    const totalTarget = Math.min(pairs.length, this.options.maxExamplesPerDocument);
    const targetPerType = Math.floor(totalTarget / grouped.size);
    
    // Select balanced examples
    const balanced: ConversationPair[] = [];
    
    grouped.forEach((typePairs, type) => {
      const selected = typePairs.slice(0, targetPerType);
      balanced.push(...selected);
    });
    
    // Fill remaining slots with highest quality examples
    const remaining = totalTarget - balanced.length;
    if (remaining > 0) {
      const unused = pairs.filter(p => !balanced.includes(p));
      balanced.push(...unused.slice(0, remaining));
    }
    
    return balanced;
  }

  /**
   * Create a fine-tuning example from a conversation pair
   */
  private createFineTuningExample(pair: ConversationPair, document: Document): FineTuningExample {
    const messages: FineTuningMessage[] = [];
    
    // Add system message
    messages.push({
      role: 'system',
      content: this.options.systemPrompt
    });
    
    // Add conversation based on style
    switch (this.options.conversationStyle) {
      case 'qa':
        messages.push({
          role: 'user',
          content: pair.question
        });
        messages.push({
          role: 'assistant',
          content: pair.answer
        });
        break;
        
      case 'instruction':
        messages.push({
          role: 'user',
          content: `${pair.question}\n\nContext: ${pair.context || 'From document analysis'}`
        });
        messages.push({
          role: 'assistant',
          content: pair.answer
        });
        break;
        
      case 'chat':
        // Add context as first user message if available
        if (pair.context) {
          messages.push({
            role: 'user',
            content: `I have a document that contains the following information: ${pair.context}`
          });
          messages.push({
            role: 'assistant',
            content: 'I understand. What would you like to know about this information?'
          });
        }
        messages.push({
          role: 'user',
          content: pair.question
        });
        messages.push({
          role: 'assistant',
          content: pair.answer
        });
        break;
    }
    
    // Calculate token count
    const tokenCount = messages.reduce((sum, msg) => 
      sum + this.estimateTokens(msg.content), 0
    );
    
    // Create metadata
    const metadata: FineTuningMetadata = {
      source: document.name,
      documentId: document.id,
      quality_score: pair.metadata.quality_score || 0.8,
      example_type: pair.metadata.example_type || this.options.conversationStyle,
      ...(pair.metadata.pageNumber && { pageNumber: pair.metadata.pageNumber }),
      ...(pair.metadata.domain && { domain: pair.metadata.domain }),
      ...(pair.metadata.complexity && { complexity: pair.metadata.complexity }),
      tokens: tokenCount
    };
    
    return { messages, metadata };
  }

  /**
   * Validate generated examples
   */
  private validateExamples(examples: FineTuningExample[]): { warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];
    
    examples.forEach((example, index) => {
      // Check message count
      if (example.messages.length < 2) {
        warnings.push({
          code: 'INSUFFICIENT_MESSAGES',
          message: `Example ${index} has too few messages`,
          item: `example-${index}`
        });
      }
      
      // Check token count
      if (example.metadata.tokens && example.metadata.tokens > 4096) {
        warnings.push({
          code: 'HIGH_TOKEN_COUNT',
          message: `Example ${index} exceeds typical token limit`,
          item: `example-${index}`,
          suggestion: 'Consider splitting into smaller examples'
        });
      }
      
      // Check conversation balance
      const userCount = example.messages.filter(m => m.role === 'user').length;
      const assistantCount = example.messages.filter(m => m.role === 'assistant').length;
      
      if (Math.abs(userCount - assistantCount) > 1) {
        warnings.push({
          code: 'UNBALANCED_CONVERSATION',
          message: `Example ${index} has unbalanced conversation flow`,
          item: `example-${index}`
        });
      }
    });
    
    return { warnings };
  }

  /**
   * Helper methods
   */
  
  private splitIntoSentences(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 20);
  }
  
  private extractKeySubject(sentence: string): string | null {
    // Simple noun phrase extraction
    const words = sentence.split(' ');
    if (words.length < 3) return null;
    
    // Look for capitalized phrases (likely subjects)
    const capitalizedPhrases = sentence.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (capitalizedPhrases && capitalizedPhrases.length > 0) {
      return capitalizedPhrases[0];
    }
    
    // Fallback to first few words
    return words.slice(0, 3).join(' ');
  }
  
  private assessComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = text.split(' ').length;
    const avgWordLength = text.length / wordCount;
    
    if (wordCount < 20 && avgWordLength < 5) return 'simple';
    if (wordCount > 50 || avgWordLength > 7) return 'complex';
    return 'moderate';
  }
  
  private detectDomain(text: string): string | undefined {
    const domains = {
      'financial': /\b(revenue|profit|loss|earnings|investment|market|stock|bond)\b/i,
      'technical': /\b(software|algorithm|system|database|network|protocol|api)\b/i,
      'medical': /\b(patient|treatment|diagnosis|therapy|medication|clinical|disease)\b/i,
      'legal': /\b(contract|agreement|liability|jurisdiction|compliance|regulation)\b/i,
      'scientific': /\b(experiment|hypothesis|research|data|analysis|study|findings)\b/i
    };
    
    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(text)) {
        return domain;
      }
    }
    
    return undefined;
  }
  
  private generateTableExplanation(tableContent: string): string {
    // Simple table explanation generator
    const lines = tableContent.split('\n');
    const headers = lines[0]?.split('|').map(h => h.trim()).filter(h => h);
    const rowCount = lines.length - 1;
    
    return `This table contains ${rowCount} rows of data with the following columns: ${headers?.join(', ')}. The data appears to show ${this.inferTablePurpose(tableContent)}.`;
  }
  
  private inferTablePurpose(tableContent: string): string {
    if (/\d{4}/.test(tableContent) && /\$|\€|£/.test(tableContent)) {
      return 'financial information over time';
    }
    if (/percentage|%/.test(tableContent)) {
      return 'statistical or comparative data';
    }
    return 'structured information';
  }
  
  private generateSummary(content: string): string {
    // Simple extractive summary
    const sentences = this.splitIntoSentences(content);
    const importantSentences = sentences
      .filter(s => s.length > 30)
      .slice(0, 3);
    
    return importantSentences.join(' ');
  }
  
  private calculateAverageConfidence(zones: Zone[]): number {
    if (zones.length === 0) return 0;
    const sum = zones.reduce((total, zone) => total + zone.confidence, 0);
    return sum / zones.length;
  }
  
  private calculateAverageQuality(examples: FineTuningExample[]): number {
    if (examples.length === 0) return 0;
    const sum = examples.reduce((total, ex) => total + ex.metadata.quality_score, 0);
    return sum / examples.length;
  }
  
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Export examples to JSONL file
   */
  async exportToFile(examples: FineTuningExample[], filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const lines = examples.map(example => JSON.stringify(example));
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }
}

/**
 * Quality scoring utility
 */
class QualityScorer {
  scoreExample(example: FineTuningExample): number {
    let score = 0;
    const weights = {
      length: 0.2,
      balance: 0.2,
      clarity: 0.3,
      metadata: 0.3
    };
    
    // Length score
    const totalLength = example.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalLength > 100 && totalLength < 2000) score += weights.length;
    
    // Balance score
    const userMessages = example.messages.filter(m => m.role === 'user').length;
    const assistantMessages = example.messages.filter(m => m.role === 'assistant').length;
    if (userMessages === assistantMessages) score += weights.balance;
    
    // Clarity score (basic heuristic)
    const hasQuestion = example.messages.some(m => m.content.includes('?'));
    const hasAnswer = example.messages.some(m => m.role === 'assistant' && m.content.length > 20);
    if (hasQuestion && hasAnswer) score += weights.clarity;
    
    // Metadata completeness
    const metadataScore = Object.keys(example.metadata).length / 8; // 8 possible fields
    score += weights.metadata * metadataScore;
    
    return Math.min(score, 1);
  }
}