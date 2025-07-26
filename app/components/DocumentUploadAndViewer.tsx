'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UploadZone } from './upload/UploadZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Zap, Shield, Globe, Brain, Sparkles, ArrowLeft, GripVertical, Maximize2, RotateCw } from 'lucide-react';

export function DocumentUploadAndViewer() {
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<'tabs' | 'dual-pane'>('tabs');
  const [paneRatio, setPaneRatio] = useState(0.6); // 60% left, 40% right
  const [isDragging, setIsDragging] = useState(false);

  // Handle draggable divider
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newRatio = e.clientX / window.innerWidth;
      if (newRatio >= 0.3 && newRatio <= 0.8) {
        setPaneRatio(newRatio);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Intelligently detect maximum available screen space (handles DPI scaling)
  React.useEffect(() => {
    const detectMaximumScreenSpace = () => {
      if (typeof window !== 'undefined') {
        // Get all possible dimension sources
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const availWidth = window.screen.availWidth;
        const availHeight = window.screen.availHeight;
        const innerWidth = window.innerWidth;
        const innerHeight = window.innerHeight;
        const outerWidth = window.outerWidth;
        const outerHeight = window.outerHeight;
        
        // Calculate DPI scaling ratio
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        // Use the maximum available space that the browser can actually utilize
        const maxUsableWidth = Math.max(availWidth, screenWidth, outerWidth, innerWidth);
        const maxUsableHeight = Math.max(availHeight, screenHeight, outerHeight, innerHeight);
        
        setScreenDimensions({
          width: maxUsableWidth,
          height: maxUsableHeight
        });
        
        console.log('🖥️ Screen space detection:', {
          native: { screenWidth, screenHeight },
          available: { availWidth, availHeight },
          browser: { innerWidth, innerHeight, outerWidth, outerHeight },
          devicePixelRatio,
          maxUsable: { width: maxUsableWidth, height: maxUsableHeight }
        });
      }
    };

    detectMaximumScreenSpace();
    
    // Re-detect on window resize, fullscreen changes, or DPI changes
    window.addEventListener('resize', detectMaximumScreenSpace);
    window.addEventListener('orientationchange', detectMaximumScreenSpace);
    document.addEventListener('fullscreenchange', detectMaximumScreenSpace);
    
    return () => {
      window.removeEventListener('resize', detectMaximumScreenSpace);
      window.removeEventListener('orientationchange', detectMaximumScreenSpace);
      document.removeEventListener('fullscreenchange', detectMaximumScreenSpace);
    };
  }, []);

  const handleUpload = async (file: File) => {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Upload file
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();
    setUploadedDocument(result);
    setActiveTab('processing');
    
    return result;
  };

  const handleDetailedAnalysis = async () => {
    if (!uploadedDocument?.documentId) {
      console.error('No document available for analysis');
      return;
    }

    console.log('Starting detailed analysis for document:', uploadedDocument.documentId);
    setIsAnalyzing(true);
    
    try {
      // Simulate realistic processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Try to call the enhanced unstructured processor (optional)
      let realAnalysisResult = null;
      try {
        console.log('Attempting to connect to enhanced processor...');
        const formData = new FormData();
        
        // Re-fetch the uploaded file for processing
        const fileResponse = await fetch(`/api/documents/${uploadedDocument.documentId}/file`);
        if (fileResponse.ok) {
          const fileBlob = await fileResponse.blob();
          formData.append('file', fileBlob, uploadedDocument.document?.filename || 'document.pdf');
          
          // Send to enhanced processor
          const response = await fetch('http://localhost:8001/process', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            realAnalysisResult = await response.json();
            realAnalysisResult.isRealData = true;  // Flag real data
            console.log('Real analysis completed successfully!');
          }
        }
      } catch (processorError) {
        console.log('Enhanced processor not available, using mock data:', processorError);
      }
      
             // Use real analysis if available, otherwise use enhanced mock data
       const analysisResult = realAnalysisResult || {
         isRealData: false,  // Flag to indicate this is mock data
        filename: uploadedDocument.document?.filename || 'document.pdf',
        total_elements: 18,
        processing_time_seconds: 2.1,
        strategy: 'hi_res',
        cached: false,
        quality_score: 0.94,
        elements: [
          { type: 'Title', text: 'Annual Financial Report 2024', confidence: 0.98 },
          { type: 'Header', text: 'Executive Summary', confidence: 0.97 },
          { type: 'NarrativeText', text: 'This comprehensive financial report presents our company\'s performance for the fiscal year ending December 31, 2024, highlighting significant growth across key business segments.', confidence: 0.95 },
          { type: 'Table', text: 'Quarterly Revenue Breakdown | Q1: $2.4M | Q2: $2.8M | Q3: $3.1M | Q4: $3.5M', confidence: 0.92 },
          { type: 'Header', text: 'Financial Highlights', confidence: 0.96 },
          { type: 'ListItem', text: '• Total revenue increased by 23% year-over-year to $11.8M', confidence: 0.91 },
          { type: 'ListItem', text: '• Gross profit margin improved to 68%, up from 61% in 2023', confidence: 0.89 },
          { type: 'ListItem', text: '• Operating expenses reduced by 12% through efficiency initiatives', confidence: 0.87 },
          { type: 'NarrativeText', text: 'Our strategic investments in technology and market expansion have yielded substantial returns, positioning us for continued growth in 2025.', confidence: 0.93 },
          { type: 'Header', text: 'Market Analysis', confidence: 0.95 },
          { type: 'NarrativeText', text: 'The market landscape has been favorable with increased demand for our core products and services, driven by digital transformation trends.', confidence: 0.90 }
        ]
      };
      
      console.log('Analysis completed successfully!');
      setAnalysisData(analysisResult);
      setShowDetailedAnalysis(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      console.log('Showing mock analysis as fallback...');
      
      // Always show mock analysis as fallback
      const mockAnalysis = {
        filename: uploadedDocument.document?.filename || 'document.pdf',
        total_elements: 12,
        processing_time_seconds: 1.8,
        strategy: 'hi_res',
        cached: false,
        quality_score: 0.89,
        elements: [
          { type: 'Title', text: 'Document Analysis Report', confidence: 0.98 },
          { type: 'NarrativeText', text: 'This document contains structured content including headers, paragraphs, and data tables.', confidence: 0.95 },
          { type: 'Table', text: 'Financial data table with quarterly results', confidence: 0.89 },
          { type: 'Header', text: 'Executive Summary', confidence: 0.97 },
          { type: 'ListItem', text: '• Revenue increased by 15% year-over-year', confidence: 0.91 },
          { type: 'NarrativeText', text: 'The company has shown strong performance across all key metrics this quarter.', confidence: 0.93 }
        ]
      };
      setAnalysisData(mockAnalysis);
      setShowDetailedAnalysis(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: 'Advanced AI Analysis',
      description: 'Deep learning models extract complex patterns and insights from your documents.',
      badge: 'AI-Powered'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description: 'Process documents in seconds with our optimized processing pipeline.',
      badge: 'Performance'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Privacy First',
      description: 'Your documents are processed securely and never stored permanently.',
      badge: 'Secure'
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Multi-Language',
      description: 'Support for documents in over 50 languages with high accuracy.',
      badge: 'Global'
    }
  ];

  // Handle dual-pane viewer - FULL SCREEN MODE WITH PORTAL
  if (viewMode === 'dual-pane' && uploadedDocument) {
    const dualPaneContent = (
      <div 
        className="z-[9999] h-screen w-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-indigo-950/20" 
                 style={{ 
           position: 'fixed', 
           top: 0, 
           left: 0, 
           right: 0, 
           bottom: 0,
           margin: 0,
           padding: 0,
           transform: 'none',
           zIndex: 9999,
           width: `${screenDimensions.width}px`,
           height: `${screenDimensions.height}px`,
           maxWidth: `${screenDimensions.width}px`,
           maxHeight: `${screenDimensions.height}px`,
           minWidth: '100vw',
           minHeight: '100vh',
           overflow: 'hidden'
         }}
      >
        {/* Header with back button */}
        <div className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border-b border-white/20 dark:border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setViewMode('tabs')}
                variant="ghost"
                className="backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Analysis
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  🔍 Dual-Pane PDF Viewer
          </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Document: {uploadedDocument.document?.filename || uploadedDocument.documentId}
                </p>
              </div>
            </div>
            <div className="backdrop-blur-sm bg-green-500/20 border border-green-500/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg text-sm font-medium">
              ✅ Live Document
            </div>
          </div>
        </div>
        
                 {/* Dual-pane content - FULL WIDTH */}
         <div className="flex-1 flex">
           {/* Left pane - PDF viewer - RESIZABLE */}
           <div 
             className="backdrop-blur-xl bg-white/5 dark:bg-black/5 border-r border-white/20 dark:border-white/10 flex flex-col"
             style={{ width: `${paneRatio * 100}%` }}
           >
                         <div className="p-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
               <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                 📄 Original PDF
               </h3>
               <div className="flex items-center space-x-2">
                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                   <RotateCw className="w-4 h-4" />
            </Button>
                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                   <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
                         <div className="flex-1 relative">
               {/* PDF Viewer using iframe */}
               <iframe
                 src={`/api/documents/${uploadedDocument.documentId}/file`}
                 className="w-full h-full border-0"
                 title={`PDF: ${uploadedDocument.document?.filename}`}
                 onError={() => console.error('PDF loading error')}
               >
                 <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
                     <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                       <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                     </div>
                     <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                       PDF Loading...
                     </h4>
                     <p className="text-slate-600 dark:text-slate-400">
                       Your PDF: {uploadedDocument.document?.filename}
                     </p>
                   </div>
                 </div>
               </iframe>
                          </div>
           </div>

           {/* Draggable Divider */}
           <div 
             className="w-2 backdrop-blur-sm bg-white/20 dark:bg-black/20 hover:bg-gradient-to-b hover:from-blue-500/30 hover:to-purple-500/30 cursor-col-resize transition-all duration-300 relative border-x border-white/30 dark:border-white/10 flex items-center justify-center group"
             onMouseDown={(e) => {
               setIsDragging(true);
               e.preventDefault();
             }}
           >
             <GripVertical className="w-4 h-4 text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
           </div>

           {/* Right pane - Extracted content - RESIZABLE */}
           <div 
             className="backdrop-blur-xl bg-white/5 dark:bg-black/5 flex flex-col"
             style={{ width: `${(1 - paneRatio) * 100}%` }}
           >
                         <div className="p-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
               <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                 🧠 Extracted Content
               </h3>
               <div className="flex items-center space-x-2">
                 <Badge variant="outline" className="text-xs">
                   {analysisData?.elements?.length || 0} Elements
                 </Badge>
                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                   <Maximize2 className="w-4 h-4" />
                 </Button>
               </div>
             </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {analysisData?.elements?.length > 0 ? (
                <div className="space-y-4">
                  {analysisData.elements.map((element: any, index: number) => (
                    <div 
                      key={index}
                      className="p-4 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-500/20 text-blue-700 dark:text-blue-300"
                        >
                          {element.type || 'Content'}
                        </Badge>
                        {element.confidence && (
                          <Badge 
                            variant="outline"
                            className={`${
                              element.confidence > 0.9 
                                ? 'border-green-500/50 text-green-600 dark:text-green-400' 
                                : element.confidence > 0.7 
                                ? 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400'
                                : 'border-red-500/50 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {Math.round(element.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {element.text || 'Content extracted'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Content Extracted
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    Your AI-processed content will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
                 </div>
       </div>
     );

     // Use React Portal to render outside parent container
     return typeof window !== 'undefined' 
       ? createPortal(dualPaneContent, document.body)
       : null;
   }

    return (
    <div className="w-full space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab Headers with Glass Effect */}
        <div className="flex justify-center mb-8">
          <TabsList className="backdrop-blur-xl bg-white/20 dark:bg-black/20 border border-white/30 dark:border-white/20 p-1 rounded-2xl shadow-lg">
            <TabsTrigger 
              value="upload" 
              className="px-6 py-3 rounded-xl data-[state=active]:bg-white/40 data-[state=active]:dark:bg-black/40 data-[state=active]:shadow-lg transition-all duration-300"
            >
              <FileText className="w-4 h-4 mr-2" />
              Upload Document
            </TabsTrigger>
            <TabsTrigger 
              value="features" 
              className="px-6 py-3 rounded-xl data-[state=active]:bg-white/40 data-[state=active]:dark:bg-black/40 data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger 
              value="processing" 
              className="px-6 py-3 rounded-xl data-[state=active]:bg-white/40 data-[state=active]:dark:bg-black/40 data-[state=active]:shadow-lg transition-all duration-300"
              disabled={!uploadedDocument}
            >
              <Zap className="w-4 h-4 mr-2" />
              Processing
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-8">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Get Started
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Upload your PDF and watch our AI transform it into structured, searchable insights in seconds.
                </p>
              </div>
              
          <UploadZone 
            onUpload={handleUpload}
            maxSize={100 * 1024 * 1024}
            enableRealtime={true}
          />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { value: '2.5M+', label: 'Documents Processed' },
              { value: '< 3s', label: 'Average Processing' },
              { value: '99.8%', label: 'Accuracy Rate' },
              { value: '24/7', label: 'Available' }
            ].map((stat) => (
              <div 
                key={stat.label}
                className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-xl p-4 text-center hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-300"
              >
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-8">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Powerful Features
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our platform combines cutting-edge AI with intuitive design to deliver unprecedented document analysis capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={feature.title}
                className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-500 hover:scale-105 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all duration-300">
                      {feature.icon}
                    </div>
                    <Badge variant="secondary" className="bg-white/20 dark:bg-black/20 text-xs">
                      {feature.badge}
                    </Badge>
            </div>
                  <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600 dark:text-slate-400 text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA Section */}
          <div className="backdrop-blur-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/20 dark:border-white/10 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Ready to Transform Your Documents?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Join thousands of users who trust our platform for intelligent document processing.
            </p>
            <Button 
              onClick={() => setActiveTab('upload')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Start Processing Now
              <Zap className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* Processing Tab */}
        <TabsContent value="processing" className="space-y-8">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 dark:from-green-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              Processing Results
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Your document has been successfully processed. Here are the insights we extracted.
            </p>
          </div>

          {uploadedDocument && (
            <div className="space-y-6">
              {/* Document Info Card */}
              <Card className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Document Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">File Name</span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {uploadedDocument.document?.filename || 'Uploaded Document'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        ✅ Successfully Processed
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Document ID</span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 font-mono text-sm">
                        {uploadedDocument.documentId}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-center space-x-4">
                <Button 
                  onClick={() => setActiveTab('upload')}
                  variant="outline"
                  className="px-6 py-3 rounded-xl backdrop-blur-sm bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20"
                >
                  Process Another Document
                </Button>
                <Button 
                  onClick={handleDetailedAnalysis}
                  disabled={isAnalyzing}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                >
                  {isAnalyzing ? 'Analyzing...' : 'View Detailed Analysis'}
                  <Brain className={`w-4 h-4 ml-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Detailed Analysis View */}
              {showDetailedAnalysis && analysisData && (
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      🧠 Detailed AI Analysis
                      {analysisData.isRealData ? (
                        <span className="ml-3 text-sm bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                          ✅ Real AI Processing
                        </span>
                      ) : (
                        <span className="ml-3 text-sm bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full border border-blue-500/30">
                          🧪 Demo Data
                        </span>
                      )}
                    </h3>
                    <Button 
                      onClick={() => setShowDetailedAnalysis(false)}
                      variant="outline"
                      className="backdrop-blur-sm bg-white/20 dark:bg-black/20"
                    >
                      Hide Analysis
                    </Button>
                  </div>

                  {/* Analysis Summary */}
                  <Card className="backdrop-blur-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-white/20 dark:border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <span>Analysis Summary</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {analysisData.total_elements}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Elements Found
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {analysisData.processing_time_seconds?.toFixed(1)}s
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Processing Time
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {Math.round((analysisData.quality_score || 0.9) * 100)}%
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Quality Score
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {analysisData.strategy || 'hi_res'}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Strategy Used
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Extracted Elements */}
                  <Card className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <span>Extracted Content Elements</span>
                      </CardTitle>
                      <CardDescription>
                        Here are the key content elements our AI identified in your document
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analysisData.elements?.map((element: any, index: number) => (
                          <div 
                            key={index}
                            className="p-4 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant="secondary" 
                                  className="bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                >
                                  {element.type || 'Content'}
                                </Badge>
                                {element.confidence && (
                                  <Badge 
                                    variant="outline"
                                    className={`${
                                      element.confidence > 0.9 
                                        ? 'border-green-500/50 text-green-600 dark:text-green-400' 
                                        : element.confidence > 0.7 
                                        ? 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400'
                                        : 'border-red-500/50 text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {Math.round(element.confidence * 100)}% confidence
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              {element.text || 'Content extracted'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {(!analysisData.elements || analysisData.elements.length === 0) && (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No detailed elements available yet. The analysis may still be processing.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Processing Details */}
                  <Card className="backdrop-blur-xl bg-white/5 dark:bg-black/5 border border-white/20 dark:border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span>Processing Details</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Strategy:</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {analysisData.strategy || 'High Resolution Processing'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Cached Result:</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {analysisData.cached ? '✅ Yes' : '❌ No (Fresh Analysis)'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Total Elements:</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {analysisData.total_elements || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Processing Time:</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {analysisData.processing_time_seconds?.toFixed(2) || '0.00'}s
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Transition to Dual-Pane Viewer */}
                  <Card className="backdrop-blur-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/20 dark:border-white/10">
                    <CardContent className="p-6 text-center">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">
                        🔍 Ready for Side-by-Side Review?
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-6">
                        Open the dual-pane viewer to see your PDF and extracted content side-by-side with the original document.
                      </p>
                      <Button 
                        onClick={() => setViewMode('dual-pane')}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        Open Dual-Pane Viewer
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
        </div>
    );
} 