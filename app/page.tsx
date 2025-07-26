'use client';

import { DocumentUploadAndViewer } from './components/DocumentUploadAndViewer'
import { StatusIndicator } from './components/StatusIndicator'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr from-indigo-400/20 to-cyan-600/20 blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-r from-violet-400/10 to-pink-600/10 blur-2xl animate-pulse" />
      </div>

      {/* Glass Navigation Header */}
      <header className="relative z-10 p-6">
        <nav className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">📄</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                PDF Intelligence Platform
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-6 py-2 rounded-xl bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20 backdrop-blur-sm hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 text-slate-700 dark:text-slate-300 font-medium">
                Features
              </button>
              <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105">
                Get Started
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section with Liquid Glass Design */}
      <main className="relative z-10 container mx-auto px-6 py-12">
        <div className="text-center mb-16 space-y-8">
          {/* Main Headline with Advanced Typography */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="block bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent animate-pulse">
                Intelligence
              </span>
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Meets Documents
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Transform your PDFs with cutting-edge AI. Extract insights, analyze content, and unlock intelligence from any document with our revolutionary platform.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              '🤖 AI-Powered Analysis',
              '⚡ Real-time Processing', 
              '🔒 Privacy-First',
              '📊 Advanced Insights',
              '🌐 Multi-format Support'
            ].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-sm border border-white/30 dark:border-white/20 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 cursor-default"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Main Upload Section with Glass Morphism */}
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-2xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl shadow-black/10 p-8 md:p-12">
            <DocumentUploadAndViewer />
          </div>
        </div>

        {/* Features Grid with Advanced Cards */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: '🧠',
              title: 'AI-Powered Extraction',
              description: 'Advanced machine learning algorithms extract meaningful insights from complex documents.'
            },
            {
              icon: '🎯', 
              title: 'Smart Zone Detection',
              description: 'Intelligent content area identification with pixel-perfect accuracy and confidence scoring.'
            },
            {
              icon: '📈',
              title: 'Real-time Analytics',
              description: 'Live processing feedback with comprehensive quality metrics and performance insights.'
            }
          ].map((feature, index) => (
            <div
              key={feature.title}
              className="group backdrop-blur-xl bg-white/5 dark:bg-black/5 border border-white/20 dark:border-white/10 rounded-2xl p-6 hover:bg-white/10 dark:hover:bg-white/5 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Section with Liquid Glass Effect */}
        <div className="mt-24">
          <div className="backdrop-blur-2xl bg-gradient-to-r from-white/10 via-white/5 to-white/10 dark:from-black/10 dark:via-black/5 dark:to-black/10 border border-white/20 dark:border-white/10 rounded-3xl p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '99.9%', label: 'Accuracy Rate' },
                { value: '< 2s', label: 'Processing Time' },
                { value: '50M+', label: 'Documents Processed' },
                { value: '24/7', label: 'Uptime' }
              ].map((stat) => (
                <div key={stat.label} className="space-y-2">
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer with Glass Effect */}
      <footer className="relative z-10 mt-24 p-6">
        <div className="backdrop-blur-xl bg-white/5 dark:bg-black/5 border border-white/20 dark:border-white/10 rounded-2xl p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            © 2025 PDF Intelligence Platform. Powered by cutting-edge AI and modern design.
          </p>
        </div>
             </footer>

       {/* Status Indicator */}
       <StatusIndicator isConnected={true} status="System Ready" />
    </div>
  )
} 