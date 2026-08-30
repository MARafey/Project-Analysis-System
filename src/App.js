import React, { useState, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GraduationCap, Upload, Download, BarChart3, Users, Search, Layers, FileSpreadsheet } from 'lucide-react';

// Utils
import { readExcelFile, exportDomainCategorization, exportSimilarityAnalysis, exportCombinedReports } from './utils/excelUtils';
import { TFIDFVectorizer, cosineSimilarity, categorizeByKeywords, generateSimilarityExplanation, getSimilarityLevel } from './utils/textProcessing';
import { isGeminiAvailable, batchCategorizeWithGemini, batchAnalyzeSimilarityWithGemini } from './utils/geminiApi';
import { getModelEndpointConfig, getActiveProviderName } from './utils/modelApi';

// Components
import PanelAllocation from './components/PanelAllocation';
import ConstraintBasedPanelAllocation from './components/ConstraintBasedPanelAllocation';

function App() {
  // State management
  const [activeTab, setActiveTab] = useState('analysis');
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [error, setError] = useState(null);
  const [projectsData, setProjectsData] = useState([]);
  const [domainResults, setDomainResults] = useState([]);
  const [similarityResults, setSimilarityResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentProject, setCurrentProject] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [useGemini] = useState(() => !!getModelEndpointConfig());
  const [showPanelAllocation, setShowPanelAllocation] = useState(false);
  const [useGeminiForSimilarity] = useState(true);

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    setError(null);
    setCurrentStep(1);
    setAnalysisStatus('Reading Excel file...');

    try {
      const result = await readExcelFile(file);
      setProjectsData(result.data);
      setTotalProjects(result.totalProjects);
      
      toast.success(`Successfully loaded ${result.totalProjects} projects`);
      setAnalysisStatus(`Loaded ${result.totalProjects} projects successfully`);
      
      setTimeout(() => {
        setCurrentStep(0);
        setAnalysisStatus('');
      }, 2000);
      
    } catch (err) {
      setError(err.message);
      setCurrentStep(0);
      setAnalysisStatus('');
      toast.error(`Failed to load file: ${err.message}`);
    }
  }, []);

  // Main analysis function
  const runAnalysis = useCallback(async () => {
    if (projectsData.length === 0) {
      toast.error('Please upload a file first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCurrentProject(0);
    
    try {
      // Step 2: Domain Categorization
      setCurrentStep(2);
      setAnalysisStatus('Categorizing projects by domains...');
      
      const domainResults = [];
      
      if (useGemini && isGeminiAvailable()) {
        // Use Gemini AI for categorization
        setAnalysisStatus(`Using ${getActiveProviderName()} for intelligent categorization...`);
        
        const geminiResults = await batchCategorizeWithGemini(
          projectsData,
          (current, total, projectId) => {
            setCurrentProject(current);
            setAnalysisStatus(`Analyzing project ${current}/${total} with ${getActiveProviderName()}: ${projectId}`);
          }
        );

        geminiResults.forEach((result, index) => {
          const project = projectsData[index];
          let projectResult;

          if (result.result.success) {
            const geminiData = result.result.data;
            const domains = geminiData.domains.map(d => d.name);
            
            projectResult = {
              projectId: project.projectId,
              projectTitle: project.projectTitle,
              projectScope: project.projectScope,
              domains: domains,
              primaryDomain: geminiData.primary_domain || domains[0],
              keyPoints: geminiData.keyPoints || '',
              summary: geminiData.summary || '',
              confidenceScores: geminiData.domains.reduce((acc, d) => {
                acc[d.name] = {
                  score: d.confidence,
                  reasoning: d.reasoning,
                  method: 'gemini_ai'
                };
                return acc;
              }, {}),
              categorizationMethod: 'gemini_ai',
              maxConfidenceScore: Math.max(...geminiData.domains.map(d => d.confidence))
            };
          } else {
            // Fallback to keyword matching
            const keywordResult = categorizeByKeywords(project.projectTitle, project.projectScope);
            projectResult = {
              projectId: project.projectId,
              projectTitle: project.projectTitle,
              projectScope: project.projectScope,
              domains: keywordResult.domains,
              primaryDomain: keywordResult.primaryDomain,
              confidenceScores: keywordResult.confidenceScores,
              categorizationMethod: 'keyword_matching',
              maxConfidenceScore: Math.max(...Object.values(keywordResult.confidenceScores).map(c => c.score))
            };
          }

          domainResults.push(projectResult);
        });
      } else {
        // Use keyword-based categorization
        setAnalysisStatus('Using keyword-based categorization...');
        
        projectsData.forEach((project, index) => {
          setCurrentProject(index + 1);
          setAnalysisStatus(`Categorizing project ${index + 1}/${projectsData.length}: ${project.projectId}`);
          
          const result = categorizeByKeywords(project.projectTitle, project.projectScope);
          
          domainResults.push({
            projectId: project.projectId,
            projectTitle: project.projectTitle,
            projectScope: project.projectScope,
            domains: result.domains,
            primaryDomain: result.primaryDomain,
            confidenceScores: result.confidenceScores,
            categorizationMethod: 'keyword_matching',
            maxConfidenceScore: Math.max(...Object.values(result.confidenceScores).map(c => c.score))
          });
        });
      }

      setDomainResults(domainResults);
      
      // Step 3: Similarity Analysis
      setCurrentStep(3);
      setAnalysisStatus('Calculating project similarities...');
      
      let similarityResults = [];
      
      if (useGemini && isGeminiAvailable() && useGeminiForSimilarity) {
        // Use Gemini AI for enhanced similarity analysis
        setAnalysisStatus(`Using ${getActiveProviderName()} for collision detection (pre-filtered candidate pairs)...`);
        
        try {
          similarityResults = await batchAnalyzeSimilarityWithGemini(
            domainResults,
            (current, total, comparison) => {
              setAnalysisStatus(`Analyzing similarities ${current}/${total}: ${comparison}`);
            }
          );
        } catch (error) {
          console.error('Gemini similarity analysis failed, falling back to TF-IDF:', error);
          toast.warning('Gemini analysis failed, using TF-IDF fallback');
          // Use TF-IDF fallback for this analysis
        }
      }
      
      if (!useGeminiForSimilarity || similarityResults.length === 0) {
        // Use traditional TF-IDF analysis
        setAnalysisStatus('Using TF-IDF similarity analysis...');
        
        const texts = projectsData.map(p => `${p.projectTitle} ${p.projectScope}`);
        const vectorizer = new TFIDFVectorizer({ maxFeatures: 1000, minDf: 1, maxDf: 0.95 });
        const tfidfVectors = vectorizer.fitTransform(texts);
        
        const threshold = 0.3;
        
        for (let i = 0; i < tfidfVectors.length; i++) {
          for (let j = i + 1; j < tfidfVectors.length; j++) {
            const similarity = cosineSimilarity(tfidfVectors[i], tfidfVectors[j]);
            
            if (similarity > threshold) {
              const project1 = domainResults[i];
              const project2 = domainResults[j];
              
              const overlappingDomains = project1.domains.filter(d => project2.domains.includes(d));
              const similarityLevel = getSimilarityLevel(similarity);
              
              const explanation = generateSimilarityExplanation(
                project1.projectId,
                project2.projectId,
                similarity,
                overlappingDomains,
                texts[i],
                texts[j]
              );
              
              similarityResults.push({
                project1Id: project1.projectId,
                project2Id: project2.projectId,
                similarityScore: similarity,
                similarityLevel,
                overlappingDomains,
                explanation,
                analysisMethod: 'tfidf'
              });
            }
          }
        }
        
        // Sort by similarity score (descending)
        similarityResults.sort((a, b) => b.similarityScore - a.similarityScore);
      }
      
      setSimilarityResults(similarityResults);
      
      // Step 4: Complete
      setCurrentStep(4);
      setAnalysisStatus('Analysis completed successfully!');
      
      toast.success(`Analysis complete! Found ${similarityResults.length} similar project pairs.`);
      
      setTimeout(() => {
        setCurrentStep(0);
        setIsAnalyzing(false);
        setAnalysisStatus('');
      }, 2000);
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
      setCurrentStep(0);
      setIsAnalyzing(false);
      setAnalysisStatus('');
      toast.error(`Analysis failed: ${err.message}`);
    }
  }, [projectsData, useGemini, useGeminiForSimilarity]);

  // Download handlers
  const handleDownloadDomains = useCallback(() => {
    const success = exportDomainCategorization(domainResults);
    if (success) {
      toast.success('Domain categorization report downloaded!');
    } else {
      toast.error('Failed to download domain report');
    }
  }, [domainResults]);

  const handleDownloadSimilarity = useCallback(() => {
    const success = exportSimilarityAnalysis(similarityResults);
    if (success) {
      toast.success('Similarity analysis report downloaded!');
    } else {
      toast.error('Failed to download similarity report');
    }
  }, [similarityResults]);

  const handleDownloadCombined = useCallback(() => {
    const success = exportCombinedReports(domainResults, similarityResults);
    if (success) {
      toast.success('Complete analysis report downloaded!');
    } else {
      toast.error('Failed to download combined report');
    }
  }, [domainResults, similarityResults]);

  // Removed unused handlePanelAllocationComplete function

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <div className="logo">
                <GraduationCap size={20} aria-hidden="true" />
              </div>
              <div>
                <h1 className="header-title">FYP Analysis System</h1>
                <p className="header-subtitle">Analyze and categorize Final Year Projects</p>
              </div>
            </div>

          </div>

          <nav className="header-nav" role="tablist" aria-label="Main sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analysis'}
              className={`nav-tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              Project analysis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'panels'}
              className={`nav-tab ${activeTab === 'panels' ? 'active' : ''}`}
              onClick={() => setActiveTab('panels')}
            >
              Panel creation
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {activeTab === 'analysis' && (
          <>
          {/* File Upload Section */}
          {!isAnalyzing && projectsData.length === 0 && (
            <div className="upload-section">
              <div className="upload-area">
                <div className="upload-icon">
                  <Upload size={24} aria-hidden="true" />
                </div>
                <h3>Upload project data</h3>
                <p>Drag and drop your Excel file here, or click to select</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                  className="file-input"
                />
              </div>
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Project Summary */}
          {projectsData.length > 0 && !isAnalyzing && (
            <div className="card">
              <div className="summary-content">
                <div>
                  <h3>Data loaded</h3>
                  <p>
                    {totalProjects} projects ready for analysis
                    {useGemini && isGeminiAvailable() && (
                      <span className="ai-badge">
                        Model-assisted
                      </span>
                    )}
                  </p>
                </div>
                
                <button
                  onClick={runAnalysis}
                  className="btn btn-primary"
                >
                  Start analysis
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Progress Tracker */}
          {isAnalyzing && (
            <div className="enhanced-card">
              <div className="enhanced-card-header">
                <h3 className="enhanced-card-title">Analysis in progress</h3>
              </div>
              <div className="enhanced-card-body">
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">{analysisStatus}</div>
                  <div className="loading-subtext">
                    {currentStep === 1 && 'Categorizing projects by domain...'}
                    {currentStep === 2 && 'Analyzing project similarities...'}
                    {currentStep === 3 && 'Generating suggestions...'}
                    {currentStep === 4 && 'Finalizing results...'}
                  </div>
                  
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${(currentStep / 4) * 100}%` }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      <span>Step {currentStep} of 4</span>
                      <span className="progress-percentage">{Math.round((currentStep / 4) * 100)}%</span>
                    </div>
                  </div>

                  <div className="progress-steps">
                    <div className={`progress-step ${currentStep >= 1 ? 'completed' : ''}`}>
                      <div className="progress-step-icon">1</div>
                      <div className="progress-step-text">Domain Categorization</div>
                    </div>
                    <div className={`progress-step ${currentStep >= 2 ? 'completed' : currentStep === 1 ? 'active' : ''}`}>
                      <div className="progress-step-icon">2</div>
                      <div className="progress-step-text">Similarity Analysis</div>
                    </div>
                    <div className={`progress-step ${currentStep >= 3 ? 'completed' : currentStep === 2 ? 'active' : ''}`}>
                      <div className="progress-step-icon">3</div>
                      <div className="progress-step-text">Suggestions</div>
                    </div>
                    <div className={`progress-step ${currentStep >= 4 ? 'completed' : currentStep === 3 ? 'active' : ''}`}>
                      <div className="progress-step-icon">4</div>
                      <div className="progress-step-text">Results Generation</div>
                    </div>
                  </div>

                  {currentProject > 0 && totalProjects > 0 && (
                    <div className="project-progress">
                      <p className="progress-detail">
                        Processing project {currentProject} of {totalProjects}
                      </p>
                      <div className="mini-progress">
                        <div className="mini-progress-bar">
                          <div 
                            className="mini-progress-fill" 
                            style={{ width: `${(currentProject / totalProjects) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {domainResults.length > 0 && similarityResults.length >= 0 && !isAnalyzing && (
            <div className="results-section">
              <div className="results-header">
                <h2>Analysis results</h2>
                <div className="download-actions">
                  <button
                    onClick={handleDownloadDomains}
                    className="btn btn-secondary"
                  >
                    <Download size={16} aria-hidden="true" />
                    Download domain report
                  </button>

                  <button
                    onClick={handleDownloadSimilarity}
                    className="btn btn-secondary"
                  >
                    <Download size={16} aria-hidden="true" />
                    Download similarity report
                  </button>

                  <button
                    onClick={handleDownloadCombined}
                    className="btn btn-primary"
                  >
                    <Download size={16} aria-hidden="true" />
                    Download complete report
                  </button>

                  <button
                    onClick={() => setShowPanelAllocation(!showPanelAllocation)}
                    className="btn btn-secondary"
                  >
                    {showPanelAllocation ? 'Hide' : 'Show'} panel allocation
                  </button>

                  <button
                    onClick={() => setActiveTab('panels')}
                    className="btn btn-primary"
                  >
                    Generate panels
                  </button>
                </div>
              </div>

              <div className="results-summary">
                <div className="summary-card">
                  <h4>Total Projects</h4>
                  <p className="summary-number">{domainResults.length}</p>
                </div>
                <div className="summary-card">
                  <h4>Unique Domains</h4>
                  <p className="summary-number">
                    {new Set(domainResults.flatMap(p => Array.isArray(p.domains) ? p.domains : [p.domains])).size}
                  </p>
                </div>
                <div className="summary-card">
                  <h4>Similar Pairs</h4>
                  <p className="summary-number">{similarityResults.length}</p>
                </div>
              </div>

              <div className="results-content">
                <h3>Domain categorization</h3>
                <div className="table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>Title</th>
                        <th>Primary Domain</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainResults.slice(0, 10).map((project, index) => (
                        <tr key={index}>
                          <td>{project.projectId}</td>
                          <td>{project.projectTitle}</td>
                          <td>{project.primaryDomain}</td>
                          <td>
                            <span className={`method-badge ${project.categorizationMethod}`}>
                              {project.categorizationMethod === 'gemini_ai' ? 'Model' : 'Keywords'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {domainResults.length > 10 && (
                    <p className="table-note">
                      Showing first 10 results. Download the complete report for all {domainResults.length} projects.
                    </p>
                  )}
                </div>
              </div>

              {/* Similarity Results */}
              {similarityResults.length > 0 && (
                <div className="results-content">
                  <h3>Similarity analysis</h3>
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Project 1</th>
                          <th>Project 2</th>
                          <th>Similarity</th>
                          <th>Level</th>
                          <th>Method</th>
                          <th>Specific Reasons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {similarityResults.slice(0, 10).map((pair, index) => (
                          <tr key={index}>
                            <td>{pair.project1Id}</td>
                            <td>{pair.project2Id}</td>
                            <td>{(pair.similarityScore * 100).toFixed(1)}%</td>
                            <td>
                              <span className={`method-badge similarity-${pair.similarityLevel.toLowerCase().replace(' ', '-')}`}>
                                {pair.similarityLevel}
                              </span>
                            </td>
                            <td>
                              <span className={`method-badge ${pair.analysisMethod === 'gemini_ai' ? 'gemini-ai' : 'tfidf'}`}>
                                {pair.analysisMethod === 'gemini_ai' ? 'Model' : 'TF-IDF'}
                              </span>
                            </td>
                            <td title={pair.explanation}>
                              {/* Extract and show first few specific reasons */}
                              {(() => {
                                const lines = pair.explanation.split('\n');
                                const reasons = lines.filter(line => line.trim().startsWith('✓')).slice(0, 2);
                                return reasons.length > 0
                                  ? reasons.map(reason => reason.trim().substring(2)).join('; ') + (lines.filter(line => line.trim().startsWith('✓')).length > 2 ? '...' : '')
                                  : pair.explanation.substring(0, 100) + '...';
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {similarityResults.length > 10 && (
                      <p className="table-note">
                        Showing first 10 similarity pairs. Download the complete report for all {similarityResults.length} pairs.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Panel Allocation Section */}
              {showPanelAllocation && (
                <PanelAllocation
                  projects={domainResults}
                  similarityResults={similarityResults}
                />
              )}
            </div>
          )}

          {/* Instructions - Only show when no data is loaded and not analyzing */}
          {projectsData.length === 0 && !isAnalyzing && (
            <div className="instructions">
              <h2>What this tool does</h2>

              <div className="systems-overview">
                <div className="system-card">
                  <div className="system-icon">
                    <BarChart3 size={20} aria-hidden="true" />
                  </div>
                  <h3>Project analysis</h3>
                  <p>Analyze project data for domain categorization and similarity detection</p>
                  <div className="system-features">
                    <div className="feature">Domain categorization</div>
                    <div className="feature">Similarity detection between projects</div>
                    <div className="feature">Multi-sheet Excel reports</div>
                    <div className="feature">Support for large datasets</div>
                  </div>
                  <div className="system-action">
                    Upload your Excel file above to get started.
                  </div>
                </div>

                <div className="system-card">
                  <div className="system-icon">
                    <Users size={20} aria-hidden="true" />
                  </div>
                  <h3>Panel creation</h3>
                  <p>Create evaluation panels with instructor-project constraint management</p>
                  <div className="system-features">
                    <div className="feature">Text file input for instructor-project mapping</div>
                    <div className="feature">Hard and soft constraint management</div>
                    <div className="feature">Automatic overlap detection</div>
                    <div className="feature">Optimized instructor assignment</div>
                  </div>
                  <div className="system-action">
                    Use the Panel creation tab above.
                  </div>
                </div>
              </div>

              <div className="getting-started">
                <h3>Getting started</h3>
                <div className="instructions-grid">
                  <div className="instruction-step">
                    <div className="step-number">1</div>
                    <p>Use FYP Analysis for project similarity analysis, or Panel Creation for organizing evaluation panels.</p>
                  </div>
                  
                  <div className="instruction-step">
                    <div className="step-number">2</div>
                    <p>Excel files for FYP analysis, or text files with instructor-project mappings for panel creation.</p>
                  </div>
                  
                  <div className="instruction-step">
                    <div className="step-number">3</div>
                    <p>Download comprehensive reports with all analysis results and panel allocations.</p>
                  </div>
                </div>
              </div>
              
              <div className="pro-tip">
                <p><strong>Note:</strong> classification and collision detection run automatically — upload your Excel file and start the analysis.</p>
              </div>

              <div className="feature-highlights">
                <h3>Key features</h3>
                <div className="features-grid">
                  <div className="feature-item">
                    <span className="feature-icon">
                      <Layers size={18} aria-hidden="true" />
                    </span>
                    <h4>Automatic categorization</h4>
                    <p>Projects are categorized by domain from their title and scope</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">
                      <BarChart3 size={18} aria-hidden="true" />
                    </span>
                    <h4>15+ domain categories</h4>
                    <p>Categorization across AI/ML, web development, IoT, cybersecurity, and more</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">
                      <Search size={18} aria-hidden="true" />
                    </span>
                    <h4>Similarity detection</h4>
                    <p>TF-IDF analysis to find similar projects with detailed explanations</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">
                      <FileSpreadsheet size={18} aria-hidden="true" />
                    </span>
                    <h4>Multi-sheet reports</h4>
                    <p>Excel reports organized by domains and similarity levels</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
          )}

          {/* Panel Creation tab */}
          {activeTab === 'panels' && (
            <div className="panel-creation-section">
              <div className="card">
                <div className="panel-creation-header">
                  <h2>Panel creation</h2>
                  <p className="section-description">
                    Create evaluation panels from instructor-project data using constraint-based allocation.{' '}
                    {projectsData.length === 0 ?
                      'You can use this independently or run FYP analysis first for similarity-based grouping.' :
                      'FYP analysis complete - you can now create optimized panels with similarity data.'
                    }
                  </p>
                </div>

                <ConstraintBasedPanelAllocation
                  similarityResults={similarityResults}
                  hasFYPAnalysis={similarityResults && similarityResults.length > 0}
                  excelData={projectsData}
                  domainResults={domainResults}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}

export default App; 