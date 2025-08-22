/**
 * Text File Parser for Instructor Lists
 * 
 * This module parses text files containing instructor names and automatically extracts
 * their project supervision information from Excel data for panel allocation.
 * 
 * Features:
 * - Auto-splits text on title keywords (Dr, Prof, Mr, Ms, Mrs)
 * - Smart formatting of instructor names
 * - Requires Excel data to be uploaded first
 * 
 * Expected format: 
 * - One instructor name per line, OR
 * - Multiple instructors in any format (auto-split enabled)
 */

/**
 * Extract projects for a specific instructor from Excel data
 * @param {string} instructorName - Name of the instructor
 * @param {Array} excelData - Array of project data from Excel
 * @returns {Array} Array of project titles for the instructor
 */
function extractProjectsForInstructor(instructorName, excelData) {
  if (!excelData || !Array.isArray(excelData)) {
    console.warn('Invalid Excel data provided to extractProjectsForInstructor');
    return [];
  }

  const projects = [];
  const normalizedInstructorName = normalizeInstructorName(instructorName);

  console.log(`Looking for instructor: "${instructorName}" (normalized: "${normalizedInstructorName}")`);

  excelData.forEach((row, index) => {
    // Get supervisor columns with case-insensitive fallback
    const supervisor = getSupervisorColumn(row, 'supervisor') || '';
    
    const normalizedSupervisor = normalizeInstructorName(supervisor);
    
    // Get project title with multiple fallbacks
    const projectTitle = getProjectTitleColumn(row) || '';

    if (index === 0) {
      console.log('Sample row columns:', Object.keys(row));
      console.log('Sample supervisor:', supervisor);
    }

    if (projectTitle && normalizedSupervisor === normalizedInstructorName) {
      projects.push(projectTitle);
      console.log(`Found project "${projectTitle}" for instructor "${instructorName}"`);
    }
  });

  console.log(`Found ${projects.length} projects for "${instructorName}":`, projects);
  return [...new Set(projects)]; // Remove duplicates
}

/**
 * Get supervisor column with case-insensitive matching
 * @param {Object} row - Excel row data
 * @param {string} type - 'supervisor' or 'co-supervisor'
 * @returns {string} Supervisor name
 */
function getSupervisorColumn(row, type) {
  const keys = Object.keys(row);
  
  if (type === 'supervisor') {
    // Look for exact match first, then case-insensitive
    return row['Supervisor'] || 
           row['supervisor'] || 
           row['SUPERVISOR'] ||
           keys.find(key => key.toLowerCase().trim() === 'supervisor') ? row[keys.find(key => key.toLowerCase().trim() === 'supervisor')] : '';
  }
  
  return '';
}

/**
 * Get project title column with multiple fallbacks
 * @param {Object} row - Excel row data
 * @returns {string} Project title
 */
function getProjectTitleColumn(row) {
  const keys = Object.keys(row);
  
  // Try exact matches first
  return row['Project Title'] || 
         row['project title'] || 
         row['PROJECT TITLE'] ||
         row['Project_Title'] ||
         row['projectTitle'] ||
         row['Short_Title'] || 
         row['short_title'] ||
         row['Short Title'] ||
         row['projectId'] ||
         // Case-insensitive search
         keys.find(key => key.toLowerCase().includes('project') && key.toLowerCase().includes('title')) ? row[keys.find(key => key.toLowerCase().includes('project') && key.toLowerCase().includes('title'))] : 
         keys.find(key => key.toLowerCase().includes('title')) ? row[keys.find(key => key.toLowerCase().includes('title'))] : '';
}

/**
 * Get project scope column with multiple fallbacks
 * @param {Object} row - Excel row data
 * @returns {string} Project scope
 */
function getProjectScopeColumn(row) {
  const keys = Object.keys(row);
  
  // Try exact matches first
  return row['Project Scope'] || 
         row['project scope'] || 
         row['PROJECT SCOPE'] ||
         row['Project_Scope'] ||
         row['projectScope'] ||
         row['scope'] ||
         row['Scope'] ||
         // Case-insensitive search
         keys.find(key => key.toLowerCase().includes('scope')) ? row[keys.find(key => key.toLowerCase().includes('scope'))] : '';
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
 * Format instructor name to proper case
 * @param {string} name - Raw instructor name
 * @returns {string} Formatted instructor name
 */
function formatInstructorName(name) {
  if (!name || typeof name !== 'string') return '';
  
  // Split into words and capitalize each word
  const words = name.trim().split(/\s+/);
  const formattedWords = words.map(word => {
    if (word.length === 0) return word;
    
    // Handle common titles
    const title = word.toLowerCase();
    if (title === 'dr' || title === 'dr.') return 'Dr.';
    if (title === 'prof' || title === 'prof.') return 'Prof.';
    if (title === 'mr' || title === 'mr.') return 'Mr.';
    if (title === 'ms' || title === 'ms.') return 'Ms.';
    if (title === 'mrs' || title === 'mrs.') return 'Mrs.';
    
    // Capitalize first letter, lowercase the rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return formattedWords.join(' ');
}

/**
 * Auto-split text content on title keywords to extract instructor names
 * @param {string} textContent - Raw text content that may contain multiple instructors
 * @returns {Array} Array of individual instructor name strings
 */
function autoSplitInstructorNames(textContent) {
  if (!textContent || typeof textContent !== 'string') return [];
  
  // Define title keywords to split on (case-insensitive)
  const titleKeywords = ['dr', 'prof', 'mr', 'ms', 'mrs'];
  
  // Split content into lines first
  const lines = textContent.split('\n').filter(line => line.trim());
  const extractedNames = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue;
    }
    
    // Check if line already contains a single instructor name
    if (trimmedLine.match(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+[A-Za-z]+\s+[A-Za-z]+/)) {
      // Single instructor name - add as is
      extractedNames.push(trimmedLine);
      continue;
    }
    
    // Try to auto-split on title keywords
    let currentName = '';
    const words = trimmedLine.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = words[i + 1];
      const nextNextWord = words[i + 2];
      
      // Check if current word is a title keyword
      const isTitle = titleKeywords.some(keyword => 
        word.toLowerCase() === keyword || word.toLowerCase() === keyword + '.'
      );
      
      if (isTitle && nextWord && nextNextWord) {
        // We found a title with at least 2 following words
        if (currentName.trim()) {
          // Save the previous name if it exists
          extractedNames.push(currentName.trim());
        }
        
        // Start building the new name with proper formatting
        let title = word;
        if (!title.endsWith('.')) {
          title = title + '.';
        }
        currentName = `${title} ${nextWord} ${nextNextWord}`;
        
        // Look for additional words that might be part of this name
        let j = i + 3;
        while (j < words.length && !titleKeywords.some(keyword => 
          words[j].toLowerCase() === keyword || words[j].toLowerCase() === keyword + '.'
        )) {
          currentName += ` ${words[j]}`;
          j++;
        }
        
        // Skip the words we've already processed
        i = j - 1;
      } else if (currentName) {
        // Continue building current name
        currentName += ` ${word}`;
      } else if (word && nextWord && !isTitle) {
        // No title found, but we have at least 2 words - treat as a name
        currentName = `${word} ${nextWord}`;
        
        // Look for additional words
        let j = i + 2;
        while (j < words.length && !titleKeywords.some(keyword => 
          words[j].toLowerCase() === keyword || words[j].toLowerCase() === keyword + '.'
        )) {
          currentName += ` ${words[j]}`;
          j++;
        }
        
        // Skip the words we've already processed
        i = j - 1;
      }
    }
    
    // Add the last name if it exists
    if (currentName.trim()) {
      extractedNames.push(currentName.trim());
    }
  }
  
  return extractedNames;
}

/**
 * Parse text file content to extract instructors and their supervised projects
 * 
 * Features:
 * - Auto-splits text on title keywords (Dr, Prof, Mr, Ms, Mrs)
 * - Handles various input formats automatically
 * - Smart name formatting and validation
 * 
 * Expected formats:
 * 1. One instructor per line:
 *    Dr. Muhammad Asim
 *    Mr. Saad Salman
 *    Dr. Hasan Mujtaba
 * 
 * 2. Multiple instructors in any format (auto-split enabled):
 *    Dr Muhammad Asim Mr Saad Salman Prof Ahmed Ali
 *    Dr. Hasan Mujtaba Ms Sarah Khan
 * 
 * @param {string} textContent - Raw text content from file
 * @param {Array} excelData - Excel data containing supervisor-project mappings (required)
 * @returns {Object} Parsed data with instructors and projects
 */
export function parseInstructorProjectFile(textContent, excelData = null) {
  if (!textContent || typeof textContent !== 'string') {
    throw new Error('Invalid text content provided');
  }

  if (!excelData || !Array.isArray(excelData)) {
    throw new Error('Excel data is required. Please upload an Excel file first before uploading the instructor list.');
  }

  const instructors = new Map();
  const projects = new Map();
  const projectGroups = new Map();
  
  // Auto-split text content on title keywords to extract individual instructor names
  const extractedNames = autoSplitInstructorNames(textContent);
  
  if (extractedNames.length === 0) {
    throw new Error('No instructor names found in the text content. Please check the format.');
  }
  
  console.log(`🔍 Auto-split found ${extractedNames.length} instructor names:`, extractedNames);

  let lineNumber = 0;
  const errors = [];

  for (const extractedName of extractedNames) {
    lineNumber++;
    const trimmedName = extractedName.trim();
    
    if (!trimmedName) {
      continue; // Skip empty names
    }

    try {
      // Process the extracted instructor name
      let instructorName = trimmedName;
      let projectsText = '';
      
      // Check if it looks like an instructor name and format it if needed
      let formattedInstructorName = trimmedName;
      
      // Check for various instructor name patterns
      if (trimmedName.match(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+.+/)) {
        // Already has title - use as is
        formattedInstructorName = trimmedName;
      } else if (trimmedName.match(/^[A-Z][a-z]+\s+[A-Z]/)) {
        // Has proper capitalization (FirstName LastName) - use as is
        formattedInstructorName = trimmedName;
      } else if (trimmedName.match(/^[a-z]+\s+[a-z]+/i)) {
        // Lowercase or mixed case names - try to format them
        formattedInstructorName = formatInstructorName(trimmedName);
        console.log(`ℹ️ Formatted instructor name: "${trimmedName}" → "${formattedInstructorName}"`);
      } else if (trimmedName.match(/^[A-Z]+\s+[A-Z]+/)) {
        // ALL CAPS names - format them
        formattedInstructorName = formatInstructorName(trimmedName);
        console.log(`ℹ️ Formatted instructor name: "${trimmedName}" → "${formattedInstructorName}"`);
      } else {
        // Try to extract what looks like a name
        const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
        if (nameParts.length >= 2) {
          formattedInstructorName = formatInstructorName(trimmedName);
          console.log(`ℹ️ Attempted to format instructor name: "${trimmedName}" → "${formattedInstructorName}"`);
        } else {
          errors.push(`Line ${lineNumber}: Invalid instructor name format - "${trimmedName}". Expected: "FirstName LastName" or "Dr./Prof./Mr./Ms. FirstName LastName"`);
          continue;
        }
      }
      
      // Extract projects for this instructor from Excel data
      const instructorProjects = extractProjectsForInstructor(formattedInstructorName, excelData);
      
      if (instructorProjects.length > 0) {
        // Instructor is a supervisor with projects
        projectsText = instructorProjects.join(', ');
        console.log(`✅ Supervisor "${formattedInstructorName}" found with ${instructorProjects.length} projects`);
      } else {
        // Instructor has no projects - treat as panel member
        projectsText = '';
        console.log(`ℹ️ Panel member "${formattedInstructorName}" added (no projects found in Excel)`);
      }
      
      // Update instructor name to use formatted version
      instructorName = formattedInstructorName;

      instructorName = instructorName.trim();
      projectsText = projectsText.trim();

      // Handle case where instructor has no projects (panel member)
      if (!instructorName) {
        errors.push(`Line ${lineNumber}: Missing instructor name - ${trimmedName}`);
        continue;
      }

      // If no projects text, this is a panel member without projects
      if (!projectsText) {
        // Store instructor as panel member (no projects)
        if (!instructors.has(instructorName)) {
          instructors.set(instructorName, {
            name: instructorName,
            projects: new Set(),
            groups: new Set()
          });
        }
        console.log(`ℹ️ Panel member "${instructorName}" added (no projects)`);
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
        averageProjectsPerInstructor: instructorList.length > 0 ? instructorList.reduce((sum, i) => sum + i.projects.length, 0) / instructorList.length : 0,
        averageGroupsPerInstructor: instructorList.length > 0 ? instructorList.reduce((sum, i) => sum + i.groups.length, 0) / instructorList.length : 0
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
  return `# Sample Instructor List for Panel Allocation
# Format: One instructor name per line
# 
# Instructions:
# 1. Upload your FYP Excel file first (with Supervisor columns)
# 2. List instructor names below (one per line)
# 3. The system will automatically extract their projects from the Excel data
# 4. Use exact names as they appear in the Excel file

Dr. John Smith
Prof. Jane Doe
Dr. Mike Johnson
Prof. Alice Wilson
Dr. Bob Brown
Prof. Carol White
Dr. Sarah Green
Prof. David Lee
Dr. Lisa Taylor
Prof. Mark Davis
Dr. Paul Chen
Prof. Emma Clark
Dr. James Wilson
Prof. Linda Martinez
Dr. Kevin Zhang

# Notes:
# - Names should match exactly with the Excel data
# - Include titles (Dr., Prof., Mr., Ms., etc.) as they appear in Excel
# - Empty lines and lines starting with # are ignored
# - Instructors not found in Excel will be added as panel members`;
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
  a.download = 'sample_instructor_list.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}



/**
 * Download a template for instructor lists
 */
export function downloadInstructorListTemplate() {
  const content = `# Instructor List Template for Panel Allocation
# 
# Instructions:
# 1. Upload your FYP Excel file first (containing supervisor and project data)
# 2. List instructor names below (one per line)
# 3. The system will automatically extract their projects from the Excel data
# 4. Use exact names as they appear in the Excel file
#
# Format: One instructor name per line

Dr. John Smith
Prof. Jane Doe
Dr. Mike Johnson
Prof. Alice Wilson
Dr. Bob Brown
Prof. Carol White
Dr. Sarah Green
Prof. David Lee
Dr. Lisa Taylor
Prof. Mark Davis

# Notes:
# - Names should match exactly with the Excel data
# - Include titles (Dr., Prof., Mr., Ms., etc.) as they appear in Excel
# - Empty lines and lines starting with # are ignored
# - Instructors not found in Excel will be added as panel members
# - Excel file must be uploaded BEFORE uploading this instructor list`;

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
    const supervisor = getSupervisorColumn(row, 'supervisor') || '';
    const projectTitle = getProjectTitleColumn(row) || `Project_${index + 1}`;
    const projectScope = getProjectScopeColumn(row) || '';

    // Debug logging for first row
    if (index === 0) {
      console.log('Excel columns detected:', Object.keys(row));
      console.log('Supervisor found:', supervisor);
      console.log('Project Title found:', projectTitle);
    }

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
