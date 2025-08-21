import React, { useState, useCallback } from 'react';
import { readTextFile, downloadSampleTextFile, downloadInstructorListTemplate, convertInstructorListToFormat } from '../utils/textFileParser';
import { allocateGroupsToPanels } from '../utils/constraintBasedPanelAllocation';
import { exportConstraintBasedPanelAllocation } from '../utils/excelUtils';

const ConstraintBasedPanelAllocation = ({ similarityResults = null, hasFYPAnalysis = false }) => {
  const [parsedData, setParsedData] = useState(null);
  const [constraints, setConstraints] = useState({
    numberOfPanels: 3,
    instructorsPerPanel: 4,
    groupsPerPanel: 3,
    sessionDurationMinutes: 120
  });
  const [allocationResult, setAllocationResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [showFormatHelper, setShowFormatHelper] = useState(false);

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setParsedData(null);
    setAllocationResult(null);

    try {
      const result = await readTextFile(file);
      
      if (!result.success) {
        // Check if this is a format error (instructor names without projects)
        const formatErrors = result.errors.filter(err => err.includes('but no projects specified'));
        if (formatErrors.length > 0) {
          setError(`Format Error: Your file contains instructor names without projects. Please use the format "Instructor Name: Project1, Project2" or download the template below.`);
          setShowFormatHelper(true);
        } else {
          setError(`File parsing failed: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? ` and ${result.errors.length - 3} more errors` : ''}`);
        }
        return;
      }

      setParsedData(result.data);
      
      // Show preview of parsed data
      const { instructors, projects, groups } = result.data;
      console.log('Parsed Data:', {
        instructors: instructors.length,
        projects: projects.length,
        groups: groups.length
      });

    } catch (err) {
      setError(`Failed to process file: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle constraint changes
  const handleConstraintChange = useCallback((field, value) => {
    setConstraints(prev => ({
      ...prev,
      [field]: parseInt(value) || 0
    }));
  }, []);

  // Run panel allocation
  const runPanelAllocation = useCallback(() => {
    if (!parsedData) {
      setError('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = allocateGroupsToPanels(parsedData, constraints, similarityResults);
      setAllocationResult(result);
      
      if (!result.success) {
        setError('Panel allocation completed with some issues. Check the results below.');
      }
      
    } catch (err) {
      setError(`Allocation failed: ${err.message}`);
      setAllocationResult(null);
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, constraints]);

  // Download results
  const downloadResults = useCallback(() => {
    if (!allocationResult) {
      alert('No allocation results to export');
      return;
    }

    const success = exportConstraintBasedPanelAllocation(allocationResult);
    if (success) {
      alert('Panel allocation report downloaded successfully!');
    } else {
      alert('Failed to download report. Please try again.');
    }
  }, [allocationResult]);

  // Download sample file
  const handleDownloadSample = useCallback(() => {
    downloadSampleTextFile();
    alert('Sample text file downloaded! Use this as a template for your instructor-project data.');
  }, []);

  return (
    <div className="constraint-based-panel-allocation">
      <div className="card">
        <div className="panel-allocation-header">
          <h2>📋 Constraint-Based Panel Allocation</h2>
          <p className="section-description">
            Upload a text file with instructor-project mappings and configure hard/soft constraints
            to generate optimal panel allocations.
          </p>
          
          {/* Similarity Analysis Status */}
          <div className={`similarity-status ${hasFYPAnalysis ? 'available' : 'unavailable'}`}>
            {hasFYPAnalysis ? (
              <div className="status-indicator success">
                <span className="status-icon">✓</span>
                <span className="status-text">FYP Similarity Analysis Available</span>
                <span className="status-detail">Panel allocation will consider project similarity for better grouping</span>
              </div>
            ) : (
              <div className="status-indicator warning">
                <span className="status-icon">⚠️</span>
                <span className="status-text">No FYP Analysis Data</span>
                <span className="status-detail">Panel allocation will be based on instructor overlap only. For better results, run FYP Analysis first.</span>
              </div>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        <div className="file-upload-section">
          <h3>📁 Upload Instructor-Project File</h3>
          <div className="upload-controls">
            <input
              type="file"
              accept=".txt"
              onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
              className="file-input"
              disabled={isProcessing}
            />
            <button
              onClick={handleDownloadSample}
              className="btn btn-secondary btn-sm"
              type="button"
            >
              📥 Download Sample File
            </button>
            
            <button
              onClick={() => downloadInstructorListTemplate()}
              className="btn btn-secondary btn-sm"
              type="button"
            >
              📋 Download Template
            </button>
          </div>
          
          <div className="file-format-help">
            <h4>Expected File Format:</h4>
            <pre className="format-example">
{`Dr. John Smith: AI Chatbot Development, Machine Learning System
Prof. Jane Doe: Web Security Platform, E-commerce Development
Dr. Mike Johnson: IoT Smart Home, Sensor Network, Automation`}
            </pre>
            <p>Each line should contain: <code>Instructor Name: Project1, Project2, Project3</code></p>
          </div>
        </div>

        {/* Data Preview */}
        {parsedData && (
          <div className="data-preview">
            <h3>📊 Parsed Data Summary</h3>
            <div className="preview-stats">
              <div className="stat-item">
                <span className="stat-label">Instructors:</span>
                <span className="stat-value">{parsedData.summary.totalInstructors}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Projects:</span>
                <span className="stat-value">{parsedData.summary.totalProjects}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Groups:</span>
                <span className="stat-value">{parsedData.summary.totalGroups}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg Projects/Instructor:</span>
                <span className="stat-value">{parsedData.summary.averageProjectsPerInstructor.toFixed(1)}</span>
              </div>
            </div>

            {/* Show some sample groups */}
            <div className="sample-groups">
              <h4>Sample Groups:</h4>
              <div className="groups-list">
                {parsedData.groups.slice(0, 3).map(group => (
                  <div key={group.id} className="group-preview">
                    <span className="group-id">{group.id}</span>
                    <span className="group-projects">Projects: {group.projects.join(', ')}</span>
                    <span className="group-supervisors">Supervisor: {group.primarySupervisor}</span>
                  </div>
                ))}
                {parsedData.groups.length > 3 && (
                  <div className="more-groups">+{parsedData.groups.length - 3} more groups</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Constraints Configuration */}
        {parsedData && (
          <div className="constraints-config">
            <h3>⚙️ Configure Constraints</h3>
            
            <div className="constraints-grid">
              <div className="constraint-group">
                <h4>🔴 Hard Constraints</h4>
                <div className="form-group">
                  <label className="form-label">Total Number of Panels</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={constraints.numberOfPanels}
                    onChange={(e) => handleConstraintChange('numberOfPanels', e.target.value)}
                    className="form-input"
                    disabled={isProcessing}
                  />
                  <span className="help-text">Cannot be exceeded</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Instructors per Panel</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={constraints.instructorsPerPanel}
                    onChange={(e) => handleConstraintChange('instructorsPerPanel', e.target.value)}
                    className="form-input"
                    disabled={isProcessing}
                  />
                  <span className="help-text">Cannot be exceeded</span>
                </div>
              </div>

              <div className="constraint-group">
                <h4>🟡 Soft Constraints</h4>
                <div className="form-group">
                  <label className="form-label">Desired Groups per Panel</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={constraints.groupsPerPanel}
                    onChange={(e) => handleConstraintChange('groupsPerPanel', e.target.value)}
                    className="form-input"
                    disabled={isProcessing}
                  />
                  <span className="help-text">Can be exceeded if necessary</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Session Duration (minutes)</label>
                  <input
                    type="number"
                    min="30"
                    max="480"
                    value={constraints.sessionDurationMinutes}
                    onChange={(e) => handleConstraintChange('sessionDurationMinutes', e.target.value)}
                    className="form-input"
                    disabled={isProcessing}
                  />
                  <span className="help-text">For scheduling reference</span>
                </div>
              </div>
            </div>

            <div className="allocation-actions">
              <button
                onClick={runPanelAllocation}
                disabled={!parsedData || isProcessing}
                className="btn btn-primary"
              >
                {isProcessing ? '🔄 Allocating...' : '🚀 Generate Panel Allocation'}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isProcessing && (
          <div className="allocation-progress">
            <div className="progress-spinner"></div>
            <p>Processing allocation with constraints...</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="allocation-error">
            <div className="error-message">
              <h4>⚠️ {allocationResult ? 'Warning' : 'Error'}</h4>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Format Helper */}
        {showFormatHelper && (
          <div className="format-helper">
            <div className="format-helper-content">
              <h3>📝 Format Help</h3>
              <p>Your file contains instructor names but no project assignments. Here's how to fix it:</p>
              
              <div className="format-options">
                <div className="format-option">
                  <h4>Option 1: Download Template</h4>
                  <p>Use the template button above to get a properly formatted file that you can edit.</p>
                </div>
                
                <div className="format-option">
                  <h4>Option 2: Manual Formatting</h4>
                  <p>Add project names to each instructor line using this format:</p>
                  <pre className="format-example">
{`Dr. John Smith: Project A, Project B
Prof. Jane Doe: Web Security Platform
Ms. Alice Wilson: Data Analytics Dashboard, ML System`}
                  </pre>
                </div>
                
                <div className="format-option">
                  <h4>Option 3: Quick Fix</h4>
                  <p>If you need to test the system quickly, you can add placeholder projects:</p>
                  <pre className="format-example">
{`Dr. Hasan Mujtaba: Project 1A, Project 1B
Dr. Hammad Majeed: Project 2A, Project 2B
Dr. Aftab Maroof: Project 3A`}
                  </pre>
                </div>
              </div>
              
              <div className="format-helper-actions">
                <button
                  onClick={() => setShowFormatHelper(false)}
                  className="btn btn-secondary"
                >
                  Close Help
                </button>
                
                <button
                  onClick={() => downloadInstructorListTemplate()}
                  className="btn btn-primary"
                >
                  📋 Download Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {allocationResult && (
          <div className="allocation-results">
            <div className="results-header">
              <h3>🎯 Allocation Results</h3>
              <button
                onClick={downloadResults}
                className="btn btn-primary"
              >
                📥 Download Excel Report
              </button>
            </div>

            {/* Summary */}
            <div className="results-summary">
              <div className="summary-section">
                <h4>📊 Summary</h4>
                <div className="summary-grid">
                  <div className="summary-stat">
                    <span className="stat-label">Total Panels:</span>
                    <span className="stat-value">{allocationResult.summary.totalPanels}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Total Groups:</span>
                    <span className="stat-value">{allocationResult.summary.totalGroups}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Avg Groups/Panel:</span>
                    <span className="stat-value">{allocationResult.summary.averageGroupsPerPanel}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Avg Instructors/Panel:</span>
                    <span className="stat-value">{allocationResult.summary.averageInstructorsPerPanel}</span>
                  </div>
                </div>
              </div>

              {/* Constraints Status */}
              <div className="constraints-status">
                <h4>🎯 Constraints Status</h4>
                <div className="constraint-status-grid">
                  <div className="constraint-status hard">
                    <span className="status-label">Hard Constraints:</span>
                    <span className="status-value success">✅ All Satisfied</span>
                  </div>
                  <div className="constraint-status soft">
                    <span className="status-label">Soft Constraints:</span>
                    <span className={`status-value ${allocationResult.summary.constraints.soft.exceeded ? 'warning' : 'success'}`}>
                      {allocationResult.summary.constraints.soft.exceeded ? '⚠️ Exceeded' : '✅ Satisfied'}
                    </span>
                  </div>
                </div>
                
                {allocationResult.summary.constraints.soft.exceeded && (
                  <div className="constraint-explanation">
                    <p><strong>Reason:</strong> {allocationResult.summary.constraints.soft.reason}</p>
                    <p><strong>Max groups in any panel:</strong> {allocationResult.summary.constraints.soft.maxGroupsInAnyPanel}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Details */}
            <div className="panels-display">
              <h4>🏛️ Panel Allocations</h4>
              <div className="panels-grid">
                {allocationResult.panels.map(panel => (
                  <div key={panel.panelNumber} className="panel-card">
                    <div className="panel-header">
                      <h5>Panel {panel.panelNumber}</h5>
                      <div className="panel-stats">
                        <span className="stat-badge groups">
                          {panel.constraints.actualGroups} Groups
                        </span>
                        <span className="stat-badge projects">
                          {panel.totalProjects} Projects
                        </span>
                        <span className="stat-badge instructors">
                          {panel.instructors.length} Instructors
                        </span>
                      </div>
                    </div>

                    <div className="panel-content">
                      <div className="panel-section">
                        <h6>Groups ({panel.constraints.actualGroups})</h6>
                        <div className="groups-list">
                          {panel.groups.map(group => (
                            <div key={group.id} className="group-item">
                              <span className="group-id">{group.id.replace(/^(GROUP_|INDIVIDUAL_)/, '')}</span>
                              <span className="group-projects">
                                {group.projects.slice(0, 2).join(', ')}
                                {group.projects.length > 2 && ` +${group.projects.length - 2} more`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="panel-section">
                        <h6>Instructors ({panel.instructors.length})</h6>
                        <div className="instructors-list">
                          {panel.instructors.map(instructor => (
                            <span key={instructor} className="instructor-tag">
                              {instructor}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="panel-utilization">
                        <div className="utilization-item">
                          <span>Groups:</span>
                          <span>{panel.constraints.actualGroups}/{constraints.groupsPerPanel}</span>
                        </div>
                        <div className="utilization-item">
                          <span>Instructors:</span>
                          <span>{panel.instructors.length}/{constraints.instructorsPerPanel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructor Assignments Summary */}
            <div className="instructor-assignments">
              <h4>👥 Instructor Assignments</h4>
              <div className="assignments-summary">
                <div className="assigned-instructors">
                  <h5>Assigned ({allocationResult.instructorAssignments.filter(i => i.status === 'Assigned').length})</h5>
                  <div className="instructors-list">
                    {allocationResult.instructorAssignments
                      .filter(i => i.status === 'Assigned')
                      .slice(0, 5)
                      .map(assignment => (
                        <div key={assignment.instructorName} className="assignment-item">
                          <span className="instructor-name">{assignment.instructorName}</span>
                          <span className="panel-info">Panel {assignment.panelAssigned}</span>
                          <span className="project-count">{assignment.projectCount} projects</span>
                        </div>
                      ))}
                    {allocationResult.instructorAssignments.filter(i => i.status === 'Assigned').length > 5 && (
                      <div className="more-assignments">
                        +{allocationResult.instructorAssignments.filter(i => i.status === 'Assigned').length - 5} more
                      </div>
                    )}
                  </div>
                </div>

                {allocationResult.instructorAssignments.some(i => i.status === 'Unassigned') && (
                  <div className="unassigned-instructors">
                    <h5>Unassigned ({allocationResult.instructorAssignments.filter(i => i.status === 'Unassigned').length})</h5>
                    <div className="instructors-list">
                      {allocationResult.instructorAssignments
                        .filter(i => i.status === 'Unassigned')
                        .map(assignment => (
                          <div key={assignment.instructorName} className="assignment-item unassigned">
                            <span className="instructor-name">{assignment.instructorName}</span>
                            <span className="project-count">{assignment.projectCount} projects</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Allocation Log */}
            {allocationResult.allocationResults && (
              <div className="allocation-log">
                <h4>📋 Allocation Log</h4>
                <div className="log-sections">
                  {allocationResult.allocationResults.successful.length > 0 && (
                    <div className="log-section success">
                      <h5>✅ Successful ({allocationResult.allocationResults.successful.length})</h5>
                      <ul>
                        {allocationResult.allocationResults.successful.slice(0, 3).map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                        {allocationResult.allocationResults.successful.length > 3 && (
                          <li>... and {allocationResult.allocationResults.successful.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {allocationResult.allocationResults.failed.length > 0 && (
                    <div className="log-section failed">
                      <h5>❌ Failed ({allocationResult.allocationResults.failed.length})</h5>
                      <ul>
                        {allocationResult.allocationResults.failed.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {allocationResult.allocationResults.warnings.length > 0 && (
                    <div className="log-section warnings">
                      <h5>⚠️ Warnings ({allocationResult.allocationResults.warnings.length})</h5>
                      <ul>
                        {allocationResult.allocationResults.warnings.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!parsedData && !isProcessing && (
          <div className="instructions">
            <h3>📋 How to Use</h3>
            <div className="instruction-steps">
              <div className="instruction-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Prepare Text File</h4>
                  <p>Create a text file with instructor-project mappings. Each line should contain an instructor name followed by their supervised projects.</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Upload & Configure</h4>
                  <p>Upload your file and set the constraints. Hard constraints cannot be violated, while soft constraints can be exceeded if necessary.</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Generate & Export</h4>
                  <p>Run the allocation algorithm and download the comprehensive Excel report with all panel assignments and constraint analysis.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstraintBasedPanelAllocation;
