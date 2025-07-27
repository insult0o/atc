import {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  Suite,
} from '@playwright/test/reporter';
import fs from 'fs-extra';
import path from 'path';

interface WorkflowMetrics {
  workflow: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  averageDuration: number;
  errors: any[];
  coverage: {
    features: string[];
    testedFeatures: string[];
    percentage: number;
  };
}

interface TestMetrics {
  name: string;
  workflow: string;
  duration: number;
  status: string;
  errors: any[];
  retries: number;
  steps: string[];
}

class WorkflowReporter implements Reporter {
  private metrics: Map<string, WorkflowMetrics> = new Map();
  private testResults: TestMetrics[] = [];
  private startTime: number = Date.now();
  private outputPath: string = 'test-results/workflow-report.json';

  onBegin(config: any, suite: Suite) {
    console.log(`\n🧪 Starting PDF Platform E2E Tests`);
    console.log(`📋 Total test files: ${suite.allTests().length}`);
    console.log(`🔧 Workers: ${config.workers}`);
    console.log(`⏱️  Timeout: ${config.use?.navigationTimeout}ms\n`);
  }

  onTestBegin(test: TestCase) {
    const workflow = this.getWorkflowName(test);
    console.log(`▶️  ${workflow} | ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const workflow = this.getWorkflowName(test);
    const status = result.status;
    const duration = result.duration;

    // Update workflow metrics
    if (!this.metrics.has(workflow)) {
      this.metrics.set(workflow, {
        workflow,
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        averageDuration: 0,
        errors: [],
        coverage: {
          features: [],
          testedFeatures: [],
          percentage: 0,
        },
      });
    }

    const workflowMetrics = this.metrics.get(workflow)!;
    workflowMetrics.totalTests++;
    workflowMetrics.duration += duration;

    switch (status) {
      case 'passed':
        workflowMetrics.passed++;
        console.log(`✅ ${test.title} (${duration}ms)`);
        break;
      case 'failed':
        workflowMetrics.failed++;
        workflowMetrics.errors.push(...result.errors);
        console.log(`❌ ${test.title} (${duration}ms)`);
        result.errors.forEach(error => {
          console.log(`   ${error.message}`);
        });
        break;
      case 'skipped':
        workflowMetrics.skipped++;
        console.log(`⏭️  ${test.title} (skipped)`);
        break;
    }

    // Track test metrics
    this.testResults.push({
      name: test.title,
      workflow,
      duration,
      status,
      errors: result.errors,
      retries: result.retry,
      steps: this.extractSteps(test),
    });
  }

  async onEnd(result: FullResult) {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));

    // Calculate totals
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Print workflow summaries
    this.metrics.forEach((metrics, workflow) => {
      metrics.averageDuration = metrics.duration / metrics.totalTests;
      
      console.log(`\n📁 ${workflow}`);
      console.log(`   Total: ${metrics.totalTests}`);
      console.log(`   ✅ Passed: ${metrics.passed}`);
      console.log(`   ❌ Failed: ${metrics.failed}`);
      console.log(`   ⏭️  Skipped: ${metrics.skipped}`);
      console.log(`   ⏱️  Average duration: ${Math.round(metrics.averageDuration)}ms`);
      
      totalTests += metrics.totalTests;
      totalPassed += metrics.passed;
      totalFailed += metrics.failed;
      totalSkipped += metrics.skipped;
    });

    // Overall summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 OVERALL');
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${totalPassed} (${this.getPercentage(totalPassed, totalTests)}%)`);
    console.log(`   ❌ Failed: ${totalFailed} (${this.getPercentage(totalFailed, totalTests)}%)`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ⏱️  Total duration: ${this.formatDuration(totalDuration)}`);
    console.log(`   📊 Success rate: ${this.getPercentage(totalPassed, totalTests - totalSkipped)}%`);

    // Feature coverage
    console.log('\n📈 FEATURE COVERAGE');
    const coverage = this.calculateFeatureCoverage();
    console.log(`   Features tested: ${coverage.tested}/${coverage.total} (${coverage.percentage}%)`);
    console.log(`   Missing coverage: ${coverage.missing.join(', ') || 'None'}`);

    // Performance insights
    console.log('\n⚡ PERFORMANCE INSIGHTS');
    const slowTests = this.testResults
      .filter(t => t.duration > 30000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    if (slowTests.length > 0) {
      console.log('   Slowest tests:');
      slowTests.forEach(test => {
        console.log(`   - ${test.name}: ${this.formatDuration(test.duration)}`);
      });
    }

    // Error summary
    if (totalFailed > 0) {
      console.log('\n❌ ERROR SUMMARY');
      const errorTypes = this.categorizeErrors();
      errorTypes.forEach((count, type) => {
        console.log(`   ${type}: ${count} occurrences`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    this.generateRecommendations();

    // Save detailed report
    await this.saveDetailedReport();
    
    console.log('\n📄 Detailed report saved to:', this.outputPath);
    console.log('='.repeat(80));
  }

  private getWorkflowName(test: TestCase): string {
    const filePath = test.location.file;
    
    if (filePath.includes('quick-extract')) return 'Quick Extract';
    if (filePath.includes('detailed-review')) return 'Detailed Review';
    if (filePath.includes('collaborative')) return 'Collaborative';
    if (filePath.includes('batch-processing')) return 'Batch Processing';
    if (filePath.includes('api-integration')) return 'API Integration';
    if (filePath.includes('visual')) return 'Visual Regression';
    
    return 'Other';
  }

  private extractSteps(test: TestCase): string[] {
    // Extract test steps from annotations or test structure
    return test.annotations.map(a => a.type).filter(Boolean);
  }

  private getPercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private calculateFeatureCoverage() {
    const allFeatures = [
      'Upload', 'Processing', 'Zone Detection', 'Zone Selection',
      'Content Editing', 'Zone Merging', 'Zone Splitting', 'Export RAG',
      'Export JSONL', 'Export Validation', 'Collaborative Editing',
      'Real-time Sync', 'Batch Processing', 'API Integration',
      'Visual Regression', 'Error Handling', 'Performance',
    ];

    const testedFeatures = new Set<string>();
    
    this.testResults.forEach(test => {
      if (test.name.toLowerCase().includes('upload')) testedFeatures.add('Upload');
      if (test.name.toLowerCase().includes('process')) testedFeatures.add('Processing');
      if (test.name.toLowerCase().includes('zone')) testedFeatures.add('Zone Detection');
      if (test.name.toLowerCase().includes('select')) testedFeatures.add('Zone Selection');
      if (test.name.toLowerCase().includes('edit')) testedFeatures.add('Content Editing');
      if (test.name.toLowerCase().includes('merge')) testedFeatures.add('Zone Merging');
      if (test.name.toLowerCase().includes('split')) testedFeatures.add('Zone Splitting');
      if (test.name.toLowerCase().includes('rag')) testedFeatures.add('Export RAG');
      if (test.name.toLowerCase().includes('jsonl')) testedFeatures.add('Export JSONL');
      if (test.name.toLowerCase().includes('validat')) testedFeatures.add('Export Validation');
      if (test.name.toLowerCase().includes('collab')) testedFeatures.add('Collaborative Editing');
      if (test.name.toLowerCase().includes('sync')) testedFeatures.add('Real-time Sync');
      if (test.name.toLowerCase().includes('batch')) testedFeatures.add('Batch Processing');
      if (test.name.toLowerCase().includes('api')) testedFeatures.add('API Integration');
      if (test.name.toLowerCase().includes('visual')) testedFeatures.add('Visual Regression');
      if (test.name.toLowerCase().includes('error')) testedFeatures.add('Error Handling');
    });

    const missing = allFeatures.filter(f => !testedFeatures.has(f));

    return {
      total: allFeatures.length,
      tested: testedFeatures.size,
      percentage: this.getPercentage(testedFeatures.size, allFeatures.length),
      missing,
    };
  }

  private categorizeErrors(): Map<string, number> {
    const errorTypes = new Map<string, number>();
    
    this.testResults.forEach(test => {
      test.errors.forEach(error => {
        const type = this.getErrorType(error);
        errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
      });
    });

    return errorTypes;
  }

  private getErrorType(error: any): string {
    const message = error.message || '';
    
    if (message.includes('timeout')) return 'Timeout';
    if (message.includes('not found')) return 'Element Not Found';
    if (message.includes('network')) return 'Network Error';
    if (message.includes('assertion')) return 'Assertion Failed';
    
    return 'Other';
  }

  private generateRecommendations() {
    const recommendations: string[] = [];

    // Check for flaky tests
    const flakyTests = this.testResults.filter(t => t.retries > 0);
    if (flakyTests.length > 0) {
      recommendations.push(`🔄 ${flakyTests.length} tests required retries - investigate flakiness`);
    }

    // Check for slow tests
    const slowTests = this.testResults.filter(t => t.duration > 30000);
    if (slowTests.length > 0) {
      recommendations.push(`🐌 ${slowTests.length} tests are slow (>30s) - consider optimization`);
    }

    // Check coverage
    const coverage = this.calculateFeatureCoverage();
    if (coverage.percentage < 80) {
      recommendations.push(`📊 Feature coverage is ${coverage.percentage}% - add tests for: ${coverage.missing.slice(0, 3).join(', ')}`);
    }

    // Check error rate
    const totalTests = this.testResults.length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    const errorRate = this.getPercentage(failedTests, totalTests);
    
    if (errorRate > 10) {
      recommendations.push(`⚠️  High failure rate (${errorRate}%) - investigate stability issues`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ Test suite is healthy!');
    }

    recommendations.forEach(rec => console.log(`   ${rec}`));
  }

  private async saveDetailedReport() {
    const report = {
      summary: {
        startTime: new Date(this.startTime).toISOString(),
        duration: Date.now() - this.startTime,
        totalTests: this.testResults.length,
        passed: this.testResults.filter(t => t.status === 'passed').length,
        failed: this.testResults.filter(t => t.status === 'failed').length,
        skipped: this.testResults.filter(t => t.status === 'skipped').length,
      },
      workflows: Array.from(this.metrics.values()),
      tests: this.testResults,
      coverage: this.calculateFeatureCoverage(),
      errors: this.categorizeErrors(),
      performance: {
        slowestTests: this.testResults
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10),
        averageDuration: this.testResults.reduce((sum, t) => sum + t.duration, 0) / this.testResults.length,
      },
    };

    await fs.ensureDir(path.dirname(this.outputPath));
    await fs.writeJson(this.outputPath, report, { spaces: 2 });
  }
}

export default WorkflowReporter;