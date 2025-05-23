import React, { useState, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Utils
import { readExcelFile, exportDomainCategorization, exportSimilarityAnalysis, exportCombinedReports, createSampleExcelFile } from './utils/excelUtils';
import { TFIDFVectorizer, cosineSimilarity, categorizeByKeywords, generateSimilarityExplanation, getSimilarityLevel } from './utils/textProcessing';
import { initializeGemini, isGeminiAvailable, batchCategorizeWithGemini } from './utils/geminiApi';

function App() {
  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [error, setError] = useState(null);
  const [projectsData, setProjectsData] = useState([]);
  const [domainResults, setDomainResults] = useState([]);
  const [similarityResults, setSimilarityResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentProject, setCurrentProject] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [useGemini, setUseGemini] = useState(false);

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

  // Initialize Gemini AI
  const handleGeminiSetup = useCallback(() => {
    if (!geminiApiKey.trim()) {
      toast.error('Please enter a valid Gemini API key');
      return;
    }

    const success = initializeGemini(geminiApiKey);
    if (success) {
      setUseGemini(true);
      setShowSettings(false);
      toast.success('Gemini AI initialized successfully!');
    } else {
      toast.error('Failed to initialize Gemini AI. Please check your API key.');
    }
  }, [geminiApiKey]);

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
        setAnalysisStatus('Using Gemini AI for intelligent categorization...');
        
        const geminiResults = await batchCategorizeWithGemini(
          projectsData,
          (current, total, projectId) => {
            setCurrentProject(current);
            setAnalysisStatus(`Analyzing project ${current}/${total} with Gemini AI: ${projectId}`);
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
      
      const texts = projectsData.map(p => `${p.projectTitle} ${p.projectScope}`);
      const vectorizer = new TFIDFVectorizer({ maxFeatures: 1000, minDf: 1, maxDf: 0.95 });
      const tfidfVectors = vectorizer.fitTransform(texts);
      
      const similarityResults = [];
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
              explanation
            });
          }
        }
      }
      
      // Sort by similarity score (descending)
      similarityResults.sort((a, b) => b.similarityScore - a.similarityScore);
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
  }, [projectsData, useGemini]);

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

  const handleCreateSample = useCallback(() => {
    createSampleExcelFile();
    toast.success('Sample Excel file created and downloaded!');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <div className="logo">
                <span className="logo-icon">🎓</span>
              </div>
              <div>
                <h1 className="header-title">FYP Analysis System</h1>
                <p className="header-subtitle">Analyze and categorize Final Year Projects</p>
              </div>
            </div>
            
            <div className="header-actions">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn btn-secondary"
              >
                ⚙️ Settings
              </button>
              
              <button
                onClick={handleCreateSample}
                className="btn btn-secondary"
              >
                📥 Sample Data
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* Settings Panel */}
          {showSettings && (
            <div className="card settings-panel">
              <h3 className="settings-title">
                ✨ AI Configuration
              </h3>
              
              <div className="form-group">
                <label className="form-label">
                  Gemini API Key (Optional)
                </label>
                <div className="input-group">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key for AI-powered analysis"
                    className="form-input"
                  />
                  <button
                    onClick={handleGeminiSetup}
                    disabled={!geminiApiKey.trim()}
                    className="btn btn-primary"
                  >
                    Setup AI
                  </button>
                </div>
                
                {useGemini && isGeminiAvailable() && (
                  <div className="success-message">
                    <p>✅ Gemini AI is active and ready</p>
                  </div>
                )}
                
                <p className="help-text">
                  Get your free API key from{' '}
                  <a 
                    href="https://makersuite.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="link"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          {!isAnalyzing && projectsData.length === 0 && (
            <div className="upload-section">
              <div className="upload-area">
                <div className="upload-icon">📁</div>
                <h3>Upload FYP Data File</h3>
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
                  <p>❌ {error}</p>
                </div>
              )}
            </div>
          )}

          {/* Project Summary */}
          {projectsData.length > 0 && !isAnalyzing && (
            <div className="card">
              <div className="summary-content">
                <div>
                  <h3>Data Loaded</h3>
                  <p>
                    {totalProjects} projects ready for analysis
                    {useGemini && isGeminiAvailable() && (
                      <span className="ai-badge">
                        ✨ AI Enhanced
                      </span>
                    )}
                  </p>
                </div>
                
                <button
                  onClick={runAnalysis}
                  className="btn btn-primary"
                >
                  Start Analysis
                </button>
              </div>
            </div>
          )}

          {/* Progress Tracker */}
          {isAnalyzing && (
            <div className="card">
              <h3>Analysis Progress</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                ></div>
              </div>
              <p className="progress-text">{analysisStatus}</p>
              {currentProject > 0 && totalProjects > 0 && (
                <p className="progress-detail">
                  Processing project {currentProject} of {totalProjects}
                </p>
              )}
            </div>
          )}

          {/* Results Display */}
          {domainResults.length > 0 && similarityResults.length >= 0 && !isAnalyzing && (
            <div className="results-section">
              <div className="results-header">
                <h2>Analysis Results</h2>
                <div className="download-actions">
                  <button 
                    onClick={handleDownloadDomains}
                    className="btn btn-secondary"
                  >
                    📊 Download Domain Report
                  </button>
                  
                  <button 
                    onClick={handleDownloadSimilarity}
                    className="btn btn-secondary"
                  >
                    🔍 Download Similarity Report
                  </button>
                  
                  <button 
                    onClick={handleDownloadCombined}
                    className="btn btn-primary"
                  >
                    📋 Download Complete Report
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
                <h3>Domain Categorization Results</h3>
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
                              {project.categorizationMethod === 'gemini_ai' ? 'AI' : 'Keywords'}
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
                  <h3>Project Similarity Analysis</h3>
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Project 1</th>
                          <th>Project 2</th>
                          <th>Similarity</th>
                          <th>Level</th>
                          <th>Explanation</th>
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
                            <td title={pair.explanation}>
                              {pair.explanation.substring(0, 100)}...
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
            </div>
          )}

          {/* Instructions */}
          {projectsData.length === 0 && !isAnalyzing && (
            <div className="instructions">
              <h2>How to Use the FYP Analysis System</h2>
              <div className="instructions-grid">
                <div className="instruction-step">
                  <div className="step-number">1</div>
                  <h3>Upload Data</h3>
                  <p>Upload your Excel file containing FYP project data with titles and descriptions. The system accepts .xlsx, .xls, and .csv files.</p>
                </div>
                
                <div className="instruction-step">
                  <div className="step-number">2</div>
                  <h3>Analyze</h3>
                  <p>Our system will automatically categorize projects across 15+ technical domains and find similar projects using advanced TF-IDF analysis.</p>
                </div>
                
                <div className="instruction-step">
                  <div className="step-number">3</div>
                  <h3>Download</h3>
                  <p>Get comprehensive Excel reports with domain categorization, similarity analysis, and detailed explanations for all findings.</p>
                </div>
              </div>
              
              <div className="pro-tip">
                <p>💡 <strong>Pro tip:</strong> Add your Gemini API key in settings for AI-powered domain categorization with detailed explanations and higher accuracy!</p>
              </div>
              
              <div className="feature-highlights">
                <h3>Key Features</h3>
                <div className="features-grid">
                  <div className="feature-item">
                    <span className="feature-icon">🤖</span>
                    <h4>AI-Powered Analysis</h4>
                    <p>Optional Gemini AI integration for intelligent project categorization</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <h4>15+ Domain Categories</h4>
                    <p>Comprehensive categorization across AI/ML, Web Dev, IoT, Cybersecurity, and more</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🔍</span>
                    <h4>Similarity Detection</h4>
                    <p>Advanced TF-IDF analysis to find similar projects with detailed explanations</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📋</span>
                    <h4>Multi-Sheet Reports</h4>
                    <p>Detailed Excel reports organized by domains and similarity levels</p>
                  </div>
                </div>
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