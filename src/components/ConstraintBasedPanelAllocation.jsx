import React, { useState, useCallback } from 'react';
import { readTextFile, downloadSampleTextFile, downloadInstructorListTemplate, downloadInstructorOnlyTemplate, extractSupervisorStatistics } from '../utils/textFileParser';
import { allocateGroupsToPanels } from '../utils/constraintBasedPanelAllocation';
import { exportConstraintBasedPanelAllocation, exportSupervisorStatistics } from '../utils/excelUtils';
import { readExcelFile } from '../utils/excelUtils';

const ConstraintBasedPanelAllocation = ({ similarityResults = null, hasFYPAnalysis = false }) => {
  const [parsedData, setParsedData] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [supervisorStats, setSupervisorStats] = useState(null);
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

  // Handle Excel file upload
  const handleExcelUpload = useCallback(async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await readExcelFile(file);
      setExcelData(result.data);
      
      // Extract supervisor statistics
      const stats = extractSupervisorStatistics(result.data);
      setSupervisorStats(stats);
      
      console.log('Excel Data Loaded:', {
        totalProjects: result.totalProjects,
        totalSupervisors: stats.totalSupervisors
      });

    } catch (err) {
      setError(`Failed to process Excel file: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle instructor text file upload
  const handleTextFileUpload = useCallback(async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setParsedData(null);
    setAllocationResult(null);

    try {
      const result = await readTextFile(file, excelData);
      
      if (!result.success) {
        // Check if this is a format error (instructor names without projects)
        const formatErrors = result.errors.filter(err => err.includes('but no projects specified') || err.includes('not found in Excel data'));
        if (formatErrors.length > 0) {
          if (excelData) {
            setError(`Some instructors in your list were not found in the Excel data or have no projects. Please check the names match exactly with the Excel file.`);
          } else {
            setError(`Format Error: Your file contains instructor names without projects. Please upload an Excel file first, or use the format "Instructor Name: Project1, Project2".`);
          }
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
  }, [excelData]);

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

  // Download supervisor statistics
  const downloadSupervisorStats = useCallback(() => {
    if (!supervisorStats) {
      alert('No supervisor statistics available. Please upload an Excel file first.');
      return;
    }

    const success = exportSupervisorStatistics(supervisorStats);
    if (success) {
      alert('Supervisor statistics downloaded successfully!');
    } else {
      alert('Failed to download supervisor statistics. Please try again.');
    }
  }, [supervisorStats]);

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
          <h3>📁 Upload Files</h3>
          
          {/* Step 1: Excel File Upload */}
          <div className="upload-step">
            <h4>Step 1: Upload FYP Excel File (Optional but Recommended)</h4>
            <div className="upload-controls">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files[0] && handleExcelUpload(e.target.files[0])}
                className="file-input"
                disabled={isProcessing}
              />
              {supervisorStats && (
                <button
                  onClick={downloadSupervisorStats}
                  className="btn btn-primary btn-sm"
                  type="button"
                >
                  📊 Download Supervisor Statistics
                </button>
              )}
            </div>
            
            {excelData && (
              <div className="excel-preview">
                <div className="excel-stats">
                  <span className="stat-badge">✅ Excel Loaded</span>
                  <span className="stat-badge">{supervisorStats?.totalProjects} Projects</span>
                  <span className="stat-badge">{supervisorStats?.totalSupervisors} Supervisors</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Instructor Text File Upload */}
          <div className="upload-step">
            <h4>Step 2: Upload Instructor List</h4>
            <div className="upload-controls">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => e.target.files[0] && handleTextFileUpload(e.target.files[0])}
                className="file-input"
                disabled={isProcessing}
              />
              <button
                onClick={handleDownloadSample}
                className="btn btn-secondary btn-sm"
                type="button"
              >
                📥 Download Sample
              </button>
              
              <button
                onClick={() => downloadInstructorListTemplate()}
                className="btn btn-secondary btn-sm"
                type="button"
              >
                📋 Full Template
              </button>

              <button
                onClick={() => downloadInstructorOnlyTemplate()}
                className="btn btn-secondary btn-sm"
                type="button"
              >
                📝 Instructor-Only Template
              </button>
            </div>
          </div>
          
          <div className="file-format-help">
            <h4>File Format Options:</h4>
            
            <div className="format-option">
              <h5>Option 1: With Excel Data (Recommended)</h5>
              <pre className="format-example">
{`Dr. Muhammad Asim
Mr. Saad Salman
Dr. Hasan Mujtaba`}
              </pre>
              <p>Just list instructor names (one per line). Projects will be extracted from Excel data.</p>
            </div>

            <div className="format-option">
              <h5>Option 2: Traditional Format</h5>
              <pre className="format-example">
{`Dr. John Smith: AI Chatbot Development, Machine Learning System
Prof. Jane Doe: Web Security Platform, E-commerce Development
Dr. Mike Johnson: IoT Smart Home, Sensor Network, Automation`}
              </pre>
              <p>Each line should contain: <code>Instructor Name: Project1, Project2, Project3</code></p>
            </div>
          </div>
        </div>

        {/* Supervisor Statistics Preview */}
        {supervisorStats && !parsedData && (
          <div className="supervisor-stats-preview">
            <h3>📊 Supervisor Statistics</h3>
            <div className="preview-stats">
              <div className="stat-item">
                <span className="stat-label">Total Supervisors:</span>
                <span className="stat-value">{supervisorStats.totalSupervisors}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Projects:</span>
                <span className="stat-value">{supervisorStats.totalProjects}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg Projects/Supervisor:</span>
                <span className="stat-value">{supervisorStats.averageProjectsPerSupervisor.toFixed(1)}</span>
              </div>
            </div>

            <div className="top-supervisors">
              <h4>Top Supervisors by Project Count:</h4>
              <div className="supervisors-list">
                {supervisorStats.supervisors.slice(0, 5).map((supervisor, index) => (
                  <div key={supervisor.name} className="supervisor-preview">
                    <span className="supervisor-rank">#{index + 1}</span>
                    <span className="supervisor-name">{supervisor.name}</span>
                    <span className="supervisor-count">{supervisor.projectCount} projects</span>
                  </div>
                ))}
                {supervisorStats.supervisors.length > 5 && (
                  <div className="more-supervisors">+{supervisorStats.supervisors.length - 5} more supervisors</div>
                )}
              </div>
            </div>
          </div>
        )}

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
              <p>{excelData ? 'Some instructors in your list were not found in the Excel data.' : 'Your file contains instructor names but no project assignments.'} Here's how to fix it:</p>
              
              <div className="format-options">
                {excelData ? (
                  <>
                    <div className="format-option">
                      <h4>Check Instructor Names</h4>
                      <p>Make sure instructor names in your text file match exactly with the Excel data:</p>
                      <div className="excel-supervisors-sample">
                        <h5>Available supervisors in Excel:</h5>
                        <div className="supervisor-names">
                          {supervisorStats?.supervisors.slice(0, 8).map(sup => (
                            <span key={sup.name} className="supervisor-name-tag">{sup.name}</span>
                          ))}
                          {supervisorStats?.supervisors.length > 8 && (
                            <span className="more-tag">+{supervisorStats.supervisors.length - 8} more</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="format-option">
                      <h4>Instructor-Only Template</h4>
                      <p>Use the instructor-only template with names from your Excel data:</p>
                      <pre className="format-example">
{supervisorStats?.supervisors.slice(0, 3).map(sup => sup.name).join('\n') || 'Dr. Muhammad Asim\nMr. Saad Salman\nDr. Hasan Mujtaba'}
                      </pre>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="format-option">
                      <h4>Option 1: Upload Excel File First</h4>
                      <p>Upload your FYP Excel file first, then use instructor-only list format.</p>
                    </div>
                    
                    <div className="format-option">
                      <h4>Option 2: Traditional Format</h4>
                      <p>Add project names to each instructor line using this format:</p>
                      <pre className="format-example">
{`Dr. John Smith: Project A, Project B
Prof. Jane Doe: Web Security Platform
Ms. Alice Wilson: Data Analytics Dashboard, ML System`}
                      </pre>
                    </div>
                  </>
                )}
              </div>
              
              <div className="format-helper-actions">
                <button
                  onClick={() => setShowFormatHelper(false)}
                  className="btn btn-secondary"
                >
                  Close Help
                </button>
                
                {excelData ? (
                  <button
                    onClick={() => downloadInstructorOnlyTemplate()}
                    className="btn btn-primary"
                  >
                    📝 Download Instructor-Only Template
                  </button>
                ) : (
                  <button
                    onClick={() => downloadInstructorListTemplate()}
                    className="btn btn-primary"
                  >
                    📋 Download Full Template
                  </button>
                )}
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
                  <h4>Upload Excel File (Recommended)</h4>
                  <p>Upload your FYP Excel file containing supervisor and project information. This enables automatic project extraction and provides supervisor statistics.</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Upload Instructor List</h4>
                  <p>Upload a text file with instructor names. If you uploaded Excel data, just list instructor names (one per line). Otherwise, use the format "Instructor Name: Project1, Project2".</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Configure & Generate</h4>
                  <p>Set the constraints and run the allocation algorithm. Download the comprehensive Excel report with panel assignments and statistics.</p>
                </div>
              </div>
            </div>

            <div className="workflow-benefits">
              <h4>✨ Benefits of the New Workflow:</h4>
              <ul>
                <li>🎯 <strong>Simplified Input:</strong> Just list instructor names when you have Excel data</li>
                <li>📊 <strong>Automatic Statistics:</strong> Get supervisor workload distribution automatically</li>
                <li>🔄 <strong>Data Consistency:</strong> Projects are extracted directly from your Excel source</li>
                <li>📈 <strong>Enhanced Reports:</strong> Download detailed supervisor statistics Excel files</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstraintBasedPanelAllocation;
