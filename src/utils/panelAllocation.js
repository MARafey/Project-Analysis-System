/**
 * Panel Allocation System for FYP Projects
 * 
 * This module implements a panel allocation algorithm that distributes projects into panels
 * according to the following constraints:
 * 1. Projects that overlap must be in the same panel
 * 2. Supervisors of overlapping projects must be assigned to the same panel
 * 3. Each panel must meet instructor and project count constraints
 * 4. Distribution should be optimized to avoid overloading any single panel
 */

/**
 * Graph-based Union-Find (Disjoint Set) data structure
 * Used to group overlapping projects into connected components
 */
class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX !== rootY) {
      // Union by rank
      if (this.rank[rootX] < this.rank[rootY]) {
        this.parent[rootX] = rootY;
      } else if (this.rank[rootX] > this.rank[rootY]) {
        this.parent[rootY] = rootX;
      } else {
        this.parent[rootY] = rootX;
        this.rank[rootX]++;
      }
    }
  }

  getComponents() {
    const components = new Map();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      if (!components.has(root)) {
        components.set(root, []);
      }
      components.get(root).push(i);
    }
    return Array.from(components.values());
  }
}

/**
 * Parse supervisor information from project data
 */
function extractSupervisors(project) {
  const supervisors = new Set();
  
  if (project.supervisor && typeof project.supervisor === 'string') {
    supervisors.add(project.supervisor.trim());
  }
  
  if (project.coSupervisor && typeof project.coSupervisor === 'string') {
    supervisors.add(project.coSupervisor.trim());
  }
  
  // Handle original column names from Excel data
  if (project['Supervisor'] && typeof project['Supervisor'] === 'string') {
    supervisors.add(project['Supervisor'].trim());
  }
  
  if (project['Co-Supervisor'] && typeof project['Co-Supervisor'] === 'string') {
    supervisors.add(project['Co-Supervisor'].trim());
  }
  
  return Array.from(supervisors).filter(s => s && s !== 'NaN' && s !== '');
}

/**
 * Find overlapping project groups using similarity data
 */
function findOverlappingGroups(projects, similarityResults, overlapThreshold = 0.5) {
  const projectIdToIndex = new Map();
  projects.forEach((project, index) => {
    projectIdToIndex.set(project.projectId || project['Project Short Title'] || `Project_${index}`, index);
  });

  const unionFind = new UnionFind(projects.length);

  // Group projects based on similarity above threshold
  similarityResults.forEach(similarity => {
    if (similarity.similarityScore >= overlapThreshold) {
      const index1 = projectIdToIndex.get(similarity.project1Id);
      const index2 = projectIdToIndex.get(similarity.project2Id);
      
      if (index1 !== undefined && index2 !== undefined) {
        unionFind.union(index1, index2);
      }
    }
  });

  // Convert component indices back to project groups
  const components = unionFind.getComponents();
  return components.map(indices => indices.map(i => projects[i]));
}

/**
 * Calculate panel allocation using a balanced approach
 */
function allocatePanels(overlappingGroups, allProjects, panelConfig) {
  const {
    numberOfPanels,
    instructorsPerPanel,
    projectsPerPanel,
    sessionDurationMinutes
  } = panelConfig;

  const panels = Array.from({ length: numberOfPanels }, (_, i) => ({
    panelNumber: i + 1,
    projects: [],
    instructors: new Set(),
    totalDuration: 0,
    capacity: {
      maxProjects: projectsPerPanel,
      maxInstructors: instructorsPerPanel,
      sessionDuration: sessionDurationMinutes
    }
  }));

  const constraints = {
    satisfied: [],
    violated: [],
    warnings: []
  };

  // Sort groups by size (largest first) for better allocation
  const sortedGroups = [...overlappingGroups].sort((a, b) => b.length - a.length);
  
  // Track allocated projects to handle individual projects later
  const allocatedProjects = new Set();

  // Phase 1: Allocate overlapping groups
  for (const group of sortedGroups) {
    const groupSupervisors = new Set();
    
    // Collect all supervisors for this group
    group.forEach(project => {
      const supervisors = extractSupervisors(project);
      supervisors.forEach(supervisor => groupSupervisors.add(supervisor));
    });

    // Find the best panel for this group
    let bestPanel = null;
    let bestScore = -1;

    for (const panel of panels) {
      // Check if panel can accommodate this group
      if (panel.projects.length + group.length > panel.capacity.maxProjects) {
        continue;
      }

      // Calculate potential instructor overlap
      const totalInstructors = new Set([...panel.instructors, ...groupSupervisors]);
      if (totalInstructors.size > panel.capacity.maxInstructors) {
        continue;
      }

      // Calculate allocation score (prefer panels with more capacity)
      const projectCapacityScore = (panel.capacity.maxProjects - panel.projects.length) / panel.capacity.maxProjects;
      const instructorCapacityScore = (panel.capacity.maxInstructors - panel.instructors.size) / panel.capacity.maxInstructors;
      const score = (projectCapacityScore + instructorCapacityScore) / 2;

      if (score > bestScore) {
        bestScore = score;
        bestPanel = panel;
      }
    }

    if (bestPanel) {
      // Allocate group to the best panel
      group.forEach(project => {
        bestPanel.projects.push(project);
        allocatedProjects.add(project.projectId || project['Project Short Title'] || `Project_${bestPanel.projects.length}`);
      });
      
      groupSupervisors.forEach(supervisor => {
        bestPanel.instructors.add(supervisor);
      });

      // Update duration (assume each project takes equal time)
      const projectDuration = sessionDurationMinutes / projectsPerPanel;
      bestPanel.totalDuration += group.length * projectDuration;

      constraints.satisfied.push(
        `Group of ${group.length} overlapping projects allocated to Panel ${bestPanel.panelNumber}`
      );
    } else {
      constraints.violated.push(
        `Cannot allocate group of ${group.length} projects - exceeds panel constraints`
      );
    }
  }

  // Phase 2: Allocate remaining individual projects
  for (const project of allProjects) {
    const projectId = project.projectId || project['Project Short Title'] || 'Unknown';
    
    if (allocatedProjects.has(projectId)) {
      continue; // Already allocated as part of a group
    }

    const projectSupervisors = extractSupervisors(project);
    let allocated = false;

    // Try to find a panel with capacity
    for (const panel of panels) {
      if (panel.projects.length >= panel.capacity.maxProjects) {
        continue;
      }

      const totalInstructors = new Set([...panel.instructors, ...projectSupervisors]);
      if (totalInstructors.size > panel.capacity.maxInstructors) {
        continue;
      }

      // Allocate to this panel
      panel.projects.push(project);
      projectSupervisors.forEach(supervisor => {
        panel.instructors.add(supervisor);
      });

      const projectDuration = sessionDurationMinutes / projectsPerPanel;
      panel.totalDuration += projectDuration;
      allocated = true;
      break;
    }

    if (!allocated) {
      constraints.violated.push(
        `Cannot allocate project "${projectId}" - no panel has sufficient capacity`
      );
    }
  }

  // Phase 3: Validate constraints and generate warnings
  panels.forEach(panel => {
    if (panel.projects.length < projectsPerPanel * 0.7) {
      constraints.warnings.push(
        `Panel ${panel.panelNumber} is under-utilized (${panel.projects.length}/${panel.capacity.maxProjects} projects)`
      );
    }

    if (panel.instructors.size < instructorsPerPanel * 0.7) {
      constraints.warnings.push(
        `Panel ${panel.panelNumber} has fewer instructors than optimal (${panel.instructors.size}/${panel.capacity.maxInstructors})`
      );
    }

    if (panel.totalDuration > sessionDurationMinutes * 1.1) {
      constraints.warnings.push(
        `Panel ${panel.panelNumber} may exceed time limit (${Math.round(panel.totalDuration)}/${sessionDurationMinutes} minutes)`
      );
    }
  });

  // Convert instructor sets to arrays for JSON serialization
  const formattedPanels = panels.map(panel => ({
    ...panel,
    instructors: Array.from(panel.instructors),
    totalDuration: Math.round(panel.totalDuration)
  }));

  return {
    panels: formattedPanels,
    constraints,
    summary: {
      totalProjects: allProjects.length,
      allocatedProjects: formattedPanels.reduce((sum, panel) => sum + panel.projects.length, 0),
      totalPanels: numberOfPanels,
      averageProjectsPerPanel: formattedPanels.reduce((sum, panel) => sum + panel.projects.length, 0) / numberOfPanels,
      averageInstructorsPerPanel: formattedPanels.reduce((sum, panel) => sum + panel.instructors.length, 0) / numberOfPanels
    }
  };
}

/**
 * Generate optimized panel allocation suggestions
 */
function generateOptimalAllocation(projects, similarityResults, constraints) {
  const suggestions = [];
  
  // Analyze current constraints
  const totalProjects = projects.length;
  const uniqueSupervisors = new Set();
  
  projects.forEach(project => {
    const supervisors = extractSupervisors(project);
    supervisors.forEach(supervisor => uniqueSupervisors.add(supervisor));
  });

  const totalSupervisors = uniqueSupervisors.size;
  
  // Calculate optimal parameters
  const optimalPanels = Math.ceil(totalProjects / 8); // Assume 6-10 projects per panel is optimal
  const optimalProjectsPerPanel = Math.ceil(totalProjects / optimalPanels);
  const optimalInstructorsPerPanel = Math.min(Math.ceil(totalSupervisors / optimalPanels), 5);

  suggestions.push({
    type: 'optimal_configuration',
    recommendation: {
      numberOfPanels: optimalPanels,
      projectsPerPanel: optimalProjectsPerPanel,
      instructorsPerPanel: optimalInstructorsPerPanel,
      sessionDurationMinutes: optimalProjectsPerPanel * 15 // 15 minutes per project
    },
    reasoning: `Based on ${totalProjects} projects and ${totalSupervisors} supervisors, this configuration provides balanced panels.`
  });

  // Analyze similarity data for overlap issues
  const highSimilarityPairs = similarityResults.filter(sim => sim.similarityScore > 0.6).length;
  if (highSimilarityPairs > 0) {
    suggestions.push({
      type: 'overlap_warning',
      count: highSimilarityPairs,
      recommendation: 'Consider reviewing highly similar projects for potential consolidation or coordination.',
      reasoning: `Found ${highSimilarityPairs} project pairs with >60% similarity that will be grouped together.`
    });
  }

  return suggestions;
}

/**
 * Main panel allocation function
 */
export function allocateProjectsToPanels(projects, similarityResults, panelConfig) {
  try {
    // Validate input parameters
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      throw new Error('Invalid projects data: must be a non-empty array');
    }

    if (!similarityResults || !Array.isArray(similarityResults)) {
      throw new Error('Invalid similarity results: must be an array');
    }

    if (!panelConfig || typeof panelConfig !== 'object') {
      throw new Error('Invalid panel configuration: must be an object');
    }

    const {
      numberOfPanels,
      instructorsPerPanel,
      projectsPerPanel,
      sessionDurationMinutes,
      overlapThreshold = 0.5
    } = panelConfig;

    // Validate panel configuration
    if (!numberOfPanels || numberOfPanels < 1) {
      throw new Error('Number of panels must be at least 1');
    }

    if (!projectsPerPanel || projectsPerPanel < 1) {
      throw new Error('Projects per panel must be at least 1');
    }

    if (!instructorsPerPanel || instructorsPerPanel < 1) {
      throw new Error('Instructors per panel must be at least 1');
    }

    if (!sessionDurationMinutes || sessionDurationMinutes < 1) {
      throw new Error('Session duration must be at least 1 minute');
    }

    // Find overlapping project groups
    const overlappingGroups = findOverlappingGroups(projects, similarityResults, overlapThreshold);
    
    // Allocate projects to panels
    const allocationResult = allocatePanels(overlappingGroups, projects, panelConfig);
    
    // Generate optimization suggestions
    const suggestions = generateOptimalAllocation(projects, similarityResults, panelConfig);
    
    return {
      success: true,
      allocation: allocationResult,
      suggestions,
      metadata: {
        totalProjects: projects.length,
        overlappingGroups: overlappingGroups.length,
        largestGroup: Math.max(...overlappingGroups.map(group => group.length)),
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      allocation: null,
      suggestions: [],
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Export panel allocation results to structured format
 */
export function formatPanelAllocationReport(allocationResult) {
  if (!allocationResult.success) {
    return {
      error: allocationResult.error,
      report: null
    };
  }

  const { allocation, suggestions, metadata } = allocationResult;
  const { panels, constraints, summary } = allocation;

  const report = {
    summary: {
      ...summary,
      generatedAt: new Date().toLocaleString(),
      totalConstraintsSatisfied: constraints.satisfied.length,
      totalConstraintsViolated: constraints.violated.length,
      totalWarnings: constraints.warnings.length
    },
    panels: panels.map(panel => ({
      panelNumber: panel.panelNumber,
      projectCount: panel.projects.length,
      instructorCount: panel.instructors.length,
      totalDuration: panel.totalDuration,
      projects: panel.projects.map(project => ({
        id: project.projectId || project['Project Short Title'] || 'Unknown',
        title: project.projectTitle || project['Project Title'] || 'Unknown Title',
        supervisors: extractSupervisors(project)
      })),
      instructors: panel.instructors,
      utilizationMetrics: {
        projectUtilization: Math.round((panel.projects.length / panel.capacity.maxProjects) * 100),
        instructorUtilization: Math.round((panel.instructors.length / panel.capacity.maxInstructors) * 100),
        timeUtilization: Math.round((panel.totalDuration / panel.capacity.sessionDuration) * 100)
      }
    })),
    constraints: {
      satisfied: constraints.satisfied,
      violated: constraints.violated,
      warnings: constraints.warnings
    },
    suggestions,
    metadata
  };

  return {
    error: null,
    report
  };
}

/**
 * Validate panel allocation constraints
 */
export function validatePanelConstraints(allocationResult, originalConfig) {
  const validation = {
    valid: true,
    issues: [],
    metrics: {}
  };

  if (!allocationResult.success) {
    validation.valid = false;
    validation.issues.push(`Allocation failed: ${allocationResult.error}`);
    return validation;
  }

  const { panels } = allocationResult.allocation;
  const { numberOfPanels, projectsPerPanel, instructorsPerPanel, sessionDurationMinutes } = originalConfig;

  // Check panel count
  if (panels.length !== numberOfPanels) {
    validation.valid = false;
    validation.issues.push(`Expected ${numberOfPanels} panels, got ${panels.length}`);
  }

  // Check each panel's constraints
  panels.forEach(panel => {
    if (panel.projects.length > projectsPerPanel) {
      validation.valid = false;
      validation.issues.push(`Panel ${panel.panelNumber} exceeds project limit: ${panel.projects.length}/${projectsPerPanel}`);
    }

    if (panel.instructors.length > instructorsPerPanel) {
      validation.valid = false;
      validation.issues.push(`Panel ${panel.panelNumber} exceeds instructor limit: ${panel.instructors.length}/${instructorsPerPanel}`);
    }

    if (panel.totalDuration > sessionDurationMinutes) {
      validation.issues.push(`Panel ${panel.panelNumber} may exceed time limit: ${panel.totalDuration}/${sessionDurationMinutes} minutes`);
    }
  });

  // Calculate efficiency metrics
  validation.metrics = {
    averageProjectsPerPanel: panels.reduce((sum, p) => sum + p.projects.length, 0) / panels.length,
    averageInstructorsPerPanel: panels.reduce((sum, p) => sum + p.instructors.length, 0) / panels.length,
    panelUtilization: panels.reduce((sum, p) => sum + (p.projects.length / projectsPerPanel), 0) / panels.length,
    instructorUtilization: panels.reduce((sum, p) => sum + (p.instructors.length / instructorsPerPanel), 0) / panels.length
  };

  return validation;
}
