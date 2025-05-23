import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Read Excel file and extract project data
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Standardize column names
        const standardizedData = jsonData.map((row, index) => {
          const standardRow = {
            projectId: row['Short_Title'] || row['Project Short Title'] || `Project_${index + 1}`,
            projectTitle: row['Project Title'] || '',
            projectScope: row['Project Scope'] || '',
            primaryDomain: row['Categorize the primary domain of project'] || '',
            subCategory: row['Sub-category of the project'] || ''
          };
          
          // Clean empty values
          Object.keys(standardRow).forEach(key => {
            if (standardRow[key] === undefined || standardRow[key] === null) {
              standardRow[key] = '';
            }
          });
          
          return standardRow;
        });
        
        resolve({
          data: standardizedData,
          totalProjects: standardizedData.length,
          sheetNames: workbook.SheetNames
        });
        
      } catch (error) {
        reject(new Error(`Failed to read Excel file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Create Excel workbook with multiple sheets
export function createExcelWorkbook(domainData, similarityData) {
  const workbook = XLSX.utils.book_new();
  
  // Create domain categorization sheet
  if (domainData && domainData.length > 0) {
    const domainSheet = createDomainSheet(domainData);
    XLSX.utils.book_append_sheet(workbook, domainSheet, 'Project_Domains');
    
    // Create separate sheets for each domain
    const domainGroups = groupByDomains(domainData);
    Object.entries(domainGroups).forEach(([domain, projects]) => {
      if (projects.length > 0) {
        const sheetName = sanitizeSheetName(domain);
        const domainSpecificSheet = XLSX.utils.json_to_sheet(projects);
        XLSX.utils.book_append_sheet(workbook, domainSpecificSheet, sheetName);
      }
    });
  }
  
  // Create similarity analysis sheet
  if (similarityData && similarityData.length > 0) {
    const similaritySheet = createSimilaritySheet(similarityData);
    XLSX.utils.book_append_sheet(workbook, similaritySheet, 'Project_Similarities');
    
    // Create sheets by similarity level
    const similarityGroups = groupBySimilarityLevel(similarityData);
    Object.entries(similarityGroups).forEach(([level, pairs]) => {
      if (pairs.length > 0) {
        const sheetName = `${level}_Similarity`;
        const levelSheet = XLSX.utils.json_to_sheet(pairs);
        XLSX.utils.book_append_sheet(workbook, levelSheet, sheetName);
      }
    });
  }
  
  return workbook;
}

// Create domain categorization sheet
function createDomainSheet(domainData) {
  const sheetData = domainData.map(project => ({
    'Project ID': project.projectId,
    'Project Title': project.projectTitle,
    'Primary Domain': project.primaryDomain,
    'All Domains': Array.isArray(project.domains) ? project.domains.join(', ') : project.domains,
    'Categorization Method': project.categorizationMethod || 'keyword_matching',
    'Confidence Score': project.maxConfidenceScore || 'N/A'
  }));
  
  return XLSX.utils.json_to_sheet(sheetData);
}

// Create similarity analysis sheet
function createSimilaritySheet(similarityData) {
  const sheetData = similarityData.map(pair => ({
    'Project 1 ID': pair.project1Id,
    'Project 2 ID': pair.project2Id,
    'Similarity Score': pair.similarityScore,
    'Similarity Level': pair.similarityLevel,
    'Overlapping Domains': pair.overlappingDomains.join(', '),
    'Explanation': pair.explanation
  }));
  
  return XLSX.utils.json_to_sheet(sheetData);
}

// Group projects by domains
function groupByDomains(domainData) {
  const groups = {};
  
  domainData.forEach(project => {
    const domains = Array.isArray(project.domains) ? project.domains : [project.domains];
    
    domains.forEach(domain => {
      if (!groups[domain]) {
        groups[domain] = [];
      }
      
      groups[domain].push({
        'Project ID': project.projectId,
        'Project Title': project.projectTitle,
        'Project Scope': project.projectScope,
        'Confidence Score': project.confidenceScores?.[domain]?.score || 'N/A',
        'Method': project.confidenceScores?.[domain]?.method || 'N/A'
      });
    });
  });
  
  return groups;
}

// Group similarity pairs by level
function groupBySimilarityLevel(similarityData) {
  const groups = {
    'Very High': [],
    'High': [],
    'Medium': [],
    'Low': []
  };
  
  similarityData.forEach(pair => {
    if (groups[pair.similarityLevel]) {
      groups[pair.similarityLevel].push(pair);
    }
  });
  
  return groups;
}

// Sanitize sheet name for Excel compatibility
function sanitizeSheetName(name) {
  return name
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 31); // Excel sheet name limit
}

// Export domain categorization to Excel
export function exportDomainCategorization(domainData, filename = 'fyp_domain_categorization.xlsx') {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Main domain sheet
    const domainSheet = createDomainSheet(domainData);
    XLSX.utils.book_append_sheet(workbook, domainSheet, 'Project_Domains');
    
    // Domain-specific sheets
    const domainGroups = groupByDomains(domainData);
    Object.entries(domainGroups).forEach(([domain, projects]) => {
      if (projects.length > 0) {
        const sheetName = sanitizeSheetName(domain);
        const domainSpecificSheet = XLSX.utils.json_to_sheet(projects);
        XLSX.utils.book_append_sheet(workbook, domainSpecificSheet, sheetName);
      }
    });
    
    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
    
    return true;
  } catch (error) {
    console.error('Failed to export domain categorization:', error);
    return false;
  }
}

// Export similarity analysis to Excel
export function exportSimilarityAnalysis(similarityData, filename = 'fyp_similarity_analysis.xlsx') {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Main similarity sheet
    const similaritySheet = createSimilaritySheet(similarityData);
    XLSX.utils.book_append_sheet(workbook, similaritySheet, 'Project_Similarities');
    
    // Similarity level sheets
    const similarityGroups = groupBySimilarityLevel(similarityData);
    Object.entries(similarityGroups).forEach(([level, pairs]) => {
      if (pairs.length > 0) {
        const sheetName = `${level}_Similarity`;
        const levelSheet = XLSX.utils.json_to_sheet(pairs.map(pair => ({
          'Project 1 ID': pair.project1Id,
          'Project 2 ID': pair.project2Id,
          'Similarity Score': pair.similarityScore,
          'Overlapping Domains': pair.overlappingDomains.join(', '),
          'Explanation': pair.explanation
        })));
        XLSX.utils.book_append_sheet(workbook, levelSheet, sheetName);
      }
    });
    
    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
    
    return true;
  } catch (error) {
    console.error('Failed to export similarity analysis:', error);
    return false;
  }
}

// Export both reports as a combined Excel file
export function exportCombinedReports(domainData, similarityData, filename = 'fyp_analysis_complete.xlsx') {
  try {
    const workbook = createExcelWorkbook(domainData, similarityData);
    
    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
    
    return true;
  } catch (error) {
    console.error('Failed to export combined reports:', error);
    return false;
  }
}

// Create sample Excel file for testing
export function createSampleExcelFile() {
  const sampleData = [
    {
      'Project Title': 'AI-Powered Chatbot for Customer Service',
      'Project Scope': 'Development of an intelligent chatbot using natural language processing and machine learning to handle customer inquiries automatically. The system will use deep learning models to understand customer intent and provide accurate responses.',
      'Short_Title': 'F24-001-AI-Chatbot'
    },
    {
      'Project Title': 'E-commerce Website with Recommendation System',
      'Project Scope': 'Building a comprehensive e-commerce platform with integrated recommendation engine. Uses collaborative filtering and machine learning algorithms to suggest products to customers based on their browsing history and preferences.',
      'Short_Title': 'F24-002-Ecom-Rec'
    },
    {
      'Project Title': 'Smart Home IoT Security System',
      'Project Scope': 'Development of a comprehensive security system for smart homes using IoT sensors, cameras, and machine learning for threat detection. Includes mobile app for monitoring and real-time alerts.',
      'Short_Title': 'F24-003-IoT-Security'
    },
    {
      'Project Title': 'Virtual Reality Game for Education',
      'Project Scope': 'Creating an immersive VR educational game using Unity 3D. The game teaches physics concepts through interactive simulations and gamification elements to enhance learning experience.',
      'Short_Title': 'F24-004-VR-Education'
    },
    {
      'Project Title': 'Blockchain-based Voting System',
      'Project Scope': 'Secure electronic voting system using blockchain technology to ensure transparency and prevent fraud. Implements smart contracts for vote counting and verification.',
      'Short_Title': 'F24-005-Blockchain-Vote'
    }
  ];
  
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_FYP_Data');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'sample_fyp_data.xlsx');
} 