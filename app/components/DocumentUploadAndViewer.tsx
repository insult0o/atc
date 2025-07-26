'use client';

import React, { useState } from 'react';
import { UploadZone } from './upload/UploadZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Zap, Shield, Globe, Brain, Sparkles } from 'lucide-react';

export function DocumentUploadAndViewer() {
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('upload');

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
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  View Detailed Analysis
                  <Brain className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 