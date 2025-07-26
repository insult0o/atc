import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

export interface ExtractedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

export interface PageText {
  pageNumber: number;
  items: ExtractedText[];
  viewport: {
    width: number;
    height: number;
  };
}

export interface TextBlock {
  id: string;
  text: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  items: ExtractedText[];
  type: 'paragraph' | 'heading' | 'list' | 'caption';
}

export class FullTextExtractor {
  async extractAllText(pdfDoc: PDFDocumentProxy): Promise<PageText[]> {
    const pageTexts: PageText[] = [];
    
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      const extractedItems: ExtractedText[] = textContent.items.map((item: any) => {
        const textItem = item as TextItem;
        const transform = textItem.transform;
        const x = transform[4];
        const y = viewport.height - transform[5];
        
        return {
          text: textItem.str,
          x,
          y,
          width: textItem.width,
          height: textItem.height,
          fontSize: Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]),
          fontName: textItem.fontName || 'unknown'
        };
      });
      
      pageTexts.push({
        pageNumber: pageNum,
        items: extractedItems,
        viewport: {
          width: viewport.width,
          height: viewport.height
        }
      });
    }
    
    return pageTexts;
  }
  
  detectTextBlocks(items: ExtractedText[]): TextBlock[] {
    // Group text items into logical blocks
    const blocks: TextBlock[] = [];
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    
    let currentBlock: ExtractedText[] = [];
    let lastItem: ExtractedText | null = null;
    let blockId = 0;
    
    for (const item of sorted) {
      if (lastItem && this.shouldStartNewBlock(lastItem, item)) {
        if (currentBlock.length > 0) {
          blocks.push(this.createTextBlock(currentBlock, blockId++));
        }
        currentBlock = [item];
      } else {
        currentBlock.push(item);
      }
      lastItem = item;
    }
    
    if (currentBlock.length > 0) {
      blocks.push(this.createTextBlock(currentBlock, blockId));
    }
    
    return blocks;
  }
  
  private shouldStartNewBlock(prev: ExtractedText, curr: ExtractedText): boolean {
    const lineHeight = prev.height * 1.5;
    const verticalGap = Math.abs(curr.y - prev.y);
    const horizontalGap = curr.x - (prev.x + prev.width);
    
    return verticalGap > lineHeight || horizontalGap > prev.width * 2;
  }
  
  private createTextBlock(items: ExtractedText[], id: number): TextBlock {
    const text = items.map(item => item.text).join(' ');
    const bounds = this.calculateBounds(items);
    const type = this.detectBlockType(items, text);
    
    return {
      id: `block-${id}`,
      text,
      bounds,
      items,
      type
    };
  }
  
  private calculateBounds(items: ExtractedText[]): TextBlock['bounds'] {
    const xs = items.flatMap(item => [item.x, item.x + item.width]);
    const ys = items.flatMap(item => [item.y, item.y + item.height]);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  private detectBlockType(items: ExtractedText[], text: string): TextBlock['type'] {
    const avgFontSize = items.reduce((sum, item) => sum + item.fontSize, 0) / items.length;
    
    // Heading detection
    if (avgFontSize > 16 || (text.length < 100 && avgFontSize > 14)) {
      return 'heading';
    }
    
    // List detection
    if (/^[\d\-\*\•]\s/.test(text)) {
      return 'list';
    }
    
    // Caption detection (small text, usually below images/tables)
    if (avgFontSize < 10 && text.length < 200) {
      return 'caption';
    }
    
    return 'paragraph';
  }
}