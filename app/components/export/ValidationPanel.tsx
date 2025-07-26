// Task 8: Validation UI Components
// Displays validation status, errors, and reports

'use client'

import React, { useState, useEffect } from 'react'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline'
import { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  BlockingIssue,
  ValidationReport 
} from '@/lib/export/validation/validation-orchestrator'

interface ValidationPanelProps {
  validationResult?: ValidationResult
  onOverrideRequest?: (blockers: BlockingIssue[]) => void
  onRevalidate?: () => void
  isValidating?: boolean
  className?: string
}

export function ValidationPanel({
  validationResult,
  onOverrideRequest,
  onRevalidate,
  isValidating = false,
  className = ''
}: ValidationPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']))
  const [selectedTab, setSelectedTab] = useState<'errors' | 'warnings' | 'report'>('errors')
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'error' | 'warning'>('all')

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  if (isValidating) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Validating export...</span>
        </div>
      </div>
    )
  }

  if (!validationResult) {
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <ShieldCheckIcon className="h-12 w-12 mx-auto mb-3" />
          <p>No validation results available</p>
        </div>
      </div>
    )
  }

  const { valid, score, errors, warnings, blockers, report } = validationResult
  const hasBlockers = blockers.length > 0
  const canOverride = hasBlockers && blockers.some(b => b.canOverride)

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {valid ? (
              <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
            ) : (
              <XCircleIcon className="h-6 w-6 text-red-500 mr-2" />
            )}
            <h3 className="text-lg font-medium">
              Validation {valid ? 'Passed' : 'Failed'}
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="text-gray-500">Score:</span>
              <span className={`ml-1 font-medium ${
                score >= 80 ? 'text-green-600' : 
                score >= 60 ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {score}%
              </span>
            </div>
            {onRevalidate && (
              <button
                onClick={onRevalidate}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
              >
                Revalidate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="border-b">
        <button
          onClick={() => toggleSection('summary')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-medium">Summary</span>
          {expandedSections.has('summary') ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('summary') && report && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-gray-900">
                  {report.summary.totalItems}
                </div>
                <div className="text-sm text-gray-500">Total Items</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-green-600">
                  {report.summary.validItems}
                </div>
                <div className="text-sm text-gray-500">Valid Items</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-red-600">
                  {errors.length}
                </div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-yellow-600">
                  {warnings.length}
                </div>
                <div className="text-sm text-gray-500">Warnings</div>
              </div>
            </div>

            {/* Blocking Issues */}
            {hasBlockers && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <div className="flex items-start">
                  <ShieldExclamationIcon className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-red-800">
                      Export Blocked
                    </h4>
                    <div className="mt-2 text-sm text-red-700">
                      {blockers.map((blocker, index) => (
                        <div key={index} className="mb-2">
                          <div className="font-medium">{blocker.reason}</div>
                          {blocker.affectedItems.length > 0 && (
                            <div className="text-xs mt-1">
                              Affected: {blocker.affectedItems.slice(0, 3).join(', ')}
                              {blocker.affectedItems.length > 3 && ` +${blocker.affectedItems.length - 3} more`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {canOverride && onOverrideRequest && (
                      <button
                        onClick={() => onOverrideRequest(blockers.filter(b => b.canOverride))}
                        className="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        Request Override
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => setSelectedTab('errors')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              selectedTab === 'errors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Errors ({errors.length})
          </button>
          <button
            onClick={() => setSelectedTab('warnings')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              selectedTab === 'warnings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Warnings ({warnings.length})
          </button>
          <button
            onClick={() => setSelectedTab('report')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              selectedTab === 'report'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Detailed Report
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {selectedTab === 'errors' && (
          <ErrorsList 
            errors={errors} 
            filterSeverity={filterSeverity}
            onFilterChange={setFilterSeverity}
          />
        )}
        
        {selectedTab === 'warnings' && (
          <WarningsList warnings={warnings} />
        )}
        
        {selectedTab === 'report' && report && (
          <DetailedReport report={report} />
        )}
      </div>
    </div>
  )
}

function ErrorsList({ 
  errors, 
  filterSeverity,
  onFilterChange 
}: { 
  errors: ValidationError[]
  filterSeverity: string
  onFilterChange: (severity: any) => void
}) {
  const filteredErrors = filterSeverity === 'all' 
    ? errors 
    : errors.filter(e => e.severity === filterSeverity)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <select
          value={filterSeverity}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="error">Errors Only</option>
        </select>
        <span className="text-sm text-gray-500">
          Showing {filteredErrors.length} of {errors.length} errors
        </span>
      </div>

      <div className="space-y-3">
        {filteredErrors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No errors found
          </div>
        ) : (
          filteredErrors.map((error, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                error.severity === 'critical' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-start">
                <XCircleIcon className={`h-5 w-5 mt-0.5 ${
                  error.severity === 'critical' ? 'text-red-600' : 'text-orange-600'
                }`} />
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      error.severity === 'critical' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {error.severity.toUpperCase()}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">
                      {error.code}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900">{error.message}</p>
                  {error.location && (
                    <p className="mt-1 text-xs text-gray-500">
                      Location: {error.location}
                    </p>
                  )}
                  {error.suggestion && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      <strong>Suggestion:</strong> {error.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function WarningsList({ warnings }: { warnings: ValidationWarning[] }) {
  return (
    <div className="space-y-3">
      {warnings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No warnings found
        </div>
      ) : (
        warnings.map((warning, index) => (
          <div key={index} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">{warning.code}</span>
                </div>
                <p className="mt-1 text-sm text-gray-900">{warning.message}</p>
                {warning.location && (
                  <p className="mt-1 text-xs text-gray-500">
                    Location: {warning.location}
                  </p>
                )}
                {warning.suggestion && (
                  <p className="mt-1 text-xs text-blue-600">
                    {warning.suggestion}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DetailedReport({ report }: { report: ValidationReport }) {
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())

  const toggleDetail = (detail: string) => {
    setExpandedDetails(prev => {
      const next = new Set(prev)
      if (next.has(detail)) {
        next.delete(detail)
      } else {
        next.add(detail)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Validation Report</h4>
            <p className="text-sm text-gray-500 mt-1">
              Generated: {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Version: {report.validatorVersion}
          </div>
        </div>
      </div>

      {/* Validation Details */}
      <div className="space-y-2">
        {/* Schema Validation */}
        <ValidationDetailSection
          title="Schema Validation"
          expanded={expandedDetails.has('schema')}
          onToggle={() => toggleDetail('schema')}
          status={report.details.schemaValidation.failedCount === 0 ? 'passed' : 'failed'}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Checked:</span>
              <span className="ml-2 font-medium">{report.details.schemaValidation.totalChecked}</span>
            </div>
            <div>
              <span className="text-gray-500">Passed:</span>
              <span className="ml-2 font-medium text-green-600">
                {report.details.schemaValidation.passedCount}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-medium text-red-600">
                {report.details.schemaValidation.failedCount}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Performance:</span>
              <span className="ml-2 font-medium">{report.details.schemaValidation.performanceMs}ms</span>
            </div>
          </div>
          {report.details.schemaValidation.commonErrors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700">Common Errors:</p>
              <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                {report.details.schemaValidation.commonErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </ValidationDetailSection>

        {/* Zone Completeness */}
        <ValidationDetailSection
          title="Zone Completeness"
          expanded={expandedDetails.has('zones')}
          onToggle={() => toggleDetail('zones')}
          status={report.details.zoneCompleteness.coveragePercentage >= 95 ? 'passed' : 'warning'}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Zones:</span>
              <span className="ml-2 font-medium">{report.details.zoneCompleteness.totalZones}</span>
            </div>
            <div>
              <span className="text-gray-500">Processed:</span>
              <span className="ml-2 font-medium text-green-600">
                {report.details.zoneCompleteness.processedZones}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-medium text-red-600">
                {report.details.zoneCompleteness.failedZones}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Coverage:</span>
              <span className="ml-2 font-medium">
                {report.details.zoneCompleteness.coveragePercentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Quality Score:</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${report.details.zoneCompleteness.qualityScore}%` }}
                  />
                </div>
                <span className="ml-2 font-medium">
                  {report.details.zoneCompleteness.qualityScore}%
                </span>
              </div>
            </div>
          </div>
        </ValidationDetailSection>

        {/* Error Analysis */}
        <ValidationDetailSection
          title="Error Analysis"
          expanded={expandedDetails.has('errors')}
          onToggle={() => toggleDetail('errors')}
          status={report.details.errorAnalysis.criticalErrors === 0 ? 'passed' : 'failed'}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Errors:</span>
              <span className="ml-2 font-medium">{report.details.errorAnalysis.totalErrors}</span>
            </div>
            <div>
              <span className="text-gray-500">Critical:</span>
              <span className="ml-2 font-medium text-red-600">
                {report.details.errorAnalysis.criticalErrors}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Data Loss Risk:</span>
              <span className={`ml-2 font-medium ${
                report.details.errorAnalysis.impactAssessment.dataLossRisk === 'high' 
                  ? 'text-red-600' 
                  : report.details.errorAnalysis.impactAssessment.dataLossRisk === 'medium'
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {report.details.errorAnalysis.impactAssessment.dataLossRisk}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Processing Impact:</span>
              <span className="ml-2 font-medium">
                {report.details.errorAnalysis.impactAssessment.processingImpact.replace('_', ' ')}
              </span>
            </div>
          </div>
        </ValidationDetailSection>

        {/* Content Validation */}
        <ValidationDetailSection
          title="Content Validation"
          expanded={expandedDetails.has('content')}
          onToggle={() => toggleDetail('content')}
          status={report.details.contentValidation.textValidation.invalidCount === 0 ? 'passed' : 'warning'}
        >
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Quality Metrics</p>
              <div className="mt-2 space-y-2">
                <QualityMetric
                  label="Readability"
                  value={report.details.contentValidation.qualityMetrics.readability}
                />
                <QualityMetric
                  label="Completeness"
                  value={report.details.contentValidation.qualityMetrics.completeness}
                />
                <QualityMetric
                  label="Consistency"
                  value={report.details.contentValidation.qualityMetrics.consistency}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t">
              <div>
                <span className="text-gray-500">Encoding Errors:</span>
                <span className="ml-2 font-medium">
                  {report.details.contentValidation.textValidation.encodingErrors}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Invalid Tables:</span>
                <span className="ml-2 font-medium">
                  {report.details.contentValidation.tableValidation.invalidTables}
                </span>
              </div>
            </div>
          </div>
        </ValidationDetailSection>

        {/* Metadata Validation */}
        <ValidationDetailSection
          title="Metadata Validation"
          expanded={expandedDetails.has('metadata')}
          onToggle={() => toggleDetail('metadata')}
          status={report.details.metadataValidation.missingFields === 0 ? 'passed' : 'warning'}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Fields:</span>
              <span className="ml-2 font-medium">{report.details.metadataValidation.totalFields}</span>
            </div>
            <div>
              <span className="text-gray-500">Present:</span>
              <span className="ml-2 font-medium text-green-600">
                {report.details.metadataValidation.presentFields}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Missing:</span>
              <span className="ml-2 font-medium text-red-600">
                {report.details.metadataValidation.missingFields}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Invalid:</span>
              <span className="ml-2 font-medium text-orange-600">
                {report.details.metadataValidation.invalidFields}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Completeness:</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${report.details.metadataValidation.completenessPercentage}%` }}
                  />
                </div>
                <span className="ml-2 font-medium">
                  {report.details.metadataValidation.completenessPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </ValidationDetailSection>
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <InformationCircleIcon className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <span className="text-sm text-blue-800">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ValidationDetailSection({
  title,
  expanded,
  onToggle,
  status,
  children
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  status: 'passed' | 'failed' | 'warning'
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-lg">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center">
          {status === 'passed' && <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />}
          {status === 'failed' && <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />}
          {status === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />}
          <span className="font-medium">{title}</span>
        </div>
        {expanded ? (
          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

function QualityMetric({ label, value }: { label: string; value: number }) {
  const getColorClass = (value: number) => {
    if (value >= 80) return 'bg-green-600'
    if (value >= 60) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center">
        <div className="w-24 bg-gray-200 rounded-full h-1.5">
          <div 
            className={`${getColorClass(value)} h-1.5 rounded-full transition-all duration-300`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="ml-2 font-medium text-gray-700 w-10 text-right">
          {value}%
        </span>
      </div>
    </div>
  )
}

// Override Request Modal Component
export function OverrideRequestModal({
  blockers,
  onSubmit,
  onCancel
}: {
  blockers: BlockingIssue[]
  onSubmit: (justification: string) => void
  onCancel: () => void
}) {
  const [justification, setJustification] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (justification.trim() && acknowledged) {
      onSubmit(justification)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h3 className="text-lg font-medium mb-4">Request Validation Override</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            The following validation issues will be overridden:
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {blockers.map((blocker, index) => (
              <div key={index} className="text-sm p-2 bg-red-50 rounded">
                <p className="font-medium text-red-800">{blocker.reason}</p>
                {blocker.overrideRequirements && (
                  <p className="text-xs text-red-600 mt-1">
                    Requirements: {blocker.overrideRequirements.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justification for Override
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Please provide a detailed justification for overriding these validation issues..."
              required
            />
          </div>

          <div className="mb-4">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 mr-2"
                required
              />
              <span className="text-sm text-gray-600">
                I acknowledge that overriding validation may result in data quality issues
                and take full responsibility for this action.
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!justification.trim() || !acknowledged}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Override Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}