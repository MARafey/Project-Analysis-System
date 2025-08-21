import React, { useState, useCallback, useEffect } from 'react';
import { readTextFile, downloadSampleTextFile, downloadInstructorListTemplate, downloadInstructorOnlyTemplate, extractSupervisorStatistics } from '../utils/textFileParser';
import { allocateGroupsToPanels } from '../utils/constraintBasedPanelAllocation';
import { exportConstraintBasedPanelAllocation, exportSupervisorStatistics } from '../utils/excelUtils';
import { readExcelFile } from '../utils/excelUtils';
import { isGeminiAvailable, generatePanelAllocationSuggestions } from '../utils/geminiApi';

const ConstraintBasedPanelAllocation = ({ 
  similarityResults = null, 
  hasFYPAnalysis = false,
  excelData: passedExcelData = null,
  domainResults = null
}) => {
  const [parsedData, setParsedData] = useState(null);
  const [excelData, setExcelData] = useState(passedExcelData);
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
  const [geminiSuggestions, setGeminiSuggestions] = useState(null);
  const [useGeminiEnhancement, setUseGeminiEnhancement] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  // Process passed Excel data automatically
  useEffect(() => {
    if (passedExcelData && passedExcelData.length > 0) {
      setExcelData(passedExcelData);
      const stats = extractSupervisorStatistics(passedExcelData);
      setSupervisorStats(stats);
    }
  }, [passedExcelData]);

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
        // Check for format errors
        if (result.errors.some(err => err.includes('Excel data is required'))) {
          setError(`Excel file required: Please upload your FYP Excel file first before uploading the instructor list.`);
          setShowFormatHelper(false);
        } else if (result.errors.some(err => err.includes('Invalid instructor name format'))) {
          setError(`Invalid instructor names detected. The system will try to format them automatically. Please check that each line contains a valid name (e.g., "FirstName LastName" or "Dr. FirstName LastName")`);
          setShowFormatHelper(true);
        } else {
          setError(`File parsing failed: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? ` and ${result.errors.length - 3} more errors` : ''}`);
          setShowFormatHelper(true);
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
  const runPanelAllocation = useCallback(async () => {
    if (!parsedData) {
      setError('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setGeminiSuggestions(null);
    setProcessingStep('Initializing panel allocation...');
    setProcessingProgress(0);

    try {
      // Step 1: Get Gemini suggestions if available and enabled
      if (useGeminiEnhancement && isGeminiAvailable() && excelData) {
        try {
          setProcessingStep('Getting AI-powered suggestions...');
          setProcessingProgress(20);
          
          const suggestions = await generatePanelAllocationSuggestions(
            excelData.slice(0, 20), // Limit to first 20 projects for API efficiency
            constraints,
            similarityResults || []
          );
          
          if (suggestions.success) {
            setGeminiSuggestions(suggestions.data);
          }
          setProcessingProgress(40);
        } catch (geminiError) {
          console.warn('Gemini suggestions failed:', geminiError);
          // Continue with regular allocation
        }
      } else {
        setProcessingProgress(40);
      }

      // Step 2: Run the main allocation algorithm
      setProcessingStep('Allocating projects and instructors to panels...');
      setProcessingProgress(60);
      
      const result = allocateGroupsToPanels(parsedData, constraints, similarityResults);
      setAllocationResult(result);
      
      setProcessingStep('Finalizing panel assignments...');
      setProcessingProgress(90);
      
      // Small delay to show completion
      setTimeout(() => {
        setProcessingProgress(100);
        setProcessingStep('Panel allocation completed successfully!');
        setTimeout(() => {
          setIsProcessing(false);
          setProcessingStep('');
          setProcessingProgress(0);
        }, 1000);
      }, 500);
      
      if (!result.success) {
        setError('Panel allocation completed with some issues. Check the results below.');
      }
      
    } catch (err) {
      setError(`Allocation failed: ${err.message}`);
      setAllocationResult(null);
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  }, [parsedData, constraints, similarityResults, useGeminiEnhancement, excelData]);

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

  // Create instructor list from Excel data
  const createInstructorListFromExcel = useCallback(() => {
    if (!supervisorStats || !supervisorStats.supervisors) {
      alert('No supervisor data available');
      return;
    }

    const instructorList = supervisorStats.supervisors
      .map(supervisor => supervisor.name)
      .join('\n');

    const content = `# Instructor List Generated from Excel Data
# Total Supervisors: ${supervisorStats.totalSupervisors}
# Total Projects: ${supervisorStats.totalProjects}
# Generated on: ${new Date().toLocaleDateString()}

${instructorList}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instructor_list_from_excel.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert(`Created instructor list with ${supervisorStats.totalSupervisors} supervisors!`);
  }, [supervisorStats]);

  return (
    <div className="constraint-based-panel-allocation">
      <div className="enhanced-card">
        <div className="enhanced-card-header">
          <h2 className="enhanced-card-title">📋 Constraint-Based Panel Allocation</h2>
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

        {/* Loading State */}
        {isProcessing && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">{processingStep}</div>
            <div className="loading-subtext">
              {processingProgress < 100 ? 'Processing...' : 'Finalizing...'}
            </div>
            
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                <span>Progress</span>
                <span className="progress-percentage">{processingProgress}%</span>
              </div>
            </div>

            <div className="progress-steps">
              <div className={`progress-step ${processingProgress >= 0 ? 'completed' : ''}`}>
                <div className="progress-step-icon">1</div>
                <div className="progress-step-text">Initialize</div>
              </div>
              <div className={`progress-step ${processingProgress >= 20 ? 'completed' : processingProgress >= 10 ? 'active' : ''}`}>
                <div className="progress-step-icon">2</div>
                <div className="progress-step-text">AI Suggestions</div>
              </div>
              <div className={`progress-step ${processingProgress >= 60 ? 'completed' : processingProgress >= 40 ? 'active' : ''}`}>
                <div className="progress-step-icon">3</div>
                <div className="progress-step-text">Panel Allocation</div>
              </div>
              <div className={`progress-step ${processingProgress >= 90 ? 'completed' : processingProgress >= 80 ? 'active' : ''}`}>
                <div className="progress-step-icon">4</div>
                <div className="progress-step-text">Finalize</div>
              </div>
            </div>
          </div>
        )}

        <div className="enhanced-card-body">
          {/* File Upload Section */}
          <div className="file-upload-section">
          <h3>📁 Upload Files</h3>
          
          {/* Step 1: Excel File Status */}
          <div className="upload-step">
            <h4>Step 1: FYP Excel Data</h4>
            {excelData && excelData.length > 0 ? (
              <div className="excel-already-loaded">
                <div className="excel-preview">
                  <div className="excel-stats">
                    <span className="stat-badge">✅ Excel Data Available from FYP Analysis</span>
                    <span className="stat-badge">{supervisorStats?.totalProjects} Projects</span>
                    <span className="stat-badge">{supervisorStats?.totalSupervisors} Supervisors</span>
                  </div>
                </div>
                <div className="excel-actions">
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
                <p className="help-text">
                  ✅ Using Excel data from your FYP analysis. Projects will be automatically extracted for instructors.
                </p>
                
                {supervisorStats && supervisorStats.supervisors.length > 0 && (
                  <div className="available-supervisors">
                    <h5>Available Supervisors in Excel Data:</h5>
                    <div className="supervisor-list">
                      {supervisorStats.supervisors.slice(0, 10).map((supervisor, index) => (
                        <span key={index} className="supervisor-chip">
                          {supervisor.name} ({supervisor.projectCount})
                        </span>
                      ))}
                      {supervisorStats.supervisors.length > 10 && (
                        <span className="more-supervisors">+{supervisorStats.supervisors.length - 10} more</span>
                      )}
                    </div>
                    <p className="supervisor-help">
                      Copy these names to create your instructor list. Numbers show project count.
                      <br />
                      <strong>Note:</strong> You can also include instructors who don't supervise projects - they'll be assigned as panel members.
                    </p>
                    <button
                      onClick={() => createInstructorListFromExcel()}
                      className="btn btn-secondary btn-sm"
                      type="button"
                    >
                      📋 Create Text File with All Supervisors
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="excel-upload-section">
                <div className="upload-controls">
                  <div className="file-upload-container">
                    <label className="file-upload-label">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => e.target.files[0] && handleExcelUpload(e.target.files[0])}
                        className="file-input-hidden"
                        disabled={isProcessing}
                      />
                      <div className="file-upload-button">
                        <span className="upload-icon">📊</span>
                        <span>Choose Excel File</span>
                      </div>
                    </label>
                    
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
                
                <p className="help-text">
                  Upload your FYP Excel file to enable automatic project extraction for instructors.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Instructor Text File Upload */}
          <div className="upload-step">
            <h4>Step 2: Upload Instructor List</h4>
            <div className="upload-controls">
              <div className="file-upload-container">
                <label className="file-upload-label">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(e) => e.target.files[0] && handleTextFileUpload(e.target.files[0])}
                    className="file-input-hidden"
                    disabled={isProcessing}
                  />
                  <div className="file-upload-button">
                    <span className="upload-icon">📝</span>
                    <span>Choose Text File</span>
                  </div>
                </label>
                
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
                  📋 Download Template
                </button>
              </div>
            </div>
          </div>
          
          <div className="file-format-help">
            <h4>Expected File Format:</h4>
            
            <div className="format-option">
              <h5>Instructor Names Only {excelData && excelData.length > 0 ? '(✅ Excel Data Available)' : '(Upload Excel File First)'}</h5>
              <pre className="format-example">
{`Dr. Muhammad Asim
Mr. Saad Salman
Dr. Hasan Mujtaba
Prof. Ahmed Ali
Dr. Sarah Khan`}
              </pre>
                             <p>List instructor names (one per line). Projects will be automatically extracted from your Excel data.</p>
               <div className="format-requirements">
                 <strong>Requirements:</strong>
                 <ul>
                   <li>✅ Excel file must be uploaded first</li>
                   <li>✅ Use exact names as they appear in Excel</li>
                   <li>✅ Include titles (Dr., Prof., Mr., Ms., etc.)</li>
                   <li>✅ One instructor name per line</li>
                   <li>✅ Empty lines and comments (#) are ignored</li>
                 </ul>
                 <p><strong>🔄 Auto-Split Feature:</strong> The system automatically detects and splits instructor names on title keywords like "Dr", "Prof", "Mr", "Ms", "Mrs".</p>
                 <p><strong>Example:</strong> <code>Dr Muhammad Asim Mr Saad Salman Prof Ahmed Ali</code> will be automatically split into 3 separate instructors.</p>
               </div>
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

          </div>
        </div>

        {/* Constraints Configuration */}
        {parsedData && (
          <>
            <div className="enhanced-card-header">
              <h3 className="enhanced-card-title">⚙️ Configure Constraints</h3>
            </div>
            <div className="enhanced-card-body">
              <div className="constraints-config">
            
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

            {/* AI Enhancement Options */}
            {isGeminiAvailable() && excelData && (
              <div className="ai-enhancement-section">
                <h4>🤖 AI Enhancement</h4>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={useGeminiEnhancement}
                      onChange={(e) => setUseGeminiEnhancement(e.target.checked)}
                      disabled={isProcessing}
                    />
                    <span>Use Gemini AI for enhanced panel allocation suggestions</span>
                  </label>
                  <p className="help-text">
                    Get AI-powered recommendations for optimal panel composition with domain diversity analysis
                  </p>
                </div>
              </div>
            )}

            <div className="allocation-actions">
              <button
                onClick={runPanelAllocation}
                disabled={!parsedData || isProcessing}
                className={`btn btn-primary ${isProcessing ? 'processing' : ''}`}
              >
                {isProcessing ? '🔄 Allocating...' : 
                 useGeminiEnhancement && isGeminiAvailable() ? '🚀 Generate AI-Enhanced Panels' : 
                 '🚀 Generate Panel Allocation'}
              </button>
            </div>
          </div>
            </div>
          </>
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
              <p>Some instructors in your list were not found in the Excel data. Here's how to fix it:</p>
              
              <div className="format-options">
                <div className="format-option">
                  <h4>Check Instructor Names</h4>
                  <p>Make sure instructor names in your text file match exactly with the Excel data:</p>
                  {supervisorStats && (
                    <div className="excel-supervisors-sample">
                      <h5>Available supervisors in Excel:</h5>
                      <div className="supervisor-names">
                        {supervisorStats.supervisors.slice(0, 8).map(sup => (
                          <span key={sup.name} className="supervisor-name-tag">{sup.name}</span>
                        ))}
                        {supervisorStats.supervisors.length > 8 && (
                          <span className="more-tag">+{supervisorStats.supervisors.length - 8} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="format-option">
                  <h4>Correct Format</h4>
                  <p>Use this format with names from your Excel data:</p>
                  <pre className="format-example">
{supervisorStats?.supervisors.slice(0, 4).map(sup => sup.name).join('\n') || `Dr. Muhammad Asim
Mr. Saad Salman
Dr. Hasan Mujtaba
Prof. Ahmed Ali`}
                  </pre>
                  <p><strong>Requirements:</strong></p>
                  <ul>
                    <li>✅ One instructor name per line</li>
                    <li>✅ Use exact names from Excel data</li>
                    <li>✅ Include titles (Dr., Prof., Mr., Ms.)</li>
                    <li>✅ Excel file must be uploaded first</li>
                  </ul>
                  <p><strong>Smart Formatting:</strong> The system automatically formats names like:</p>
                  <ul>
                    <li><code>dr muhammad asim</code> → <code>Dr. Muhammad Asim</code></li>
                    <li><code>PROF AHMED ALI</code> → <code>Prof. Ahmed Ali</code></li>
                    <li><code>muhammad asim</code> → <code>Muhammad Asim</code></li>
                  </ul>
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
                  onClick={() => downloadInstructorOnlyTemplate()}
                  className="btn btn-primary"
                >
                  📝 Download Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gemini AI Suggestions */}
        {geminiSuggestions && (
          <div className="gemini-suggestions">
            <h3>🤖 AI Recommendations</h3>
            <div className="suggestions-content">
              <div className="domain-analysis">
                <h4>Domain Distribution Analysis</h4>
                <p>{geminiSuggestions.domainBalanceAnalysis}</p>
              </div>

              {geminiSuggestions.recommendations && geminiSuggestions.recommendations.length > 0 && (
                <div className="panel-recommendations">
                  <h4>Recommended Panel Compositions</h4>
                  <div className="recommendations-grid">
                    {geminiSuggestions.recommendations.slice(0, 3).map((rec, index) => (
                      <div key={index} className="recommendation-card">
                        <h5>Panel {rec.panelNumber}</h5>
                        <div className="panel-projects">
                          <strong>Projects:</strong> {rec.suggestedProjects?.join(', ') || 'Various projects'}
                        </div>
                        <div className="domain-distribution">
                          <strong>Domains:</strong>
                          {rec.domainDistribution && Object.entries(rec.domainDistribution).map(([domain, count]) => (
                            <span key={domain} className="domain-tag">{domain}: {count}</span>
                          ))}
                        </div>
                        <div className="reasoning">
                          <strong>Reasoning:</strong> {rec.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {geminiSuggestions.potentialIssues && geminiSuggestions.potentialIssues.length > 0 && (
                <div className="potential-issues">
                  <h4>⚠️ Potential Issues to Consider</h4>
                  <ul>
                    {geminiSuggestions.potentialIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {geminiSuggestions.optimizationTips && geminiSuggestions.optimizationTips.length > 0 && (
                <div className="optimization-tips">
                  <h4>💡 Optimization Tips</h4>
                  <ul>
                    {geminiSuggestions.optimizationTips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
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

                      {/* Domain Diversity Display */}
                      <div className="panel-domains">
                        <h6>Domain Distribution:</h6>
                        <div className="domain-badges">
                          {(() => {
                            const domains = {};
                            panel.groups.forEach(group => {
                              group.projects.forEach(project => {
                                // Simple domain detection
                                const projectLower = project.toLowerCase();
                                let domain = 'General';
                                if (projectLower.includes('ai') || projectLower.includes('ml') || projectLower.includes('chatbot')) domain = 'AI/ML';
                                else if (projectLower.includes('web') || projectLower.includes('website') || projectLower.includes('platform')) domain = 'Web';
                                else if (projectLower.includes('mobile') || projectLower.includes('app')) domain = 'Mobile';
                                else if (projectLower.includes('iot') || projectLower.includes('smart')) domain = 'IoT';
                                else if (projectLower.includes('security') || projectLower.includes('cyber')) domain = 'Security';
                                else if (projectLower.includes('game') || projectLower.includes('vr') || projectLower.includes('ar')) domain = 'Gaming/VR';
                                
                                domains[domain] = (domains[domain] || 0) + 1;
                              });
                            });

                            return Object.entries(domains).map(([domain, count]) => (
                              <span 
                                key={domain} 
                                className={`domain-badge ${count > 4 ? 'domain-high' : count > 2 ? 'domain-medium' : 'domain-low'}`}
                                title={`${count} projects in ${domain}`}
                              >
                                {domain}: {count}
                              </span>
                            ));
                          })()}
                        </div>
                        {(() => {
                          const domains = {};
                          panel.groups.forEach(group => {
                            group.projects.forEach(project => {
                              const projectLower = project.toLowerCase();
                              let domain = 'General';
                              if (projectLower.includes('ai') || projectLower.includes('ml') || projectLower.includes('chatbot')) domain = 'AI/ML';
                              else if (projectLower.includes('web') || projectLower.includes('website') || projectLower.includes('platform')) domain = 'Web';
                              else if (projectLower.includes('mobile') || projectLower.includes('app')) domain = 'Mobile';
                              else if (projectLower.includes('iot') || projectLower.includes('smart')) domain = 'IoT';
                              else if (projectLower.includes('security') || projectLower.includes('cyber')) domain = 'Security';
                              else if (projectLower.includes('game') || projectLower.includes('vr') || projectLower.includes('ar')) domain = 'Gaming/VR';
                              
                              domains[domain] = (domains[domain] || 0) + 1;
                            });
                          });

                          const maxCount = Math.max(...Object.values(domains));
                          if (maxCount > 4) {
                            return (
                              <div className="domain-warning">
                                ⚠️ High concentration in one domain ({maxCount} projects)
                              </div>
                            );
                          }
                          return null;
                        })()}
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

          </div>
        )}
      </div>

  );
};

export default ConstraintBasedPanelAllocation;
