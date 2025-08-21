import React, { useState, useCallback } from 'react';
import { allocateProjectsToPanels, formatPanelAllocationReport, validatePanelConstraints } from '../utils/panelAllocation';
import { exportPanelAllocationReport } from '../utils/excelUtils';

const PanelAllocation = ({ projects, similarityResults, onAllocationComplete }) => {
  const [panelConfig, setPanelConfig] = useState({
    numberOfPanels: 4,
    instructorsPerPanel: 3,
    projectsPerPanel: 8,
    sessionDurationMinutes: 120,
    overlapThreshold: 0.5
  });

  const [allocationResult, setAllocationResult] = useState(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle configuration changes
  const handleConfigChange = useCallback((field, value) => {
    setPanelConfig(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  }, []);

  // Run panel allocation
  const runPanelAllocation = useCallback(async () => {
    if (!projects || projects.length === 0) {
      alert('No projects available for allocation. Please run the initial analysis first.');
      return;
    }

    setIsAllocating(true);
    setAllocationResult(null);
    setValidationResult(null);

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Run allocation algorithm
      const result = allocateProjectsToPanels(projects, similarityResults, panelConfig);
      setAllocationResult(result);

      // Validate results
      if (result.success) {
        const validation = validatePanelConstraints(result, panelConfig);
        setValidationResult(validation);
      }

      // Notify parent component
      if (onAllocationComplete) {
        onAllocationComplete(result);
      }

    } catch (error) {
      console.error('Panel allocation failed:', error);
      setAllocationResult({
        success: false,
        error: error.message,
        allocation: null,
        suggestions: []
      });
    } finally {
      setIsAllocating(false);
    }
  }, [projects, similarityResults, panelConfig, onAllocationComplete]);

  // Download panel allocation report
  const downloadReport = useCallback(() => {
    if (!allocationResult || !allocationResult.success) {
      alert('No valid allocation results to export');
      return;
    }

    const { report } = formatPanelAllocationReport(allocationResult);
    const success = exportPanelAllocationReport(report);
    
    if (success) {
      alert('Panel allocation report downloaded successfully!');
    } else {
      alert('Failed to download report. Please try again.');
    }
  }, [allocationResult]);

  // Reset allocation
  const resetAllocation = useCallback(() => {
    setAllocationResult(null);
    setValidationResult(null);
  }, []);

  const canRunAllocation = projects && projects.length > 0 && !isAllocating;
  const hasResults = allocationResult && allocationResult.success;

  return (
    <div className="panel-allocation-section">
      <div className="card">
        <div className="panel-allocation-header">
          <h2>🏛️ Panel Allocation System</h2>
          <p className="section-description">
            Automatically distribute projects into evaluation panels while ensuring overlapping projects 
            and their supervisors are grouped together.
          </p>
        </div>

        {/* Configuration Section */}
        <div className="allocation-config">
          <h3>Panel Configuration</h3>
          
          <div className="config-grid">
            <div className="form-group">
              <label className="form-label">Number of Panels</label>
              <input
                type="number"
                min="1"
                max="20"
                value={panelConfig.numberOfPanels}
                onChange={(e) => handleConfigChange('numberOfPanels', e.target.value)}
                className="form-input"
                disabled={isAllocating}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Projects per Panel</label>
              <input
                type="number"
                min="1"
                max="50"
                value={panelConfig.projectsPerPanel}
                onChange={(e) => handleConfigChange('projectsPerPanel', e.target.value)}
                className="form-input"
                disabled={isAllocating}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Instructors per Panel</label>
              <input
                type="number"
                min="1"
                max="10"
                value={panelConfig.instructorsPerPanel}
                onChange={(e) => handleConfigChange('instructorsPerPanel', e.target.value)}
                className="form-input"
                disabled={isAllocating}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Session Duration (minutes)</label>
              <input
                type="number"
                min="30"
                max="480"
                value={panelConfig.sessionDurationMinutes}
                onChange={(e) => handleConfigChange('sessionDurationMinutes', e.target.value)}
                className="form-input"
                disabled={isAllocating}
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="advanced-settings">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className="advanced-config">
                <div className="form-group">
                  <label className="form-label">
                    Overlap Threshold
                    <span className="help-text">
                      Similarity threshold for grouping overlapping projects (0.1 - 0.9)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="0.9"
                    step="0.1"
                    value={panelConfig.overlapThreshold}
                    onChange={(e) => handleConfigChange('overlapThreshold', e.target.value)}
                    className="form-input"
                    disabled={isAllocating}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="allocation-actions">
            <button
              onClick={runPanelAllocation}
              disabled={!canRunAllocation}
              className="btn btn-primary"
            >
              {isAllocating ? '🔄 Allocating...' : '🚀 Generate Panel Allocation'}
            </button>

            {hasResults && (
              <div className="result-actions">
                <button
                  onClick={downloadReport}
                  className="btn btn-secondary"
                >
                  📥 Download Report
                </button>
                
                <button
                  onClick={resetAllocation}
                  className="btn btn-secondary"
                >
                  🔄 Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isAllocating && (
          <div className="allocation-progress">
            <div className="progress-spinner"></div>
            <p>Generating optimal panel allocation...</p>
          </div>
        )}

        {/* Allocation Results */}
        {hasResults && (
          <div className="allocation-results">
            <div className="results-header">
              <h3>📊 Allocation Results</h3>
              <div className="results-summary">
                <div className="summary-stat">
                  <span className="stat-label">Total Projects:</span>
                  <span className="stat-value">{allocationResult.allocation.summary.totalProjects}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Allocated:</span>
                  <span className="stat-value">{allocationResult.allocation.summary.allocatedProjects}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Panels Created:</span>
                  <span className="stat-value">{allocationResult.allocation.summary.totalPanels}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Avg Projects/Panel:</span>
                  <span className="stat-value">{allocationResult.allocation.summary.averageProjectsPerPanel.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Panel Details */}
            <div className="panels-grid">
              {allocationResult.allocation.panels.map(panel => (
                <div key={panel.panelNumber} className="panel-card">
                  <div className="panel-header">
                    <h4>Panel {panel.panelNumber}</h4>
                    <div className="panel-stats">
                      <span className="stat-badge projects">
                        {panel.projects.length} Projects
                      </span>
                      <span className="stat-badge instructors">
                        {panel.instructors.length} Instructors
                      </span>
                      <span className="stat-badge duration">
                        {panel.totalDuration}min
                      </span>
                    </div>
                  </div>

                  <div className="panel-content">
                    <div className="panel-section">
                      <h5>Projects ({panel.projects.length})</h5>
                      <div className="project-list">
                        {panel.projects.slice(0, 5).map((project, idx) => (
                          <div key={idx} className="project-item">
                            <span className="project-id">
                              {project.projectId || project['Project Short Title'] || 'Unknown'}
                            </span>
                            <span className="project-title">
                              {(project.projectTitle || project['Project Title'] || 'Unknown').substring(0, 50)}
                              {(project.projectTitle || project['Project Title'] || '').length > 50 ? '...' : ''}
                            </span>
                          </div>
                        ))}
                        {panel.projects.length > 5 && (
                          <div className="project-item more">
                            +{panel.projects.length - 5} more projects
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="panel-section">
                      <h5>Instructors ({panel.instructors.length})</h5>
                      <div className="instructor-list">
                        {panel.instructors.map((instructor, idx) => (
                          <span key={idx} className="instructor-tag">
                            {instructor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Constraints and Validation */}
            {validationResult && (
              <div className="validation-results">
                <h4>🔍 Constraint Validation</h4>
                
                <div className="validation-status">
                  <div className={`status-indicator ${validationResult.valid ? 'success' : 'warning'}`}>
                    {validationResult.valid ? '✅ All constraints satisfied' : '⚠️ Some constraints violated'}
                  </div>
                </div>

                {validationResult.issues.length > 0 && (
                  <div className="constraint-issues">
                    <h5>Issues Found:</h5>
                    <ul className="issue-list">
                      {validationResult.issues.map((issue, idx) => (
                        <li key={idx} className="issue-item">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {allocationResult.allocation.constraints.satisfied.length > 0 && (
                  <div className="constraints-satisfied">
                    <h5>✅ Satisfied Constraints:</h5>
                    <ul className="constraint-list">
                      {allocationResult.allocation.constraints.satisfied.map((constraint, idx) => (
                        <li key={idx} className="constraint-item success">{constraint}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {allocationResult.allocation.constraints.warnings.length > 0 && (
                  <div className="constraints-warnings">
                    <h5>⚠️ Warnings:</h5>
                    <ul className="constraint-list">
                      {allocationResult.allocation.constraints.warnings.map((warning, idx) => (
                        <li key={idx} className="constraint-item warning">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {allocationResult.suggestions && allocationResult.suggestions.length > 0 && (
              <div className="allocation-suggestions">
                <h4>💡 Optimization Suggestions</h4>
                <div className="suggestions-list">
                  {allocationResult.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-item">
                      <div className="suggestion-type">
                        {suggestion.type === 'optimal_configuration' ? '🎯' : '⚠️'} 
                        {suggestion.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="suggestion-content">
                        <p className="suggestion-reasoning">{suggestion.reasoning}</p>
                        {suggestion.recommendation && (
                          <div className="suggestion-recommendation">
                            {typeof suggestion.recommendation === 'object' ? (
                              <div className="config-suggestion">
                                <strong>Suggested Configuration:</strong>
                                <ul>
                                  <li>Panels: {suggestion.recommendation.numberOfPanels}</li>
                                  <li>Projects per Panel: {suggestion.recommendation.projectsPerPanel}</li>
                                  <li>Instructors per Panel: {suggestion.recommendation.instructorsPerPanel}</li>
                                  <li>Session Duration: {suggestion.recommendation.sessionDurationMinutes} minutes</li>
                                </ul>
                              </div>
                            ) : (
                              <p>{suggestion.recommendation}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {allocationResult && !allocationResult.success && (
          <div className="allocation-error">
            <div className="error-message">
              <h4>❌ Allocation Failed</h4>
              <p>{allocationResult.error}</p>
            </div>
          </div>
        )}

        {/* Information Panel */}
        {!hasResults && !isAllocating && (
          <div className="allocation-info">
            <h4>How Panel Allocation Works</h4>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-icon">🔗</div>
                <h5>Overlap Detection</h5>
                <p>Projects with similarity above the threshold are grouped together to ensure similar work is evaluated by the same panel.</p>
              </div>
              <div className="info-item">
                <div className="info-icon">👥</div>
                <h5>Supervisor Grouping</h5>
                <p>Supervisors of overlapping projects are automatically assigned to the same panel to maintain consistency.</p>
              </div>
              <div className="info-item">
                <div className="info-icon">⚖️</div>
                <h5>Load Balancing</h5>
                <p>Projects are distributed evenly across panels to avoid overloading any single evaluation committee.</p>
              </div>
              <div className="info-item">
                <div className="info-icon">✅</div>
                <h5>Constraint Validation</h5>
                <p>The system ensures all panels meet the specified requirements for projects, instructors, and duration.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PanelAllocation;
