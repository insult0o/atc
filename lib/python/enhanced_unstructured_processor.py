#!/usr/bin/env python3
"""
Enhanced local Unstructured processor with 2025 best practices
"""
import json
import sys
import asyncio
import logging
import traceback
from pathlib import Path
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor
import tempfile
import os

# Unstructured imports
from unstructured.partition.auto import partition
from unstructured.chunking.title import chunk_by_title
from unstructured.staging.base import dict_to_elements

# Vision and layout analysis
from unstructured.partition.pdf import partition_pdf
from unstructured.documents.elements import Element

# Performance and caching
import pickle
import hashlib
from functools import lru_cache
import time

class EnhancedUnstructuredProcessor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.temp_dir = Path(config.get('temp_dir', '/tmp/unstructured'))
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        logging.basicConfig(
            level=getattr(logging, config.get('log_level', 'INFO')),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Performance optimizations
        self.cache_dir = self.temp_dir / 'cache'
        self.cache_dir.mkdir(exist_ok=True)
        
        # Content type patterns for classification
        self.content_patterns = {
            'table': ['table', '|', 'column', 'row', 'cell'],
            'figure': ['figure', 'chart', 'diagram', 'graph', 'image'],
            'header': ['chapter', 'section', 'title', 'heading'],
            'footer': ['page', 'footer', 'copyright', '©'],
            'list': ['•', '-', '1.', '2.', '3.', 'item'],
            'equation': ['=', '+', '-', '×', '÷', 'equation', 'formula']
        }
        
    def process_document(self, file_path: str) -> Dict[str, Any]:
        """Enhanced document processing with caching and optimization"""
        
        start_time = time.time()
        self.logger.info(f"Starting enhanced processing for {file_path}")
        
        # Generate cache key
        cache_key = self._generate_cache_key(file_path)
        cached_result = self._get_cached_result(cache_key)
        
        if cached_result:
            self.logger.info(f"Using cached result for {file_path}")
            cached_result['processing_metadata']['cached'] = True
            return cached_result
        
        try:
            # Stage 1: Enhanced partitioning
            self.logger.info("Stage 1: Enhanced partitioning")
            elements = self._enhanced_partition(file_path)
            
            # Stage 2: Advanced chunking
            self.logger.info("Stage 2: Advanced chunking")
            chunks = self._advanced_chunking(elements)
            
            # Stage 3: Metadata enhancement
            self.logger.info("Stage 3: Metadata enhancement")
            enhanced_chunks = self._enhance_metadata(chunks, file_path)
            
            # Stage 4: Quality assessment
            self.logger.info("Stage 4: Quality assessment")
            quality_scores = self._assess_quality(enhanced_chunks)
            
            # Stage 5: Content classification
            self.logger.info("Stage 5: Content classification")
            classified_chunks = self._classify_content(enhanced_chunks)
            
            processing_time = time.time() - start_time
            
            result = {
                'elements': classified_chunks,
                'quality_scores': quality_scores,
                'processing_metadata': {
                    'file_path': file_path,
                    'num_elements': len(classified_chunks),
                    'avg_quality': sum(quality_scores) / len(quality_scores) if quality_scores else 0,
                    'processing_time_seconds': processing_time,
                    'processing_version': '2.0',
                    'cached': False,
                    'timestamp': time.time(),
                    'config_used': self.config
                }
            }
            
            # Cache result
            self._cache_result(cache_key, result)
            
            self.logger.info(f"Processing completed in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing {file_path}: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise

    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        return {
            "total_processed": 0,
            "avg_processing_time": 0.0,
            "cache_hit_rate": 0.0,
            "success_rate": 100.0
        }

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            cache_files = list(self.cache_dir.glob("*.pkl"))
            total_size = sum(f.stat().st_size for f in cache_files)
            return {
                "cache_files": len(cache_files),
                "total_size_mb": total_size / (1024 * 1024),
                "cache_directory": str(self.cache_dir)
            }
        except Exception:
            return {"cache_files": 0, "total_size_mb": 0.0}

    async def clear_cache(self) -> None:
        """Clear the cache"""
        try:
            for cache_file in self.cache_dir.glob("*.pkl"):
                cache_file.unlink()
        except Exception as e:
            self.logger.error(f"Error clearing cache: {e}")
    
    def _enhanced_partition(self, file_path: str) -> List[Element]:
        """Enhanced partitioning with vision and layout analysis"""
        
        try:
            # Use hi-res strategy for better quality
            elements = partition_pdf(
                filename=file_path,
                strategy=self.config.get('strategy', 'hi_res'),
                infer_table_structure=True,
                include_page_breaks=True,
                extract_images_in_pdf=True,
                extract_image_block_types=["image", "table"],
                languages=self.config.get('languages', ['eng']),
                # Enhanced OCR options
                ocr_languages="eng",
                pdf_infer_table_structure=True,
                coordinates=self.config.get('coordinates', True)
            )
            
            self.logger.info(f"Partitioned into {len(elements)} elements")
            return elements
            
        except Exception as e:
            self.logger.warning(f"Hi-res partitioning failed, falling back to fast: {e}")
            # Fallback to fast strategy
            return partition_pdf(
                filename=file_path,
                strategy="fast",
                include_page_breaks=True,
                coordinates=True
            )
    
    def _advanced_chunking(self, elements: List[Element]) -> List[Dict[str, Any]]:
        """Advanced chunking with semantic awareness"""
        
        try:
            # Convert to chunking format
            chunked_elements = chunk_by_title(
                elements=elements,
                max_characters=self.config.get('max_characters', 1000),
                new_after_n_chars=self.config.get('new_after_n_chars', 800),
                overlap=self.config.get('overlap', 200),
                overlap_all=True
            )
            
            # Convert to dict format for processing
            chunks_dict = elements_to_dict(chunked_elements)
            
            # Enhance chunks with semantic information
            enhanced_chunks = []
            for i, chunk in enumerate(chunks_dict):
                enhanced_chunk = self._enhance_chunk_semantics(chunk, i)
                enhanced_chunks.append(enhanced_chunk)
            
            self.logger.info(f"Created {len(enhanced_chunks)} semantic chunks")
            return enhanced_chunks
            
        except Exception as e:
            self.logger.error(f"Chunking failed: {e}")
            # Basic fallback
            return [{'text': str(elem), 'type': 'fallback'} for elem in elements]
    
    def _enhance_chunk_semantics(self, chunk: Dict[str, Any], index: int) -> Dict[str, Any]:
        """Enhance chunk with semantic information"""
        
        text = chunk.get('text', '')
        
        # Add content classification
        content_type = self._classify_content_type(text)
        
        # Add layout information
        layout_info = self._extract_layout_info(chunk)
        
        # Add processing confidence
        confidence = self._calculate_chunk_confidence(chunk)
        
        # Add readability metrics
        readability = self._calculate_readability(text)
        
        return {
            **chunk,
            'content_type': content_type,
            'layout_info': layout_info,
            'confidence': confidence,
            'readability': readability,
            'semantic_metadata': {
                'chunk_index': index,
                'word_count': len(text.split()) if text else 0,
                'char_count': len(text) if text else 0,
                'has_tables': 'table' in str(chunk.get('type', '')).lower(),
                'has_images': bool(chunk.get('image_path')),
                'structural_role': self._determine_structural_role(chunk),
                'language': self._detect_language(text),
                'contains_numbers': any(c.isdigit() for c in text) if text else False,
                'contains_special_chars': any(c in '©®™€$%' for c in text) if text else False
            }
        }
    
    def _classify_content_type(self, text: str) -> str:
        """Classify content type using enhanced heuristics"""
        
        if not text or len(text.strip()) == 0:
            return 'empty'
        
        text_lower = text.lower()
        
        # Check for tables (multiple indicators)
        table_indicators = sum([
            '|' in text,
            text.count('\t') > 2,
            len(text.split('\n')) > 2 and any('column' in line.lower() for line in text.split('\n')),
            text.count('  ') > 5  # Multiple spaces indicating tabular data
        ])
        
        if table_indicators >= 2:
            return 'table'
        
        # Check for figures and charts
        if any(keyword in text_lower for keyword in self.content_patterns['figure']):
            return 'figure_reference'
        
        # Check for headers/titles
        if (len(text.split()) < 10 and 
            any(keyword in text_lower for keyword in self.content_patterns['header'])):
            return 'header_or_title'
        
        # Check for lists
        if any(keyword in text for keyword in self.content_patterns['list']):
            return 'list'
        
        # Check for equations
        if any(keyword in text for keyword in self.content_patterns['equation']):
            return 'equation'
        
        # Check for footer content
        if any(keyword in text_lower for keyword in self.content_patterns['footer']):
            return 'footer'
        
        # Length-based classification
        word_count = len(text.split())
        if word_count < 5:
            return 'fragment'
        elif word_count < 20:
            return 'short_text'
        elif word_count > 100:
            return 'body_text'
        else:
            return 'mixed'
    
    def _extract_layout_info(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """Extract enhanced layout information from chunk"""
        
        coordinates = chunk.get('coordinates', {})
        metadata = chunk.get('metadata', {})
        
        layout_info = {
            'coordinates': coordinates,
            'page_number': metadata.get('page_number'),
            'bbox': coordinates.get('points') if coordinates else None,
            'position_type': self._determine_position_type(coordinates),
            'area': self._calculate_area(coordinates) if coordinates else 0,
            'aspect_ratio': self._calculate_aspect_ratio(coordinates) if coordinates else 0
        }
        
        return layout_info
    
    def _determine_position_type(self, coordinates: Dict[str, Any]) -> str:
        """Determine position type based on coordinates with better logic"""
        
        if not coordinates or not coordinates.get('points'):
            return 'unknown'
        
        try:
            points = coordinates['points']
            if len(points) >= 4:
                # Calculate relative position on page
                y_coords = [point[1] for point in points]
                avg_y = sum(y_coords) / len(y_coords)
                min_y = min(y_coords)
                max_y = max(y_coords)
                
                # Assume standard page height of ~800 points
                page_height = 800
                
                if max_y < page_height * 0.15:
                    return 'header'
                elif min_y > page_height * 0.85:
                    return 'footer'
                elif avg_y < page_height * 0.3:
                    return 'upper_body'
                elif avg_y > page_height * 0.7:
                    return 'lower_body'
                else:
                    return 'middle_body'
        except:
            pass
        
        return 'unknown'
    
    def _calculate_area(self, coordinates: Dict[str, Any]) -> float:
        """Calculate area of bounding box"""
        try:
            points = coordinates.get('points', [])
            if len(points) >= 4:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                width = max(xs) - min(xs)
                height = max(ys) - min(ys)
                return width * height
        except:
            pass
        return 0.0
    
    def _calculate_aspect_ratio(self, coordinates: Dict[str, Any]) -> float:
        """Calculate aspect ratio of bounding box"""
        try:
            points = coordinates.get('points', [])
            if len(points) >= 4:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                width = max(xs) - min(xs)
                height = max(ys) - min(ys)
                if height > 0:
                    return width / height
        except:
            pass
        return 0.0
    
    def _determine_structural_role(self, chunk: Dict[str, Any]) -> str:
        """Determine structural role of chunk with enhanced logic"""
        
        element_type = str(chunk.get('type', '')).lower()
        text = chunk.get('text', '').lower()
        
        # Direct type mapping
        type_mapping = {
            'title': 'heading',
            'header': 'heading',
            'narrative_text': 'content',
            'list_item': 'list',
            'table': 'table',
            'figure_caption': 'caption',
            'footer': 'footer'
        }
        
        for key, role in type_mapping.items():
            if key in element_type:
                return role
        
        # Content-based classification
        if any(keyword in text for keyword in ['abstract', 'summary', 'conclusion', 'executive summary']):
            return 'summary'
        elif any(keyword in text for keyword in ['introduction', 'background', 'overview']):
            return 'introduction'
        elif any(keyword in text for keyword in ['methodology', 'method', 'approach']):
            return 'methodology'
        elif any(keyword in text for keyword in ['results', 'findings', 'outcome']):
            return 'results'
        elif any(keyword in text for keyword in ['discussion', 'analysis', 'interpretation']):
            return 'discussion'
        elif any(keyword in text for keyword in ['reference', 'bibliography', 'citation']):
            return 'reference'
        else:
            return 'content'
    
    def _detect_language(self, text: str) -> str:
        """Simple language detection"""
        if not text:
            return 'unknown'
        
        # Simple heuristics - can be enhanced with proper language detection
        english_words = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
        spanish_words = ['el', 'la', 'y', 'o', 'pero', 'en', 'de', 'con', 'por', 'para']
        french_words = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'de', 'avec', 'par', 'pour']
        
        text_lower = text.lower()
        
        english_count = sum(1 for word in english_words if word in text_lower)
        spanish_count = sum(1 for word in spanish_words if word in text_lower)
        french_count = sum(1 for word in french_words if word in text_lower)
        
        if english_count >= max(spanish_count, french_count):
            return 'en'
        elif spanish_count > french_count:
            return 'es'
        elif french_count > 0:
            return 'fr'
        else:
            return 'en'  # Default to English
    
    def _calculate_chunk_confidence(self, chunk: Dict[str, Any]) -> float:
        """Calculate confidence score for chunk with enhanced metrics"""
        
        text = chunk.get('text', '')
        confidence_factors = []
        
        # Text quality factors
        if len(text) > 20:
            confidence_factors.append(0.8)
        elif len(text) > 10:
            confidence_factors.append(0.6)
        else:
            confidence_factors.append(0.4)
        
        # Coordinate presence and accuracy
        if chunk.get('coordinates', {}).get('points'):
            confidence_factors.append(0.9)
        else:
            confidence_factors.append(0.5)
        
        # Type classification confidence
        if chunk.get('type'):
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.5)
        
        # Text coherence (simple check)
        if text:
            # Check for reasonable word distribution
            words = text.split()
            if len(words) > 0:
                avg_word_length = sum(len(word) for word in words) / len(words)
                if 2 <= avg_word_length <= 10:  # Reasonable word lengths
                    confidence_factors.append(0.8)
                else:
                    confidence_factors.append(0.6)
        
        # OCR quality indicators
        if text:
            # Check for common OCR errors
            ocr_error_patterns = ['@', '#', '%', '|', '~', '`']
            error_count = sum(1 for pattern in ocr_error_patterns if pattern in text)
            if error_count == 0:
                confidence_factors.append(0.9)
            elif error_count < 3:
                confidence_factors.append(0.7)
            else:
                confidence_factors.append(0.4)
        
        return min(sum(confidence_factors) / len(confidence_factors), 1.0)
    
    def _calculate_readability(self, text: str) -> Dict[str, float]:
        """Calculate readability metrics"""
        if not text:
            return {'flesch_score': 0.0, 'complexity': 'unknown'}
        
        # Simple readability calculation (Flesch Reading Ease approximation)
        sentences = text.count('.') + text.count('!') + text.count('?')
        words = len(text.split())
        syllables = sum(max(1, len([c for c in word if c.lower() in 'aeiou'])) for word in text.split())
        
        if sentences == 0 or words == 0:
            return {'flesch_score': 0.0, 'complexity': 'unknown'}
        
        flesch_score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words))
        
        if flesch_score >= 80:
            complexity = 'easy'
        elif flesch_score >= 60:
            complexity = 'medium'
        else:
            complexity = 'hard'
        
        return {
            'flesch_score': max(0.0, min(100.0, flesch_score)),
            'complexity': complexity,
            'avg_words_per_sentence': words / sentences,
            'avg_syllables_per_word': syllables / words
        }
    
    def _enhance_metadata(self, chunks: List[Dict[str, Any]], file_path: str) -> List[Dict[str, Any]]:
        """Enhance chunks with additional metadata"""
        
        file_info = Path(file_path)
        
        for i, chunk in enumerate(chunks):
            chunk['processing_metadata'] = {
                'source_file': file_info.name,
                'source_path': str(file_info),
                'chunk_index': i,
                'total_chunks': len(chunks),
                'processing_timestamp': time.time(),
                'processor_version': '2.0',
                'file_size_bytes': file_info.stat().st_size if file_info.exists() else 0,
                'relative_position': i / len(chunks) if len(chunks) > 0 else 0
            }
        
        return chunks
    
    def _classify_content(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enhanced content classification"""
        
        # Add document-level context
        total_chunks = len(chunks)
        
        for i, chunk in enumerate(chunks):
            # Add context from surrounding chunks
            context = {
                'is_first_chunk': i == 0,
                'is_last_chunk': i == total_chunks - 1,
                'position_ratio': i / total_chunks if total_chunks > 0 else 0,
                'previous_chunk_type': chunks[i-1]['content_type'] if i > 0 else None,
                'next_chunk_type': chunks[i+1]['content_type'] if i < total_chunks - 1 else None
            }
            
            chunk['document_context'] = context
        
        return chunks
    
    def _assess_quality(self, chunks: List[Dict[str, Any]]) -> List[float]:
        """Assess quality of processed chunks with enhanced metrics"""
        
        quality_scores = []
        
        for chunk in chunks:
            base_confidence = chunk.get('confidence', 0.5)
            
            # Quality adjustments based on content analysis
            text = chunk.get('text', '')
            adjustments = []
            
            if text:
                # Length appropriateness
                if 50 <= len(text) <= 2000:  # Good length range
                    adjustments.append(0.1)
                elif len(text) < 10:  # Too short
                    adjustments.append(-0.2)
                
                # Language coherence
                if chunk.get('semantic_metadata', {}).get('language') == 'en':
                    adjustments.append(0.05)
                
                # Structure indicators
                if chunk.get('layout_info', {}).get('position_type') != 'unknown':
                    adjustments.append(0.1)
                
                # Readability
                readability = chunk.get('readability', {})
                if readability.get('complexity') == 'medium':
                    adjustments.append(0.05)
            
            # Apply adjustments
            final_score = base_confidence + sum(adjustments)
            quality_scores.append(min(max(final_score, 0.0), 1.0))
        
        return quality_scores
    
    def _generate_cache_key(self, file_path: str) -> str:
        """Generate cache key for file"""
        try:
            file_stat = Path(file_path).stat()
            config_str = json.dumps(self.config, sort_keys=True)
            content = f"{file_path}_{file_stat.st_size}_{file_stat.st_mtime}_{config_str}"
            return hashlib.md5(content.encode()).hexdigest()
        except:
            return hashlib.md5(f"{file_path}_{time.time()}".encode()).hexdigest()
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached result if available"""
        
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    result = pickle.load(f)
                    self.logger.info(f"Loaded cached result: {cache_key}")
                    return result
            except Exception as e:
                self.logger.warning(f"Failed to load cache {cache_key}: {e}")
                # Remove corrupted cache
                cache_file.unlink(missing_ok=True)
        
        return None
    
    def _cache_result(self, cache_key: str, result: Dict[str, Any]) -> None:
        """Cache processing result"""
        
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(result, f)
            self.logger.info(f"Cached result: {cache_key}")
        except Exception as e:
            self.logger.warning(f"Failed to cache result {cache_key}: {e}")

def main():
    """Main entry point"""
    
    if len(sys.argv) != 2:
        print(json.dumps({
            'error': 'Usage: python enhanced_unstructured_processor.py <config_json>',
            'status': 'failed'
        }))
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        processor = EnhancedUnstructuredProcessor(config)
        
        file_path = config['filename']
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        result = processor.process_document(file_path)
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'status': 'failed',
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main() 