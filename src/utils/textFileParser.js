/**
 * Text File Parser for Instructor and Project Data
 * 
 * This module parses text files containing instructor and project supervision information
 * and converts them into a structured format for panel allocation.
 */

/**
 * Extract projects for a specific instructor from Excel data
 * @param {string} instructorName - Name of the instructor
 * @param {Array} excelData - Array of project data from Excel
 * @returns {Array} Array of project titles for the instructor
 */
function extractProjectsForInstructor(instructorName, excelData) {
  if (!excelData || !Array.isArray(excelData)) {
    return [];
  }

  const projects = [];
  const normalizedInstructorName = normalizeInstructorName(instructorName);

  excelData.forEach(row => {
    const supervisor = normalizeInstructorName(row.Supervisor || '');
    const coSupervisor = normalizeInstructorName(row['Co-Supervisor'] || '');
    const projectTitle = row['Project Title'] || row.projectTitle || row.Short_Title || row.projectId || '';

    if (projectTitle && (supervisor === normalizedInstructorName || coSupervisor === normalizedInstructorName)) {
      projects.push(projectTitle);
    }
  });

  return [...new Set(projects)]; // Remove duplicates
}

/**
 * Normalize instructor name for comparison
 * @param {string} name - Instructor name
 * @returns {string} Normalized name
 */
function normalizeInstructorName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .toLowerCase()
    .replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/i, '') // Remove titles
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Parse text file content to extract instructors and their supervised projects
 * 
 * Expected format:
 * - Each line contains: Instructor Name: Project1, Project2, Project3
 * - OR: Instructor Name - Project1, Project2, Project3
 * - OR: Instructor Name | Project1 | Project2 | Project3
 * - OR: Just instructor names (one per line) - for use with Excel data
 * 
 * @param {string} textContent - Raw text content from file
 * @param {Object} excelData - Optional Excel data containing supervisor-project mappings
 * @returns {Object} Parsed data with instructors and projects
 */
export function parseInstructorProjectFile(textContent, excelData = null) {
  if (!textContent || typeof textContent !== 'string') {
    throw new Error('Invalid text content provided');
  }

  const instructors = new Map();
  const projects = new Map();
  const projectGroups = new Map();
  const lines = textContent.split('\n').filter(line => line.trim());

  let lineNumber = 0;
  const errors = [];

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue; // Skip empty lines and comments
    }

    try {
      // Try different delimiters
      let instructorName = '';
      let projectsText = '';
      
      if (trimmedLine.includes(':')) {
        [instructorName, projectsText] = trimmedLine.split(':', 2);
      } else if (trimmedLine.includes(' - ')) {
        [instructorName, projectsText] = trimmedLine.split(' - ', 2);
      } else if (trimmedLine.includes('|')) {
        const parts = trimmedLine.split('|');
        instructorName = parts[0];
        projectsText = parts.slice(1).join('|');
      } else {
        // Check if it's just an instructor name without projects
        if (trimmedLine.match(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+.+/) || trimmedLine.match(/^[A-Z][a-z]+\s+[A-Z]/)) {
          // If we have Excel data, extract projects for this instructor
          if (excelData && Array.isArray(excelData)) {
            const instructorProjects = extractProjectsForInstructor(trimmedLine, excelData);
            if (instructorProjects.length > 0) {
              instructorName = trimmedLine;
              projectsText = instructorProjects.join(', ');
            } else {
              errors.push(`Line ${lineNumber}: Instructor "${trimmedLine}" not found in Excel data or has no projects`);
              continue;
            }
          } else {
            errors.push(`Line ${lineNumber}: Found instructor name "${trimmedLine}" but no projects specified. Expected format: "${trimmedLine}: Project1, Project2" or provide Excel data with project mappings.`);
            continue;
          }
        } else {
          errors.push(`Line ${lineNumber}: Unable to parse format - "${trimmedLine}". Expected format: "Instructor Name: Project1, Project2"`);
          continue;
        }
      }

      instructorName = instructorName.trim();
      projectsText = projectsText.trim();

      if (!instructorName || !projectsText) {
        errors.push(`Line ${lineNumber}: Missing instructor name or projects - ${trimmedLine}`);
        continue;
      }

      // Parse projects (handle comma, semicolon, or pipe separation)
      const projectList = projectsText
        .split(/[,;|]/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (projectList.length === 0) {
        errors.push(`Line ${lineNumber}: No projects found for ${instructorName}`);
        continue;
      }

      // Store instructor data
      if (!instructors.has(instructorName)) {
        instructors.set(instructorName, {
          name: instructorName,
          projects: new Set(),
          groups: new Set()
        });
      }

      const instructor = instructors.get(instructorName);

      // Process each project
      projectList.forEach(projectName => {
        instructor.projects.add(projectName);
        
        if (!projects.has(projectName)) {
          projects.set(projectName, {
            name: projectName,
            supervisors: new Set(),
            group: null
          });
        }
        
        projects.get(projectName).supervisors.add(instructorName);
      });

      // If multiple projects, create a group
      if (projectList.length > 1) {
        const groupId = `GROUP_${instructorName.replace(/\s+/g, '_').toUpperCase()}`;
        projectGroups.set(groupId, {
          id: groupId,
          projects: projectList,
          supervisors: new Set([instructorName]),
          primarySupervisor: instructorName
        });
        
        instructor.groups.add(groupId);
        
        // Mark projects as belonging to this group
        projectList.forEach(projectName => {
          projects.get(projectName).group = groupId;
        });
      }

    } catch (error) {
      errors.push(`Line ${lineNumber}: Error parsing - ${error.message}`);
    }
  }

  // Create groups for individual projects if they don't belong to any group
  projects.forEach((project, projectName) => {
    if (!project.group) {
      const groupId = `INDIVIDUAL_${projectName.replace(/\s+/g, '_').toUpperCase()}`;
      projectGroups.set(groupId, {
        id: groupId,
        projects: [projectName],
        supervisors: project.supervisors,
        primarySupervisor: Array.from(project.supervisors)[0]
      });
      
      project.group = groupId;
      
      // Add group to all supervisors of this project
      project.supervisors.forEach(supervisorName => {
        if (instructors.has(supervisorName)) {
          instructors.get(supervisorName).groups.add(groupId);
        }
      });
    }
  });

  // Convert Sets to Arrays for JSON serialization
  const instructorList = Array.from(instructors.values()).map(instructor => ({
    name: instructor.name,
    projects: Array.from(instructor.projects),
    groups: Array.from(instructor.groups)
  }));

  const projectList = Array.from(projects.values()).map(project => ({
    name: project.name,
    supervisors: Array.from(project.supervisors),
    group: project.group
  }));

  const groupList = Array.from(projectGroups.values()).map(group => ({
    id: group.id,
    projects: group.projects,
    supervisors: Array.from(group.supervisors),
    primarySupervisor: group.primarySupervisor
  }));

  return {
    success: errors.length === 0,
    errors,
    data: {
      instructors: instructorList,
      projects: projectList,
      groups: groupList,
      summary: {
        totalInstructors: instructorList.length,
        totalProjects: projectList.length,
        totalGroups: groupList.length,
        averageProjectsPerInstructor: instructorList.reduce((sum, i) => sum + i.projects.length, 0) / instructorList.length,
        averageGroupsPerInstructor: instructorList.reduce((sum, i) => sum + i.groups.length, 0) / instructorList.length
      }
    }
  };
}

/**
 * Read text file from File input
 * @param {File} file - File object from HTML input
 * @param {Array} excelData - Optional Excel data for instructor-project mappings
 * @returns {Promise<Object>} Parsed instructor and project data
 */
export function readTextFile(file, excelData = null) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    if (!file.type.includes('text') && !file.name.endsWith('.txt')) {
      reject(new Error('File must be a text file (.txt)'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const result = parseInstructorProjectFile(content, excelData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Create sample text file content for demonstration
 * @returns {string} Sample text content
 */
export function createSampleTextContent() {
  return `# Sample Instructor and Project Supervision File
# Format: Instructor Name: Project1, Project2, Project3

Dr. John Smith: AI Chatbot Development, Machine Learning for Healthcare, Natural Language Processing System
Prof. Jane Doe: Web Application Security, E-commerce Platform Development
Dr. Mike Johnson: IoT Smart Home System, Sensor Network Implementation, Home Automation Framework
Prof. Alice Wilson: Data Analytics Dashboard, Business Intelligence System
Dr. Bob Brown: Blockchain Voting System, Cryptocurrency Trading Platform
Prof. Carol White: Mobile Health App, Telemedicine Platform, Patient Monitoring System
Dr. Sarah Green: Virtual Reality Education Game, AR Learning Environment
Prof. David Lee: Cybersecurity Risk Assessment, Network Penetration Testing
Dr. Lisa Taylor: Social Media Analytics, Content Recommendation Engine
Prof. Mark Davis: Cloud Computing Infrastructure, Microservices Architecture

# Single project supervision
Dr. Paul Chen: Database Optimization Tool
Prof. Emma Clark: Image Processing Algorithm
Dr. James Wilson: Music Streaming Application
Prof. Linda Martinez: Financial Forecasting Model
Dr. Kevin Zhang: Supply Chain Management System`;
}

/**
 * Download sample text file
 */
export function downloadSampleTextFile() {
  const content = createSampleTextContent();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_instructor_projects.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Convert a simple instructor list to the proper format with placeholder projects
 * @param {string} instructorListText - Text with one instructor name per line
 * @returns {string} Formatted text with instructor: project format
 */
export function convertInstructorListToFormat(instructorListText) {
  if (!instructorListText || typeof instructorListText !== 'string') {
    return '';
  }

  const lines = instructorListText.split('\n').filter(line => line.trim());
  const formattedLines = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      formattedLines.push(trimmedLine); // Keep comments and empty lines
      return;
    }

    // Check if it looks like an instructor name
    if (trimmedLine.match(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+.+/)) {
      // Add placeholder projects
      const projectNumber = index + 1;
      const formattedLine = `${trimmedLine}: Project ${projectNumber}A, Project ${projectNumber}B`;
      formattedLines.push(formattedLine);
    } else {
      // If it doesn't look like an instructor name, assume it's already formatted
      formattedLines.push(trimmedLine);
    }
  });

  return formattedLines.join('\n');
}

/**
 * Download a template for converting instructor lists
 */
export function downloadInstructorListTemplate() {
  const content = `# Instructor List to Project Assignment Template
# 
# If you have a list of instructors without projects, you can use this template:
# 1. Replace the sample names below with your actual instructor names
# 2. Replace the placeholder projects with actual project names
# 3. Each instructor should have at least one project assigned

Dr. John Smith: AI Chatbot Development, Machine Learning System
Prof. Jane Doe: Web Security Platform
Dr. Mike Johnson: IoT Smart Home, Sensor Network
Prof. Alice Wilson: Data Analytics Dashboard
Dr. Bob Brown: Blockchain Voting System

# Format rules:
# - Use colon (:) to separate instructor name from projects
# - Use comma (,) to separate multiple projects
# - Alternative formats also supported:
#   Dr. John Smith - Project1, Project2
#   Dr. John Smith | Project1 | Project2

# ALTERNATIVELY: For instructor-only lists (when you have Excel data uploaded):
# Simply list instructor names one per line:
# Dr. John Smith
# Prof. Jane Doe
# Dr. Mike Johnson
# Prof. Alice Wilson
# Dr. Bob Brown`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'instructor_list_template.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Extract supervisor statistics from Excel data
 * @param {Array} excelData - Array of project data from Excel
 * @returns {Object} Supervisor statistics
 */
export function extractSupervisorStatistics(excelData) {
  if (!excelData || !Array.isArray(excelData)) {
    return { supervisors: [], totalProjects: 0 };
  }

  const supervisorMap = new Map();

  excelData.forEach((row, index) => {
    const supervisor = row.Supervisor || '';
    const coSupervisor = row['Co-Supervisor'] || '';
    const projectTitle = row['Project Title'] || row.projectTitle || row.Short_Title || `Project_${index + 1}`;
    const projectScope = row['Project Scope'] || row.projectScope || '';

    // Process main supervisor
    if (supervisor.trim()) {
      const normalizedName = supervisor.trim();
      if (!supervisorMap.has(normalizedName)) {
        supervisorMap.set(normalizedName, {
          name: normalizedName,
          projects: [],
          projectCount: 0,
          role: 'Supervisor'
        });
      }
      
      const supervisorData = supervisorMap.get(normalizedName);
      supervisorData.projects.push({
        title: projectTitle,
        scope: projectScope,
        role: 'Primary Supervisor',
        coSupervisor: coSupervisor || null
      });
      supervisorData.projectCount++;
    }

    // Process co-supervisor
    if (coSupervisor.trim()) {
      const normalizedName = coSupervisor.trim();
      if (!supervisorMap.has(normalizedName)) {
        supervisorMap.set(normalizedName, {
          name: normalizedName,
          projects: [],
          projectCount: 0,
          role: 'Co-Supervisor'
        });
      }
      
      const supervisorData = supervisorMap.get(normalizedName);
      supervisorData.projects.push({
        title: projectTitle,
        scope: projectScope,
        role: 'Co-Supervisor',
        primarySupervisor: supervisor || null
      });
      supervisorData.projectCount++;
    }
  });

  const supervisors = Array.from(supervisorMap.values()).map(supervisor => ({
    ...supervisor,
    projects: supervisor.projects.map(p => p.title) // Simplify for basic display
  }));

  return {
    supervisors: supervisors.sort((a, b) => b.projectCount - a.projectCount),
    totalProjects: excelData.length,
    totalSupervisors: supervisors.length,
    averageProjectsPerSupervisor: supervisors.length > 0 ? (supervisors.reduce((sum, s) => sum + s.projectCount, 0) / supervisors.length) : 0,
    detailedData: Array.from(supervisorMap.values()) // Keep detailed data for Excel export
  };
}

/**
 * Download instructor-only template
 */
export function downloadInstructorOnlyTemplate() {
  const content = `# Instructor List Template (for use with Excel data)
# 
# Instructions:
# 1. Upload your FYP Excel file first (with Supervisor and Co-Supervisor columns)
# 2. List instructor names below (one per line)
# 3. The system will automatically extract their projects from the Excel data
# 4. Use exact names as they appear in the Excel file
#
# Format: Just instructor names, one per line

Dr. Muhammad Asim
Mr. Saad Salman
Dr. Hasan Mujtaba
Dr. Hammad Majeed
Dr. Aftab Maroof
Prof. Ahmed Ali
Dr. Sarah Khan
Mr. Irfan Ullah

# Notes:
# - Names should match exactly with the Excel data
# - Include titles (Dr., Prof., Mr., Ms., etc.) as they appear in Excel
# - Empty lines and lines starting with # are ignored`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'instructor_only_template.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
