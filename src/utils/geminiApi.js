import { GoogleGenerativeAI } from '@google/generative-ai';
import { DOMAIN_KEYWORDS } from './textProcessing';

let genAI = null;
let model = null;

// Initialize Gemini AI
export function initializeGemini(apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
    return false;
  }
}

// Check if Gemini is available
export function isGeminiAvailable() {
  return model !== null;
}

// Categorize project using Gemini AI
export async function categorizeWithGemini(projectTitle, projectScope) {
  if (!model) {
    throw new Error('Gemini AI not initialized');
  }

  const domainsList = Object.keys(DOMAIN_KEYWORDS);
  const domainsStr = domainsList.join(', ');

  const prompt = `
  You are a domain expert.
Analyze the following Final Year Project (FYP) and categorize it into one or more relevant technical domains.

Project Title: ${projectTitle}
Project Description: ${projectScope}

Available Domains:
${domainsStr}

if in case the project is not related to any of the domains, suggest the what domain it is related to as per your own knowledge.

Instructions:
1. Identify which domains this project belongs to (it can belong to multiple domains)
2. For each relevant domain, provide a confidence score from 1-10
3. Explain why the project fits into each selected domain
4. Consider the technical requirements, methodologies, and objectives
5. Provide a list of domains that the project is related to
6. Provide a summary of the project
7. Provide key points of the project

Respond in JSON format:
{
  "domains": [
    {
      "name": "Domain Name",
      "confidence": 8,
      "reasoning": "Brief explanation why this project fits this domain"
    }
  ],
  "list of domains": [
    "Domain Name",
    "Domain Name",
    "Domain Name"
  ],
  "summary": "Brief overall categorization summary",
  "Key points": "Key points of the project"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Clean up response if it has markdown formatting
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].trim();
    }

    // Parse JSON response
    const parsedResult = JSON.parse(responseText);
    
    // Validate the response structure
    if (!parsedResult.domains || !Array.isArray(parsedResult.domains)) {
      throw new Error('Invalid response structure');
    }

    return {
      success: true,
      data: parsedResult
    };

  } catch (error) {
    console.error('Gemini categorization error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Batch categorize multiple projects
export async function batchCategorizeWithGemini(projects, onProgress) {
  const results = [];
  const total = projects.length;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    
    try {
      // Add small delay to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await categorizeWithGemini(project.projectTitle, project.projectScope);
      
      results.push({
        projectId: project.projectId,
        result: result
      });

      // Call progress callback
      if (onProgress) {
        onProgress(i + 1, total, project.projectId);
      }

    } catch (error) {
      console.error(`Failed to categorize project ${project.projectId}:`, error);
      results.push({
        projectId: project.projectId,
        result: {
          success: false,
          error: error.message
        }
      });
    }
  }

  return results;
}

// Test Gemini API connection
export async function testGeminiConnection() {
  if (!model) {
    return {
      success: false,
      error: 'Gemini AI not initialized'
    };
  }

  try {
    const testPrompt = 'Respond with "Connection successful" if you can see this message.';
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      response: text
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced project similarity analysis using Gemini AI
export async function analyzeProjectSimilarityWithGemini(project1, project2) {
  if (!model) {
    throw new Error('Gemini AI not initialized');
  }

  const prompt = `
You are an expert in Final Year Project analysis. Compare these two projects and provide a detailed similarity analysis.

PROJECT 1:
Title: ${project1.projectTitle}
Scope: ${project1.projectScope}
Key Points: ${project1.keyPoints || 'Not available'}

PROJECT 2:
Title: ${project2.projectTitle}
Scope: ${project2.projectScope}
Key Points: ${project2.keyPoints || 'Not available'}

Analyze the similarity between these projects considering:
1. Technical approach and methodologies
2. Problem domain and application area
3. Technologies and tools used
4. Target audience and use cases
5. Implementation complexity
6. Research goals and objectives

Provide a detailed comparison and similarity score (0.0 to 1.0).

Respond in JSON format:
{
  "similarityScore": 0.75,
  "similarityLevel": "High",
  "technicalSimilarity": 0.8,
  "domainSimilarity": 0.7,
  "methodologySimilarity": 0.6,
  "overlappingAreas": ["Machine Learning", "Web Development"],
  "keyDifferences": ["Project 1 focuses on NLP while Project 2 focuses on computer vision"],
  "detailedAnalysis": "Comprehensive explanation of similarities and differences",
  "recommendation": "Should these projects be in the same panel? Why or why not?"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Clean up response if it has markdown formatting
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].trim();
    }

    const parsedResult = JSON.parse(responseText);
    
    return {
      success: true,
      data: parsedResult
    };

  } catch (error) {
    console.error('Gemini similarity analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Batch analyze project similarities with Gemini
export async function batchAnalyzeSimilarityWithGemini(projects, onProgress) {
  const results = [];
  const threshold = 0.3;
  const total = (projects.length * (projects.length - 1)) / 2;
  let current = 0;

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      current++;
      
      try {
        // Add delay to avoid rate limiting
        if (current > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const result = await analyzeProjectSimilarityWithGemini(projects[i], projects[j]);
        
        if (result.success && result.data.similarityScore > threshold) {
          results.push({
            project1Id: projects[i].projectId,
            project2Id: projects[j].projectId,
            similarityScore: result.data.similarityScore,
            similarityLevel: result.data.similarityLevel,
            overlappingDomains: result.data.overlappingAreas || [],
            explanation: result.data.detailedAnalysis,
            technicalSimilarity: result.data.technicalSimilarity,
            domainSimilarity: result.data.domainSimilarity,
            methodologySimilarity: result.data.methodologySimilarity,
            keyDifferences: result.data.keyDifferences || [],
            recommendation: result.data.recommendation,
            analysisMethod: 'gemini_ai'
          });
        }

        if (onProgress) {
          onProgress(current, total, `${projects[i].projectId} vs ${projects[j].projectId}`);
        }

      } catch (error) {
        console.error(`Failed to analyze similarity between ${projects[i].projectId} and ${projects[j].projectId}:`, error);
      }
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

// Enhanced panel allocation suggestions using Gemini
export async function generatePanelAllocationSuggestions(projects, constraints, existingSimilarity = []) {
  if (!model) {
    throw new Error('Gemini AI not initialized');
  }

  const projectsSummary = projects.slice(0, 20).map(p => ({
    id: p.projectId,
    title: p.projectTitle,
    domain: p.primaryDomain || 'Unknown',
    keyPoints: p.keyPoints || p.projectScope?.substring(0, 100) + '...'
  }));

  const prompt = `
You are an expert panel allocation system. Given these Final Year Projects and constraints, suggest optimal panel allocations.

PROJECTS (showing first 20):
${JSON.stringify(projectsSummary, null, 2)}

CONSTRAINTS:
- Number of panels: ${constraints.numberOfPanels}
- Max instructors per panel: ${constraints.instructorsPerPanel}
- Desired projects per panel: ${constraints.projectsPerPanel}

DOMAIN DIVERSITY CONSTRAINT (SOFT):
- Maximum 3-4 projects from the same domain per panel
- Avoid panels with only education/web development/AI projects
- Ensure balanced domain distribution

EXISTING SIMILARITY DATA:
${existingSimilarity.length} similar project pairs identified

Provide panel allocation suggestions considering:
1. Domain diversity within each panel
2. Instructor expertise alignment
3. Project similarity for grouping efficiency
4. Evaluation balance and fairness

Respond in JSON format:
{
  "recommendations": [
    {
      "panelNumber": 1,
      "suggestedProjects": ["F24-001", "F24-005"],
      "domainDistribution": {"AI/ML": 2, "Web Development": 1},
      "reasoning": "Explanation for this grouping"
    }
  ],
  "domainBalanceAnalysis": "Overall domain distribution analysis",
  "potentialIssues": ["Potential issues to watch out for"],
  "optimizationTips": ["Tips for better allocation"]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].trim();
    }

    const parsedResult = JSON.parse(responseText);
    
    return {
      success: true,
      data: parsedResult
    };

  } catch (error) {
    console.error('Gemini panel allocation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced balanced panel allocation suggestions using Gemini
export async function generateBalancedPanelAllocationSuggestions(projects, constraints, existingSimilarity = []) {
  if (!model) {
    throw new Error('Gemini AI not initialized');
  }

  const projectsSummary = projects.slice(0, 30).map(p => ({
    id: p.projectId,
    title: p.projectTitle,
    domain: p.primaryDomain || detectProjectDomain(p.projectTitle),
    supervisor: p.supervisor || 'Unknown',
    keyPoints: p.keyPoints || p.projectScope?.substring(0, 150) + '...'
  }));

  // Create similarity clusters summary
  const similarityClustersSummary = createSimilarityClustersSummary(existingSimilarity, projects);

  const prompt = `
You are an expert panel allocation system specializing in BALANCED PANEL ALLOCATION with DOMAIN DIVERSITY.

Your task is to create balanced panels where:
1. Projects with HIGH similarity are DISTRIBUTED across multiple panels (NOT clustered together)
2. Each panel has DIVERSE domains (max 3-4 projects per domain)
3. Instructors are assigned to panels where they have MAJORITY of their supervised projects
4. Project distribution is EVEN across all panels

PROJECTS (showing first 30):
${JSON.stringify(projectsSummary, null, 2)}

SIMILARITY CLUSTERS:
${similarityClustersSummary}

CONSTRAINTS:
- Number of panels: ${constraints.numberOfPanels}
- Max instructors per panel: ${constraints.instructorsPerPanel}
- Target projects per panel: ${constraints.projectsPerPanel}

BALANCED DISTRIBUTION STRATEGY:
1. DISTRIBUTE similar projects across different panels (avoid clustering)
2. Ensure each panel has 2-5 different domains
3. Maximum 4 projects from same domain per panel
4. Assign instructors to panels with their project majority
5. Balance project count across all panels (±2 projects difference max)

DOMAIN BALANCE PRIORITIES:
- Avoid AI/ML-only panels or Web-only panels
- Mix domains like: AI/ML + Healthcare + Finance, Web + IoT + Education, etc.
- Prefer panels with complementary evaluation expertise

Provide detailed balanced allocation suggestions:

Respond in JSON format:
{
  "balancedRecommendations": [
    {
      "panelNumber": 1,
      "suggestedProjects": ["F24-001", "F24-015", "F24-023"],
      "domainDistribution": {"AI/ML": 2, "Healthcare": 1, "Finance": 1},
      "similarityDistribution": "Low similarity clustering - good diversity",
      "instructorAssignment": ["Dr. Smith (3 projects)", "Dr. Jones (1 project)"],
      "balanceReasoning": "Even project distribution with diverse domains"
    }
  ],
  "distributionStrategy": "How similar projects are distributed to avoid clustering",
  "domainBalanceAnalysis": "Overall domain distribution analysis across all panels", 
  "instructorOptimization": "How instructors are optimally assigned based on project majority",
  "balanceMetrics": {
    "projectSpread": "Expected difference between min/max projects per panel",
    "domainDiversity": "Expected unique domains per panel",
    "similarityBalance": "How well similar projects are distributed"
  },
  "potentialIssues": ["Issues that might arise with this allocation"],
  "optimizationTips": ["Specific tips for better balanced allocation"]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].trim();
    }

    const parsedResult = JSON.parse(responseText);
    
    return {
      success: true,
      data: parsedResult
    };

  } catch (error) {
    console.error('Gemini balanced panel allocation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to detect project domain from title
function detectProjectDomain(projectTitle) {
  const title = projectTitle.toLowerCase();
  
  if (title.includes('ai') || title.includes('ml') || title.includes('chatbot') || title.includes('neural')) return 'AI/ML';
  if (title.includes('web') || title.includes('website') || title.includes('platform') || title.includes('ecommerce')) return 'Web Development';
  if (title.includes('mobile') || title.includes('app') || title.includes('android') || title.includes('ios')) return 'Mobile Development';
  if (title.includes('iot') || title.includes('smart') || title.includes('sensor') || title.includes('automation')) return 'IoT';
  if (title.includes('security') || title.includes('cyber') || title.includes('blockchain') || title.includes('encryption')) return 'Cybersecurity';
  if (title.includes('health') || title.includes('medical') || title.includes('hospital') || title.includes('patient')) return 'Healthcare';
  if (title.includes('education') || title.includes('learning') || title.includes('student') || title.includes('quiz')) return 'Education';
  if (title.includes('finance') || title.includes('banking') || title.includes('payment') || title.includes('trading')) return 'Finance';
  if (title.includes('game') || title.includes('vr') || title.includes('ar') || title.includes('3d')) return 'Gaming/VR';
  
  return 'General';
}

// Helper function to create similarity clusters summary for AI prompt
function createSimilarityClustersSummary(similarityResults, projects) {
  if (!similarityResults || similarityResults.length === 0) {
    return 'No similarity data available';
  }

  const highSimilarityPairs = similarityResults
    .filter(result => result.similarityScore >= 0.6)
    .slice(0, 10)
    .map(result => ({
      projects: `${result.project1Id} & ${result.project2Id}`,
      similarity: result.similarityScore.toFixed(2),
      reason: result.explanation?.substring(0, 100) || 'High similarity detected'
    }));

  if (highSimilarityPairs.length === 0) {
    return 'No high similarity clusters detected (all similarities < 0.6)';
  }

  return `High Similarity Pairs (to be DISTRIBUTED across panels):
${highSimilarityPairs.map(pair => `- ${pair.projects} (${pair.similarity}): ${pair.reason}`).join('\n')}

Note: These similar projects should be placed in DIFFERENT panels to avoid clustering.`;
}

// Get usage statistics (placeholder - actual implementation would depend on API)
export function getGeminiUsageStats() {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: null
  };
} 