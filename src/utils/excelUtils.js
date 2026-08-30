import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { generateJSON, isAIAvailable } from './modelApi';

// ---- Smart sheet/column detection ----
// Heuristics first; if they can't find the project data, the AI model reads the
// sheet names + headers and picks the right sheet and columns.

const COLUMN_PATTERNS = {
  projectTitle: /project\s*title|^title$/i,
  projectScope: /scope|description|abstract/i,
  projectId: /short.?title|project.?id|^id$/i,
  supervisor: /^supervisor|main\s*supervisor/i
};

function getSheetHeaders(workbook, sheetName) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  const headers = (rows[0] || []).map(h => String(h || '').trim()).filter(Boolean);
  return { headers, rowCount: Math.max(0, rows.length - 1) };
}

function detectMappingHeuristically(workbook) {
  let best = null;
  workbook.SheetNames.forEach(sheetName => {
    const { headers, rowCount } = getSheetHeaders(workbook, sheetName);
    if (rowCount === 0) return;
    const columns = {};
    Object.entries(COLUMN_PATTERNS).forEach(([field, pattern]) => {
      const match = headers.find(h => pattern.test(h));
      if (match) columns[field] = match;
    });
    let score = Object.keys(columns).length;
    if (columns.projectTitle) score += 2; // title is essential
    if (!best || score > best.score) best = { sheetName, columns, score, rowCount };
  });
  return best;
}

async function detectMappingWithAI(workbook) {
  const sheetSummaries = workbook.SheetNames.map(sheetName => {
    const { headers, rowCount } = getSheetHeaders(workbook, sheetName);
    return { sheet: sheetName, rows: rowCount, headers: headers.slice(0, 40) };
  });

  const prompt = `An Excel workbook contains Final Year Project data. Pick the sheet holding the main project list and identify which EXACT header names hold each field.

Sheets and their headers:
${JSON.stringify(sheetSummaries)}

Respond with ONLY this JSON (use exact header strings from the data; use null when a field has no matching column):
{"sheet": "SheetName", "projectTitle": "header", "projectScope": "header or null", "projectId": "header or null", "supervisor": "header or null"}`;

  const result = await generateJSON(prompt, { retries: 1 });
  if (!result.sheet || !workbook.SheetNames.includes(result.sheet) || !result.projectTitle) {
    throw new Error('AI returned an unusable mapping');
  }
  return {
    sheetName: result.sheet,
    columns: {
      projectTitle: result.projectTitle,
      projectScope: result.projectScope || null,
      projectId: result.projectId || null,
      supervisor: result.supervisor || null
    }
  };
}

// Read Excel file and extract project data.
// Detects the correct sheet and columns automatically (heuristics + AI).
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        let mapping = detectMappingHeuristically(workbook);

        // Heuristics failed to find a title column → ask the AI model.
        if ((!mapping || !mapping.columns.projectTitle) && isAIAvailable()) {
          try {
            mapping = await detectMappingWithAI(workbook);
          } catch (aiError) {
            console.warn('AI sheet detection failed, using fallback:', aiError.message);
          }
        }

        const sheetName = mapping?.sheetName || workbook.SheetNames[0];
        const cols = mapping?.columns || {};
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Standardize column names while preserving ALL original data
        const standardizedData = jsonData.map((row, index) => {
          const standardRow = {
            projectId: (cols.projectId && row[cols.projectId]) ||
              row['Short_Title'] || row['Project Short Title'] || `Project_${index + 1}`,
            projectTitle: (cols.projectTitle && row[cols.projectTitle]) || row['Project Title'] || '',
            projectScope: (cols.projectScope && row[cols.projectScope]) || row['Project Scope'] || '',
            primaryDomain: row['Categorize the primary domain of project'] || '',
            subCategory: row['Sub-category of the project'] || '',
            // Preserve supervisor information - CRITICAL for panel allocation
            supervisor: (cols.supervisor && row[cols.supervisor]) || row['Supervisor'] || '',
            // Preserve ALL original columns for compatibility
            ...row
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
          sheetNames: workbook.SheetNames,
          detectedSheet: sheetName
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
        const levelSheet = createDetailedSimilaritySheet(pairs);
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

// Create enhanced similarity analysis sheet with detailed breakdown
function createSimilaritySheet(similarityData) {
  const sheetData = similarityData.map(pair => {
    // Parse the detailed explanation to extract components
    const explanation = pair.explanation || '';
    const lines = explanation.split('\n');
    
    // Extract different sections from the explanation
    let specificReasons = [];
    let interpretation = '';
    let analysisHeader = '';
    
    let currentSection = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('SIMILARITY ANALYSIS')) {
        analysisHeader = trimmed;
        currentSection = 'analysis';
      } else if (trimmed === 'SPECIFIC REASONS:') {
        currentSection = 'reasons';
      } else if (trimmed === 'SIMILARITY INTERPRETATION:') {
        currentSection = 'interpretation';
      } else if (trimmed.startsWith('✓') && currentSection === 'reasons') {
        specificReasons.push(trimmed);
      } else if (trimmed.startsWith('→') && currentSection === 'interpretation') {
        interpretation = trimmed.substring(2).trim(); // Remove arrow
      }
    });

    return {
      'Project 1 ID': pair.project1Id,
      'Project 2 ID': pair.project2Id,
      'Similarity Score': `${(pair.similarityScore * 100).toFixed(1)}%`,
      'Similarity Level': pair.similarityLevel,
      'Overlapping Domains': pair.overlappingDomains.join(', '),
      'Analysis Summary': analysisHeader,
      'Specific Reasons': specificReasons.join(' | '),
      'Interpretation': interpretation,
      'Full Explanation': explanation
    };
  });
  
  return XLSX.utils.json_to_sheet(sheetData);
}

// Create detailed similarity sheet for level-specific sheets
function createDetailedSimilaritySheet(pairs) {
  return XLSX.utils.json_to_sheet(pairs.map(pair => {
    // Parse explanation for detailed breakdown
    const explanation = pair.explanation || '';
    const lines = explanation.split('\n');
    let specificReasons = [];
    let interpretation = '';
    
    let currentSection = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === 'SPECIFIC REASONS:') {
        currentSection = 'reasons';
      } else if (trimmed === 'SIMILARITY INTERPRETATION:') {
        currentSection = 'interpretation';
      } else if (trimmed.startsWith('✓') && currentSection === 'reasons') {
        specificReasons.push(trimmed);
      } else if (trimmed.startsWith('→') && currentSection === 'interpretation') {
        interpretation = trimmed.substring(2).trim();
      }
    });

    return {
      'Project 1 ID': pair.project1Id,
      'Project 2 ID': pair.project2Id,
      'Similarity Score': `${(pair.similarityScore * 100).toFixed(1)}%`,
      'Overlapping Domains': pair.overlappingDomains.join(', '),
      'Specific Reasons': specificReasons.join(' | '),
      'Interpretation': interpretation,
      'Full Explanation': explanation
    };
  }));
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
        const levelSheet = createDetailedSimilaritySheet(pairs);
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

// Export panel allocation results to Excel
export function exportPanelAllocationReport(panelReport, filename = 'panel_allocation_report.xlsx') {
  try {
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      { Metric: 'Total Projects', Value: panelReport.summary.totalProjects },
      { Metric: 'Allocated Projects', Value: panelReport.summary.allocatedProjects },
      { Metric: 'Total Panels', Value: panelReport.summary.totalPanels },
      { Metric: 'Average Projects per Panel', Value: panelReport.summary.averageProjectsPerPanel.toFixed(2) },
      { Metric: 'Average Instructors per Panel', Value: panelReport.summary.averageInstructorsPerPanel.toFixed(2) },
      { Metric: 'Constraints Satisfied', Value: panelReport.summary.totalConstraintsSatisfied },
      { Metric: 'Constraints Violated', Value: panelReport.summary.totalConstraintsViolated },
      { Metric: 'Warnings', Value: panelReport.summary.totalWarnings },
      { Metric: 'Generated At', Value: panelReport.summary.generatedAt }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Panel Overview Sheet
    const panelOverviewData = panelReport.panels.map(panel => ({
      'Panel Number': panel.panelNumber,
      'Project Count': panel.projectCount,
      'Instructor Count': panel.instructorCount,
      'Total Duration (min)': panel.totalDuration,
      'Project Utilization (%)': panel.utilizationMetrics.projectUtilization,
      'Instructor Utilization (%)': panel.utilizationMetrics.instructorUtilization,
      'Time Utilization (%)': panel.utilizationMetrics.timeUtilization,
      'Instructors': panel.instructors.join(', ')
    }));
    
    const panelOverviewSheet = XLSX.utils.json_to_sheet(panelOverviewData);
    XLSX.utils.book_append_sheet(workbook, panelOverviewSheet, 'Panel_Overview');

    // Detailed Panel Sheets
    panelReport.panels.forEach(panel => {
      const panelData = panel.projects.map((project, index) => ({
        'S.No': index + 1,
        'Project ID': project.id,
        'Project Title': project.title,
        'Supervisors': project.supervisors.join(', '),
        'Panel Number': panel.panelNumber,
        'Session Duration': panel.totalDuration,
        'Panel Instructors': panel.instructors.join(', ')
      }));
      
      if (panelData.length > 0) {
        const panelSheet = XLSX.utils.json_to_sheet(panelData);
        XLSX.utils.book_append_sheet(workbook, panelSheet, `Panel_${panel.panelNumber}`);
      }
    });

    // Constraints Sheet
    const constraintsData = [
      ...panelReport.constraints.satisfied.map(constraint => ({
        'Type': 'Satisfied',
        'Status': '✅',
        'Description': constraint
      })),
      ...panelReport.constraints.violated.map(constraint => ({
        'Type': 'Violated',
        'Status': '❌',
        'Description': constraint
      })),
      ...panelReport.constraints.warnings.map(warning => ({
        'Type': 'Warning',
        'Status': '⚠️',
        'Description': warning
      }))
    ];
    
    if (constraintsData.length > 0) {
      const constraintsSheet = XLSX.utils.json_to_sheet(constraintsData);
      XLSX.utils.book_append_sheet(workbook, constraintsSheet, 'Constraints');
    }

    // Complete Project List with Panel Assignment
    const allProjectsData = [];
    panelReport.panels.forEach(panel => {
      panel.projects.forEach(project => {
        allProjectsData.push({
          'Project ID': project.id,
          'Project Title': project.title,
          'Supervisors': project.supervisors.join(', '),
          'Assigned Panel': panel.panelNumber,
          'Panel Instructors': panel.instructors.join(', '),
          'Panel Duration': panel.totalDuration,
          'Project Count in Panel': panel.projectCount
        });
      });
    });
    
    if (allProjectsData.length > 0) {
      const allProjectsSheet = XLSX.utils.json_to_sheet(allProjectsData);
      XLSX.utils.book_append_sheet(workbook, allProjectsSheet, 'All_Projects');
    }

    // Suggestions Sheet
    if (panelReport.suggestions && panelReport.suggestions.length > 0) {
      const suggestionsData = panelReport.suggestions.map((suggestion, index) => ({
        'S.No': index + 1,
        'Type': suggestion.type.replace('_', ' ').toUpperCase(),
        'Reasoning': suggestion.reasoning,
        'Recommendation': typeof suggestion.recommendation === 'object' 
          ? JSON.stringify(suggestion.recommendation, null, 2)
          : suggestion.recommendation || 'See reasoning',
        'Count': suggestion.count || 'N/A'
      }));
      
      const suggestionsSheet = XLSX.utils.json_to_sheet(suggestionsData);
      XLSX.utils.book_append_sheet(workbook, suggestionsSheet, 'Suggestions');
    }

    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);

    return true;
  } catch (error) {
    console.error('Failed to export panel allocation report:', error);
    return false;
  }
}

// Export constraint-based panel allocation results to Excel
export function exportConstraintBasedPanelAllocation(allocationResult, filename = 'panel_allocation_constraint_based.xlsx') {
  try {
    const workbook = XLSX.utils.book_new();
    const { panels, instructorAssignments, summary } = allocationResult;

    // Sheet 1: Panel Allocation
    const panelAllocationData = panels.map(panel => {
      const groupsList = panel.groups.map(group => 
        `${group.id} (${group.projects.length} projects: ${group.projects.join(', ')})`
      ).join(' | ');
      
      const instructorsList = panel.instructors.join(', ');
      
      return {
        'Panel Number': panel.panelNumber,
        'Number of Groups': panel.constraints.actualGroups,
        'Total Projects': panel.totalProjects,
        'Groups': groupsList,
        'Assigned Instructors': instructorsList,
        'Instructor Count': panel.instructors.length,
        'Groups vs Target': `${panel.constraints.actualGroups}/${panel.constraints.desiredGroups}`,
        'Instructors vs Limit': `${panel.instructors.length}/${panel.constraints.maxInstructors}`
      };
    });
    
    const panelSheet = XLSX.utils.json_to_sheet(panelAllocationData);
    XLSX.utils.book_append_sheet(workbook, panelSheet, 'Panel Allocation');

    // Sheet 2: Instructor Assignments
    const instructorAssignmentData = instructorAssignments.map((assignment, index) => ({
      'S.No': index + 1,
      'Instructor Name': assignment.instructorName,
      'Panel Assigned': assignment.panelAssigned || 'Not Assigned',
      'Status': assignment.status,
      'Project Count': assignment.projectCount,
      'Supervised Projects': assignment.supervisedProjects.join(', ')
    }));
    
    const instructorSheet = XLSX.utils.json_to_sheet(instructorAssignmentData);
    XLSX.utils.book_append_sheet(workbook, instructorSheet, 'Instructor Assignments');

    // Sheet 3: Summary
    const summaryData = [
      { 'Metric': 'Total Panels', 'Value': summary.totalPanels },
      { 'Metric': 'Total Groups', 'Value': summary.totalGroups },
      { 'Metric': 'Total Instructors', 'Value': summary.totalInstructors },
      { 'Metric': 'Average Groups per Panel', 'Value': summary.averageGroupsPerPanel },
      { 'Metric': 'Average Instructors per Panel', 'Value': summary.averageInstructorsPerPanel },
      { 'Metric': '', 'Value': '' }, // Separator
      { 'Metric': 'HARD CONSTRAINTS', 'Value': '' },
      { 'Metric': 'Number of Panels', 'Value': `${summary.constraints.hard.numberOfPanels} (Satisfied: ✓)` },
      { 'Metric': 'Instructors per Panel (Max)', 'Value': `${summary.constraints.hard.instructorsPerPanel} (Satisfied: ✓)` },
      { 'Metric': '', 'Value': '' }, // Separator
      { 'Metric': 'SOFT CONSTRAINTS', 'Value': '' },
      { 'Metric': 'Groups per Panel (Desired)', 'Value': summary.constraints.soft.groupsPerPanel },
      { 'Metric': 'Soft Constraint Exceeded', 'Value': summary.constraints.soft.exceeded ? 'Yes' : 'No' },
      { 'Metric': 'Max Groups in Any Panel', 'Value': summary.constraints.soft.maxGroupsInAnyPanel },
      { 'Metric': 'Reason for Exceeding', 'Value': summary.constraints.soft.reason || 'N/A' },
      { 'Metric': '', 'Value': '' }, // Separator
      { 'Metric': 'ALLOCATION RESULTS', 'Value': '' },
      { 'Metric': 'Successful Allocations', 'Value': summary.allocationSuccess.successful },
      { 'Metric': 'Failed Allocations', 'Value': summary.allocationSuccess.failed },
      { 'Metric': 'Warnings', 'Value': summary.allocationSuccess.warnings },
      { 'Metric': 'Constraint Violations', 'Value': summary.allocationSuccess.constraintViolations },
      { 'Metric': '', 'Value': '' }, // Separator
      { 'Metric': 'Generated At', 'Value': summary.generatedAt }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sheet 4: Detailed Group Information
    const detailedGroupData = [];
    panels.forEach(panel => {
      panel.groups.forEach(group => {
        detailedGroupData.push({
          'Panel Number': panel.panelNumber,
          'Group ID': group.id,
          'Project Count': group.projects.length,
          'Projects': group.projects.join(', '),
          'Supervisors': group.supervisors.join(', '),
          'Primary Supervisor': group.primarySupervisor
        });
      });
    });
    
    if (detailedGroupData.length > 0) {
      const detailedGroupSheet = XLSX.utils.json_to_sheet(detailedGroupData);
      XLSX.utils.book_append_sheet(workbook, detailedGroupSheet, 'Detailed Groups');
    }

    // Sheet 5: Allocation Log (if there are results)
    if (allocationResult.allocationResults) {
      const logData = [
        ...allocationResult.allocationResults.successful.map(msg => ({ 'Type': 'Success', 'Message': msg })),
        ...allocationResult.allocationResults.failed.map(msg => ({ 'Type': 'Failed', 'Message': msg })),
        ...allocationResult.allocationResults.warnings.map(msg => ({ 'Type': 'Warning', 'Message': msg })),
        ...allocationResult.allocationResults.constraintViolations.map(msg => ({ 'Type': 'Constraint Violation', 'Message': msg }))
      ];
      
      if (logData.length > 0) {
        const logSheet = XLSX.utils.json_to_sheet(logData);
        XLSX.utils.book_append_sheet(workbook, logSheet, 'Allocation Log');
      }
    }

    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);

    return true;
  } catch (error) {
    console.error('Failed to export constraint-based panel allocation:', error);
    return false;
  }
}

// Export supervisor statistics to Excel
export function exportSupervisorStatistics(supervisorStats, filename = 'supervisor_project_statistics.xlsx') {
  try {
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      { 'Metric': 'Total Supervisors', 'Value': supervisorStats.totalSupervisors },
      { 'Metric': 'Total Projects', 'Value': supervisorStats.totalProjects },
      { 'Metric': 'Average Projects per Supervisor', 'Value': supervisorStats.averageProjectsPerSupervisor.toFixed(2) },
      { 'Metric': '', 'Value': '' }, // Separator
      { 'Metric': 'TOP SUPERVISORS BY PROJECT COUNT', 'Value': '' },
      ...supervisorStats.supervisors.slice(0, 5).map((sup, index) => ({
        'Metric': `${index + 1}. ${sup.name}`,
        'Value': `${sup.projectCount} projects`
      }))
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Supervisor Overview Sheet
    const supervisorOverviewData = supervisorStats.supervisors.map((supervisor, index) => ({
      'S.No': index + 1,
      'Supervisor Name': supervisor.name,
      'Total Projects': supervisor.projectCount,
      'Primary Role': supervisor.role,
      'Projects': supervisor.projects.join(', ')
    }));
    
    const supervisorOverviewSheet = XLSX.utils.json_to_sheet(supervisorOverviewData);
    XLSX.utils.book_append_sheet(workbook, supervisorOverviewSheet, 'Supervisor Overview');

    // Detailed Project Assignments Sheet
    const detailedData = [];
    supervisorStats.detailedData.forEach(supervisor => {
      supervisor.projects.forEach((project, index) => {
        detailedData.push({
          'Supervisor Name': supervisor.name,
          'Project Title': project.title,
          'Project Scope': project.scope ? project.scope.substring(0, 100) + (project.scope.length > 100 ? '...' : '') : '',
          'Supervision Role': project.role,
        });
      });
    });
    
    if (detailedData.length > 0) {
      const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed Assignments');
    }

    // Project Count Distribution Sheet
    const distributionData = [];
    const projectCountGroups = {};
    
    supervisorStats.supervisors.forEach(supervisor => {
      const count = supervisor.projectCount;
      const group = count === 1 ? '1 Project' : 
                   count <= 3 ? '2-3 Projects' : 
                   count <= 5 ? '4-5 Projects' : 
                   '6+ Projects';
      
      if (!projectCountGroups[group]) {
        projectCountGroups[group] = [];
      }
      projectCountGroups[group].push(supervisor);
    });

    Object.entries(projectCountGroups).forEach(([group, supervisors]) => {
      distributionData.push({
        'Project Count Range': group,
        'Number of Supervisors': supervisors.length,
        'Percentage': ((supervisors.length / supervisorStats.totalSupervisors) * 100).toFixed(1) + '%',
        'Supervisor Names': supervisors.map(s => s.name).join(', ')
      });
    });
    
    if (distributionData.length > 0) {
      const distributionSheet = XLSX.utils.json_to_sheet(distributionData);
      XLSX.utils.book_append_sheet(workbook, distributionSheet, 'Distribution');
    }

    // Convert to blob and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);

    return true;
  } catch (error) {
    console.error('Failed to export supervisor statistics:', error);
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
// Export an AI-generated schedule variant (from ScheduleVariants) to Excel.
// variant: { variantName, strategy, panels: [{ panelNumber, suggestedProjects, domainDistribution, instructorAssignment, reasoning }], ... }
// audit (optional): { valid, hardViolations, softWarnings, collisionIssues, score }
export function exportScheduleVariant(variant, audit = null, filename = null) {
  try {
    const workbook = XLSX.utils.book_new();

    // Overview sheet: one row per panel
    const overview = (variant.panels || []).map(panel => ({
      'Panel': panel.panelNumber,
      'Projects': (panel.suggestedProjects || []).join(', '),
      'Project Count': (panel.suggestedProjects || []).length,
      'Instructors': (panel.instructorAssignment || []).join(', '),
      'Domain Distribution': Object.entries(panel.domainDistribution || {})
        .map(([d, n]) => `${d}: ${n}`).join(', '),
      'Reasoning': panel.reasoning || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview), 'Panels_Overview');

    // Detail sheet: one row per project
    const detail = [];
    (variant.panels || []).forEach(panel => {
      (panel.suggestedProjects || []).forEach(projectId => {
        detail.push({
          'Panel': panel.panelNumber,
          'Project ID': projectId,
          'Panel Instructors': (panel.instructorAssignment || []).join(', ')
        });
      });
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detail), 'Project_Assignments');

    // Strategy & audit sheet
    const meta = [
      { 'Field': 'Variant', 'Value': variant.variantName || 'Variant' },
      { 'Field': 'Strategy', 'Value': variant.strategy || '' },
      { 'Field': 'Hard Constraint Status', 'Value': variant.hardConstraintStatus || '' },
      { 'Field': 'Collision Handling', 'Value': variant.collisionHandling || '' }
    ];
    (variant.softConstraintTradeoffs || []).forEach((t, i) => {
      meta.push({ 'Field': `Soft Tradeoff ${i + 1}`, 'Value': t });
    });
    if (audit) {
      meta.push({ 'Field': 'Audit Score', 'Value': `${audit.score}/100` });
      meta.push({ 'Field': 'Hard Violations', 'Value': audit.hardViolations.join(' | ') || 'None' });
      meta.push({ 'Field': 'Soft Warnings', 'Value': audit.softWarnings.join(' | ') || 'None' });
      meta.push({ 'Field': 'Collision Issues', 'Value': audit.collisionIssues.join(' | ') || 'None' });
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(meta), 'Strategy_And_Audit');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = (variant.variantName || 'variant').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    saveAs(blob, filename || `schedule_${safeName}.xlsx`);
    return true;
  } catch (error) {
    console.error('Failed to export schedule variant:', error);
    return false;
  }
}
