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
Analyze the following Final Year Project (FYP) and categorize it into one or more relevant technical domains.

Project Title: ${projectTitle}
Project Description: ${projectScope}

Available Domains:
${domainsStr}

Instructions:
1. Identify which domains this project belongs to (it can belong to multiple domains)
2. For each relevant domain, provide a confidence score from 1-10
3. Explain why the project fits into each selected domain
4. Consider the technical requirements, methodologies, and objectives

Respond in JSON format:
{
  "domains": [
    {
      "name": "Domain Name",
      "confidence": 8,
      "reasoning": "Brief explanation why this project fits this domain"
    }
  ],
  "primary_domain": "Most relevant domain name",
  "summary": "Brief overall categorization summary"
}

Only include domains with confidence >= 6. If no domain fits well, suggest the closest match.
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

// Get usage statistics (placeholder - actual implementation would depend on API)
export function getGeminiUsageStats() {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: null
  };
} 