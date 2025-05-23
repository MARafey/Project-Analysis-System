import React, { useState, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GraduationCap, Settings, Download, Sparkles } from 'lucide-react';

// Components
import FileUpload from './components/FileUpload';
import ProgressTracker from './components/ProgressTracker';
import ResultsDisplay from './components/ResultsDisplay';

// Utils
import { readExcelFile, exportDomainCategorization, exportSimilarityAnalysis, exportCombinedReports, createSampleExcelFile } from './utils/excelUtils';
import { TFIDFVectorizer, cosineSimilarity, categorizeByKeywords, generateSimilarityExplanation, getSimilarityLevel } from './utils/textProcessing';
import { initializeGemini, isGeminiAvailable, categorizeWithGemini, batchCategorizeWithGemini } from './utils/geminiApi';

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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <GraduationCap className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FYP Analysis System</h1>
                <p className="text-sm text-gray-600">Analyze and categorize Final Year Projects</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-secondary flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              
              <button
                onClick={handleCreateSample}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Sample Data</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 animate-slide-up">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                <span>AI Configuration</span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini API Key (Optional)
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key for AI-powered analysis"
                      className="flex-1 input-field"
                    />
                    <button
                      onClick={handleGeminiSetup}
                      disabled={!geminiApiKey.trim()}
                      className="btn-primary"
                    >
                      Setup AI
                    </button>
                  </div>
                  
                  {useGemini && isGeminiAvailable() && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">✅ Gemini AI is active and ready</p>
                    </div>
                  )}
                  
                  <p className="mt-2 text-xs text-gray-500">
                    Get your free API key from{' '}
                    <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          {!isAnalyzing && projectsData.length === 0 && (
            <div className="animate-fade-in">
              <FileUpload
                onFileSelect={handleFileUpload}
                isLoading={currentStep === 1}
                error={error}
              />
            </div>
          )}

          {/* Project Summary */}
          {projectsData.length > 0 && !isAnalyzing && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Data Loaded</h3>
                  <p className="text-sm text-gray-600">
                    {totalProjects} projects ready for analysis
                    {useGemini && isGeminiAvailable() && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Enhanced
                      </span>
                    )}
                  </p>
                </div>
                
                <button
                  onClick={runAnalysis}
                  className="btn-primary flex items-center space-x-2"
                >
                  <span>Start Analysis</span>
                </button>
              </div>
            </div>
          )}

          {/* Progress Tracker */}
          {isAnalyzing && (
            <div className="animate-slide-up">
              <ProgressTracker
                currentStep={currentStep}
                totalSteps={4}
                currentProject={currentProject}
                totalProjects={totalProjects}
                status={analysisStatus}
                error={error}
              />
            </div>
          )}

          {/* Results Display */}
          {domainResults.length > 0 && similarityResults.length >= 0 && !isAnalyzing && (
            <div className="animate-fade-in">
              <ResultsDisplay
                domainResults={domainResults}
                similarityResults={similarityResults}
                onDownloadDomains={handleDownloadDomains}
                onDownloadSimilarity={handleDownloadSimilarity}
                onDownloadCombined={handleDownloadCombined}
              />
            </div>
          )}

          {/* Instructions */}
          {projectsData.length === 0 && !isAnalyzing && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center animate-fade-in">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">How to Use</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto">
                      <span className="text-primary-600 font-bold">1</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Upload Data</h3>
                    <p className="text-sm text-gray-600">
                      Upload your Excel file containing FYP project data with titles and descriptions.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto">
                      <span className="text-primary-600 font-bold">2</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Analyze</h3>
                    <p className="text-sm text-gray-600">
                      Our system will categorize projects by domain and find similar projects automatically.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto">
                      <span className="text-primary-600 font-bold">3</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Download</h3>
                    <p className="text-sm text-gray-600">
                      Get comprehensive Excel reports with domain categorization and similarity analysis.
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-primary-50 rounded-lg">
                  <p className="text-sm text-primary-700">
                    💡 <strong>Pro tip:</strong> Add your Gemini API key in settings for AI-powered domain categorization with detailed explanations!
                  </p>
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