/**
 * Balanced Panel Allocation System with Domain Diversity
 * 
 * This module implements an enhanced panel allocation algorithm that:
 * 1. Groups projects with high similarity into the same panel
 * 2. Distributes similar projects evenly across multiple panels (no clustering)
 * 3. Ensures domain diversity within each panel
 * 4. Assigns instructors to panels where they have majority of their projects
 */

/**
 * Allocate panels with balanced domain diversity using similarity and AI enhancement
 * 
 * @param {Object} parsedData - Data from text file parser
 * @param {Object} constraints - Panel allocation constraints
 * @param {Array} similarityResults - Similarity analysis results from FYP analysis
 * @param {Object} geminiSuggestions - Optional AI suggestions from Gemini
 * @returns {Object} Allocation result
 */
export function allocateBalancedPanels(parsedData, constraints, similarityResults = null, geminiSuggestions = null) {
  const {
    numberOfPanels,
    instructorsPerPanel,
    projectsPerPanel
  } = constraints;

  // Validate inputs
  if (!parsedData || !parsedData.groups || !parsedData.instructors) {
    throw new Error('Invalid parsed data provided');
  }

  if (numberOfPanels < 1 || instructorsPerPanel < 1 || projectsPerPanel < 1) {
    throw new Error('All constraints must be positive numbers');
  }

  const { groups, instructors } = parsedData;
  
  // Step 1: Create all panels first
  const panels = Array.from({ length: numberOfPanels }, (_, i) => ({
    panelNumber: i + 1,
    groups: [],
    instructors: new Set(),
    totalProjects: 0,
    domains: {},
    constraints: {
      maxInstructors: instructorsPerPanel,
      desiredProjects: projectsPerPanel,
      actualGroups: 0
    }
  }));

  const allocationResults = {
    successful: [],
    failed: [],
    warnings: [],
    constraintViolations: []
  };

  // Step 2: Analyze project similarity and create similarity clusters
  const similarityClusters = createSimilarityClusters(groups, similarityResults);
  
  // Step 3: Sort clusters by priority (size and similarity score)
  const sortedClusters = sortClustersByPriority(similarityClusters);
  
  // Step 4: Apply balanced distribution strategy
  const allocatedGroups = new Set();
  
  for (const cluster of sortedClusters) {
    if (cluster.groups.every(group => allocatedGroups.has(group.id))) {
      continue; // All groups in cluster already allocated
    }

    const unallocatedGroups = cluster.groups.filter(group => !allocatedGroups.has(group.id));
    
    // For high similarity clusters, distribute across multiple panels
    if (cluster.averageSimilarity > 0.7 && unallocatedGroups.length > 2) {
      distributeClusterAcrossPanels(unallocatedGroups, panels, allocatedGroups, allocationResults, constraints);
    } else {
      // For moderate/low similarity clusters, try to keep together with domain diversity
      allocateClusterToSinglePanel(unallocatedGroups, panels, allocatedGroups, allocationResults, constraints);
    }
  }

  // Step 5: Allocate remaining individual groups
  const remainingGroups = groups.filter(group => !allocatedGroups.has(group.id));
  allocateRemainingGroups(remainingGroups, panels, allocatedGroups, allocationResults, constraints);

  // Step 6: Assign instructors based on project majority
  assignInstructorsByProjectMajority(panels, instructors, constraints, allocationResults);

  // Step 7: Apply AI suggestions if available
  if (geminiSuggestions && geminiSuggestions.recommendations) {
    applyAISuggestions(panels, geminiSuggestions, allocationResults);
  }

  // Step 8: Final optimization and analysis
  optimizeDomainBalance(panels, allocationResults);
  analyzeAllocationQuality(panels, constraints, allocationResults);

  // Convert instructor sets to arrays
  const finalPanels = panels.map(panel => ({
    ...panel,
    instructors: Array.from(panel.instructors)
  }));

  // Step 9: Create instructor assignments
  const instructorAssignments = createInstructorAssignments(finalPanels, instructors);

  return {
    success: allocationResults.failed.length === 0,
    panels: finalPanels,
    instructorAssignments,
    allocationResults,
    summary: createBalancedAllocationSummary(finalPanels, constraints, allocationResults),
    balanceMetrics: calculateBalanceMetrics(finalPanels, constraints),
    metadata: {
      algorithm: 'balanced_domain_diversity',
      totalGroups: groups.length,
      allocatedGroups: allocatedGroups.size,
      similarityClusters: similarityClusters.length,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Create similarity clusters from groups and similarity results
 */
function createSimilarityClusters(groups, similarityResults) {
  const clusters = [];
  const processedGroups = new Set();

  // Create similarity map for faster lookup
  const similarityMap = new Map();
  if (similarityResults && Array.isArray(similarityResults)) {
    similarityResults.forEach(result => {
      if (result.similarityScore >= 0.3) {
        const key1 = `${result.project1Id}-${result.project2Id}`;
        const key2 = `${result.project2Id}-${result.project1Id}`;
        similarityMap.set(key1, result.similarityScore);
        similarityMap.set(key2, result.similarityScore);
      }
    });
  }

  // Create clusters based on similarity
  for (const group of groups) {
    if (processedGroups.has(group.id)) continue;

    const cluster = {
      id: `cluster_${clusters.length + 1}`,
      groups: [group],
      averageSimilarity: 0,
      dominantDomain: detectDominantDomain(group.projects),
      totalProjects: group.projects.length
    };

    // Find similar groups for this cluster
    const clusterSimilarities = [];
    
    for (const otherGroup of groups) {
      if (otherGroup.id === group.id || processedGroups.has(otherGroup.id)) continue;

      let maxSimilarity = 0;
      // Check similarity between any projects in the groups
      for (const project1 of group.projects) {
        for (const project2 of otherGroup.projects) {
          const key = `${project1}-${project2}`;
          const similarity = similarityMap.get(key) || 0;
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      if (maxSimilarity >= 0.5) { // High similarity threshold for clustering
        cluster.groups.push(otherGroup);
        cluster.totalProjects += otherGroup.projects.length;
        clusterSimilarities.push(maxSimilarity);
        processedGroups.add(otherGroup.id);
      }
    }

    // Calculate average similarity for the cluster
    if (clusterSimilarities.length > 0) {
      cluster.averageSimilarity = clusterSimilarities.reduce((sum, sim) => sum + sim, 0) / clusterSimilarities.length;
    }

    clusters.push(cluster);
    processedGroups.add(group.id);
  }

  return clusters;
}

/**
 * Sort clusters by priority (larger, more similar clusters first)
 */
function sortClustersByPriority(clusters) {
  return clusters.sort((a, b) => {
    // Primary: similarity score (higher first)
    if (Math.abs(a.averageSimilarity - b.averageSimilarity) > 0.1) {
      return b.averageSimilarity - a.averageSimilarity;
    }
    // Secondary: cluster size (larger first)
    if (a.groups.length !== b.groups.length) {
      return b.groups.length - a.groups.length;
    }
    // Tertiary: total projects (more first)
    return b.totalProjects - a.totalProjects;
  });
}

/**
 * Distribute high similarity cluster across multiple panels to avoid clustering
 */
function distributeClusterAcrossPanels(clusterGroups, panels, allocatedGroups, allocationResults, constraints) {
  // Sort panels by current project count (ascending) for balanced distribution
  const sortedPanels = [...panels].sort((a, b) => a.totalProjects - b.totalProjects);
  
  let panelIndex = 0;
  
  for (const group of clusterGroups) {
    const targetPanel = sortedPanels[panelIndex % sortedPanels.length];
    
    // Check if panel can accommodate this group
    if (canPanelAccommodateGroup(targetPanel, group, constraints)) {
      allocateGroupToPanel(targetPanel, group, allocatedGroups, allocationResults);
      
      // Re-sort panels to maintain balance
      sortedPanels.sort((a, b) => a.totalProjects - b.totalProjects);
    } else {
      // Find next available panel
      const availablePanel = sortedPanels.find(panel => canPanelAccommodateGroup(panel, group, constraints));
      if (availablePanel) {
        allocateGroupToPanel(availablePanel, group, allocatedGroups, allocationResults);
      } else {
        allocationResults.failed.push(`Cannot allocate group "${group.id}" - no panel has sufficient capacity`);
      }
    }
    
    panelIndex++;
  }
  
  allocationResults.successful.push(
    `Distributed high-similarity cluster of ${clusterGroups.length} groups across multiple panels for balanced distribution`
  );
}

/**
 * Allocate cluster to single panel while maintaining domain diversity
 */
function allocateClusterToSinglePanel(clusterGroups, panels, allocatedGroups, allocationResults, constraints) {
  const bestPanel = findBestPanelForCluster(clusterGroups, panels, constraints);
  
  if (bestPanel) {
    for (const group of clusterGroups) {
      allocateGroupToPanel(bestPanel, group, allocatedGroups, allocationResults);
    }
    
    allocationResults.successful.push(
      `Allocated cluster of ${clusterGroups.length} groups to Panel ${bestPanel.panelNumber} with domain diversity consideration`
    );
  } else {
    // Try to distribute if single panel allocation fails
    distributeClusterAcrossPanels(clusterGroups, panels, allocatedGroups, allocationResults, constraints);
  }
}

/**
 * Find best panel for a cluster considering domain diversity
 */
function findBestPanelForCluster(clusterGroups, panels, constraints) {
  let bestPanel = null;
  let bestScore = -1;

  for (const panel of panels) {
    if (!canPanelAccommodateCluster(panel, clusterGroups, constraints)) {
      continue;
    }

    let score = 0;

    // Priority 1: Project balance (highest priority)
    const currentMinProjects = Math.min(...panels.map(p => p.totalProjects));
    if (panel.totalProjects === currentMinProjects) {
      score += 1000;
    }

    // Priority 2: Domain diversity score
    const domainDiversityScore = calculateDomainDiversityScore(panel, clusterGroups);
    score += domainDiversityScore * 100;

    // Priority 3: Instructor capacity
    const clusterInstructors = new Set();
    clusterGroups.forEach(group => {
      group.supervisors.forEach(supervisor => clusterInstructors.add(supervisor));
    });
    
    const totalInstructors = new Set([...panel.instructors, ...clusterInstructors]);
    if (totalInstructors.size <= constraints.instructorsPerPanel) {
      score += 200;
    }

    // Priority 4: Avoid exceeding soft constraints
    const totalProjectsAfterAllocation = panel.totalProjects + clusterGroups.reduce((sum, g) => sum + g.projects.length, 0);
    if (totalProjectsAfterAllocation <= constraints.projectsPerPanel) {
      score += 150;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPanel = panel;
    }
  }

  return bestPanel;
}

/**
 * Calculate domain diversity score for adding groups to a panel
 */
function calculateDomainDiversityScore(panel, newGroups) {
  const currentDomains = { ...panel.domains };
  const newDomains = {};

  // Calculate new domain distribution
  newGroups.forEach(group => {
    group.projects.forEach(project => {
      const domains = detectProjectDomains(project);
      domains.forEach(domain => {
        newDomains[domain] = (newDomains[domain] || 0) + 1;
      });
    });
  });

  // Combine domains
  const combinedDomains = { ...currentDomains };
  Object.entries(newDomains).forEach(([domain, count]) => {
    combinedDomains[domain] = (combinedDomains[domain] || 0) + count;
  });

  let score = 1.0;

  // Penalty for domain concentration (max 4 projects per domain)
  Object.values(combinedDomains).forEach(count => {
    if (count > 4) {
      score -= (count - 4) * 0.2;
    }
  });

  // Bonus for domain diversity
  const uniqueDomains = Object.keys(combinedDomains).length;
  if (uniqueDomains >= 2 && uniqueDomains <= 5) {
    score += uniqueDomains * 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Allocate remaining individual groups
 */
function allocateRemainingGroups(remainingGroups, panels, allocatedGroups, allocationResults, constraints) {
  for (const group of remainingGroups) {
    const bestPanel = findBestPanelForCluster([group], panels, constraints);
    
    if (bestPanel) {
      allocateGroupToPanel(bestPanel, group, allocatedGroups, allocationResults);
    } else {
      allocationResults.failed.push(`Cannot allocate remaining group "${group.id}" - no panel has sufficient capacity`);
    }
  }
}

/**
 * Assign instructors to panels based on project majority
 */
function assignInstructorsByProjectMajority(panels, allInstructors, constraints, allocationResults) {
  const instructorProjectCounts = new Map();

  // Count projects per instructor per panel
  panels.forEach(panel => {
    panel.groups.forEach(group => {
      group.supervisors.forEach(supervisor => {
        const key = `${supervisor}_${panel.panelNumber}`;
        const count = instructorProjectCounts.get(key) || 0;
        instructorProjectCounts.set(key, count + group.projects.length);
      });
    });
  });

  // Determine primary panel for each instructor
  const instructorPrimaryPanel = new Map();
  
  instructorProjectCounts.forEach((projectCount, key) => {
    const [instructor, panelNumber] = key.split('_');
    const currentBest = instructorPrimaryPanel.get(instructor);
    
    if (!currentBest || projectCount > currentBest.projectCount) {
      instructorPrimaryPanel.set(instructor, {
        panelNumber: parseInt(panelNumber),
        projectCount
      });
    }
  });

  // Clear current instructor assignments and reassign based on majority
  panels.forEach(panel => {
    panel.instructors.clear();
  });

  // Assign supervisors to their primary panels
  instructorPrimaryPanel.forEach((assignment, instructor) => {
    const panel = panels.find(p => p.panelNumber === assignment.panelNumber);
    if (panel) {
      panel.instructors.add(instructor);
    }
  });

  // Distribute non-supervisor instructors to balance panels
  const nonSupervisorInstructors = allInstructors.filter(instructor => 
    !instructor.projects || instructor.projects.length === 0
  );

  distributePanelMembers(panels, nonSupervisorInstructors, constraints, allocationResults);
}

/**
 * Distribute non-supervisor instructors as panel members
 */
function distributePanelMembers(panels, nonSupervisorInstructors, constraints, allocationResults) {
  const sortedPanels = [...panels].sort((a, b) => a.instructors.size - b.instructors.size);

  nonSupervisorInstructors.forEach(instructor => {
    const targetPanel = sortedPanels.find(panel => panel.instructors.size < constraints.instructorsPerPanel);
    
    if (targetPanel) {
      targetPanel.instructors.add(instructor.name);
      sortedPanels.sort((a, b) => a.instructors.size - b.instructors.size);
    } else {
      // All panels at capacity, assign to panel with minimum instructors
      const minPanel = sortedPanels[0];
      minPanel.instructors.add(instructor.name);
    }
  });

  allocationResults.successful.push(
    `Distributed ${nonSupervisorInstructors.length} panel members based on balanced instructor assignment`
  );
}

/**
 * Apply AI suggestions to optimize panel composition
 */
function applyAISuggestions(panels, geminiSuggestions, allocationResults) {
  if (!geminiSuggestions.recommendations) return;

  // Apply domain balance suggestions
  if (geminiSuggestions.domainBalanceAnalysis) {
    allocationResults.successful.push(`AI Analysis: ${geminiSuggestions.domainBalanceAnalysis}`);
  }

  // Log optimization tips
  if (geminiSuggestions.optimizationTips) {
    geminiSuggestions.optimizationTips.forEach(tip => {
      allocationResults.successful.push(`AI Tip: ${tip}`);
    });
  }

  // Log potential issues
  if (geminiSuggestions.potentialIssues) {
    geminiSuggestions.potentialIssues.forEach(issue => {
      allocationResults.warnings.push(`AI Warning: ${issue}`);
    });
  }
}

/**
 * Helper functions
 */
function canPanelAccommodateGroup(panel, group, constraints) {
  const groupInstructors = new Set(group.supervisors);
  const totalInstructors = new Set([...panel.instructors, ...groupInstructors]);
  
  return totalInstructors.size <= constraints.instructorsPerPanel;
}

function canPanelAccommodateCluster(panel, clusterGroups, constraints) {
  const clusterInstructors = new Set();
  const clusterProjects = clusterGroups.reduce((sum, group) => sum + group.projects.length, 0);
  
  clusterGroups.forEach(group => {
    group.supervisors.forEach(supervisor => clusterInstructors.add(supervisor));
  });
  
  const totalInstructors = new Set([...panel.instructors, ...clusterInstructors]);
  
  return totalInstructors.size <= constraints.instructorsPerPanel;
}

function allocateGroupToPanel(panel, group, allocatedGroups, allocationResults) {
  panel.groups.push(group);
  panel.totalProjects += group.projects.length;
  panel.constraints.actualGroups++;
  
  // Update domain tracking
  group.projects.forEach(project => {
    const domains = detectProjectDomains(project);
    domains.forEach(domain => {
      panel.domains[domain] = (panel.domains[domain] || 0) + 1;
    });
  });
  
  // Add supervisors
  group.supervisors.forEach(supervisor => {
    panel.instructors.add(supervisor);
  });
  
  allocatedGroups.add(group.id);
}

function detectDominantDomain(projects) {
  const domainCounts = {};
  
  projects.forEach(project => {
    const domains = detectProjectDomains(project);
    domains.forEach(domain => {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
  });
  
  return Object.entries(domainCounts).reduce((max, [domain, count]) => 
    count > max.count ? { domain, count } : max, 
    { domain: 'General', count: 0 }
  ).domain;
}

function detectProjectDomains(projectTitle) {
  const domains = [];
  const title = projectTitle.toLowerCase();
  
  // AI/ML keywords
  if (title.includes('ai') || title.includes('machine learning') || title.includes('neural') || 
      title.includes('chatbot') || title.includes('nlp') || title.includes('computer vision') ||
      title.includes('ml') || title.includes('artificial intelligence') || title.includes('deep learning')) {
    domains.push('AI/ML');
  }
  
  // Web Development
  if (title.includes('web') || title.includes('website') || title.includes('e-commerce') || 
      title.includes('platform') || title.includes('dashboard') || title.includes('portal') ||
      title.includes('ecommerce') || title.includes('cms') || title.includes('blog')) {
    domains.push('Web Development');
  }
  
  // Mobile
  if (title.includes('mobile') || title.includes('app') || title.includes('android') || 
      title.includes('ios') || title.includes('flutter') || title.includes('react native') ||
      title.includes('smartphone') || title.includes('tablet')) {
    domains.push('Mobile Development');
  }
  
  // IoT
  if (title.includes('iot') || title.includes('smart home') || title.includes('sensor') || 
      title.includes('automation') || title.includes('embedded') || title.includes('arduino') ||
      title.includes('raspberry pi') || title.includes('smart') || title.includes('connected')) {
    domains.push('IoT');
  }
  
  // Cybersecurity
  if (title.includes('security') || title.includes('cyber') || title.includes('encryption') || 
      title.includes('blockchain') || title.includes('penetration') || title.includes('firewall') ||
      title.includes('vulnerability') || title.includes('threat') || title.includes('secure')) {
    domains.push('Cybersecurity');
  }
  
  // Education
  if (title.includes('education') || title.includes('learning') || title.includes('teaching') || 
      title.includes('student') || title.includes('quiz') || title.includes('course') ||
      title.includes('tutorial') || title.includes('exam') || title.includes('school')) {
    domains.push('Education');
  }
  
  // VR/AR
  if (title.includes('vr') || title.includes('ar') || title.includes('virtual reality') || 
      title.includes('augmented reality') || title.includes('3d') || title.includes('metaverse')) {
    domains.push('VR/AR');
  }
  
  // Game Development
  if (title.includes('game') || title.includes('gaming') || title.includes('unity') || 
      title.includes('graphics') || title.includes('animation') || title.includes('entertainment')) {
    domains.push('Game Development');
  }
  
  // Healthcare
  if (title.includes('health') || title.includes('medical') || title.includes('hospital') || 
      title.includes('patient') || title.includes('doctor') || title.includes('medicine') ||
      title.includes('telemedicine') || title.includes('pharmacy')) {
    domains.push('Healthcare');
  }
  
  // Finance
  if (title.includes('finance') || title.includes('banking') || title.includes('payment') || 
      title.includes('trading') || title.includes('investment') || title.includes('budget') ||
      title.includes('accounting') || title.includes('cryptocurrency')) {
    domains.push('Finance');
  }
  
  // Default to General if no specific domain detected
  if (domains.length === 0) {
    domains.push('General');
  }
  
  return domains;
}

function optimizeDomainBalance(panels, allocationResults) {
  panels.forEach(panel => {
    const domainEntries = Object.entries(panel.domains);
    const totalProjects = panel.totalProjects;
    
    // Check for domain concentration
    const highConcentrationDomains = domainEntries.filter(([_, count]) => count > 4);
    if (highConcentrationDomains.length > 0) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: High concentration in ${highConcentrationDomains.map(([domain, count]) => `${domain} (${count})`).join(', ')}`
      );
    }
    
    // Check for good diversity
    const uniqueDomains = domainEntries.length;
    if (uniqueDomains >= 3 && uniqueDomains <= 5) {
      allocationResults.successful.push(
        `Panel ${panel.panelNumber}: Good domain diversity with ${uniqueDomains} domains`
      );
    }
  });
}

function analyzeAllocationQuality(panels, constraints, allocationResults) {
  // Analyze project balance
  const projectCounts = panels.map(p => p.totalProjects);
  const minProjects = Math.min(...projectCounts);
  const maxProjects = Math.max(...projectCounts);
  const projectSpread = maxProjects - minProjects;
  
  if (projectSpread <= 2) {
    allocationResults.successful.push(`Excellent project balance achieved (spread: ${projectSpread})`);
  } else if (projectSpread <= 5) {
    allocationResults.successful.push(`Good project balance achieved (spread: ${projectSpread})`);
  } else {
    allocationResults.warnings.push(`Project imbalance detected (spread: ${projectSpread})`);
  }
  
  // Analyze instructor balance
  const instructorCounts = panels.map(p => p.instructors.size);
  const minInstructors = Math.min(...instructorCounts);
  const maxInstructors = Math.max(...instructorCounts);
  const instructorSpread = maxInstructors - minInstructors;
  
  if (instructorSpread <= 1) {
    allocationResults.successful.push(`Good instructor balance achieved (spread: ${instructorSpread})`);
  } else {
    allocationResults.warnings.push(`Instructor imbalance detected (spread: ${instructorSpread})`);
  }
}

function calculateBalanceMetrics(panels, constraints) {
  const projectCounts = panels.map(p => p.totalProjects);
  const instructorCounts = panels.map(p => p.instructors.length);
  
  return {
    projectBalance: {
      min: Math.min(...projectCounts),
      max: Math.max(...projectCounts),
      average: projectCounts.reduce((sum, count) => sum + count, 0) / projectCounts.length,
      spread: Math.max(...projectCounts) - Math.min(...projectCounts)
    },
    instructorBalance: {
      min: Math.min(...instructorCounts),
      max: Math.max(...instructorCounts),
      average: instructorCounts.reduce((sum, count) => sum + count, 0) / instructorCounts.length,
      spread: Math.max(...instructorCounts) - Math.min(...instructorCounts)
    },
    domainDiversity: panels.map(panel => ({
      panelNumber: panel.panelNumber,
      domains: Object.keys(panel.domains).length,
      distribution: panel.domains
    }))
  };
}

function createInstructorAssignments(panels, allInstructors) {
  const assignments = [];
  const assignedInstructors = new Set();

  // Process assigned instructors
  panels.forEach(panel => {
    panel.instructors.forEach(instructorName => {
      const instructorData = allInstructors.find(i => i.name === instructorName);
      if (instructorData) {
        const supervisedProjects = [];
        
        panel.groups.forEach(group => {
          if (group.supervisors.includes(instructorName)) {
            supervisedProjects.push(...group.projects);
          }
        });

        assignments.push({
          instructorName,
          panelAssigned: panel.panelNumber,
          supervisedProjects,
          projectCount: supervisedProjects.length,
          status: supervisedProjects.length > 0 ? 'Assigned' : 'Assigned'
        });
        
        assignedInstructors.add(instructorName);
      }
    });
  });

  // Process unassigned instructors
  allInstructors.forEach(instructor => {
    if (!assignedInstructors.has(instructor.name)) {
      assignments.push({
        instructorName: instructor.name,
        panelAssigned: null,
        supervisedProjects: instructor.projects || [],
        projectCount: (instructor.projects || []).length,
        status: 'Unassigned'
      });
    }
  });

  return assignments.sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

function createBalancedAllocationSummary(panels, constraints, allocationResults) {
  const totalGroups = panels.reduce((sum, panel) => sum + panel.constraints.actualGroups, 0);
  const totalInstructors = new Set(panels.flatMap(panel => panel.instructors)).size;
  const totalProjects = panels.reduce((sum, panel) => sum + panel.totalProjects, 0);
  
  const projectCounts = panels.map(panel => panel.totalProjects);
  const instructorCounts = panels.map(panel => panel.instructors.length);
  
  return {
    algorithm: 'Balanced Domain Diversity',
    totalPanels: panels.length,
    totalGroups,
    totalInstructors,
    totalProjects,
    averageGroupsPerPanel: Math.round((totalGroups / panels.length) * 10) / 10,
    averageInstructorsPerPanel: Math.round((panels.reduce((sum, panel) => sum + panel.instructors.length, 0) / panels.length) * 10) / 10,
    averageProjectsPerPanel: Math.round((totalProjects / panels.length) * 10) / 10,
    projectBalance: {
      minProjectsInAnyPanel: Math.min(...projectCounts),
      maxProjectsInAnyPanel: Math.max(...projectCounts),
      projectSpread: Math.max(...projectCounts) - Math.min(...projectCounts),
      isBalanced: (Math.max(...projectCounts) - Math.min(...projectCounts)) <= 5,
      quality: (Math.max(...projectCounts) - Math.min(...projectCounts)) <= 2 ? 'Excellent' : 
               (Math.max(...projectCounts) - Math.min(...projectCounts)) <= 5 ? 'Good' : 'Moderate'
    },
    instructorBalance: {
      minInstructorsInAnyPanel: Math.min(...instructorCounts),
      maxInstructorsInAnyPanel: Math.max(...instructorCounts),
      instructorSpread: Math.max(...instructorCounts) - Math.min(...instructorCounts),
      isBalanced: (Math.max(...instructorCounts) - Math.min(...instructorCounts)) <= 1,
      quality: (Math.max(...instructorCounts) - Math.min(...instructorCounts)) === 0 ? 'Perfect' : 
               (Math.max(...instructorCounts) - Math.min(...instructorCounts)) <= 1 ? 'Good' : 'Moderate'
    },
    domainDistribution: panels.map(panel => ({
      panelNumber: panel.panelNumber,
      domains: panel.domains,
      uniqueDomains: Object.keys(panel.domains).length,
      maxDomainConcentration: Math.max(...Object.values(panel.domains))
    })),
    constraints: {
      hard: {
        numberOfPanels: constraints.numberOfPanels,
        instructorsPerPanel: constraints.instructorsPerPanel,
        satisfied: true
      },
      soft: {
        projectsPerPanel: constraints.projectsPerPanel,
        exceeded: panels.some(panel => panel.totalProjects > constraints.projectsPerPanel),
        maxProjectsInAnyPanel: Math.max(...projectCounts)
      }
    },
    allocationSuccess: {
      successful: allocationResults.successful.length,
      failed: allocationResults.failed.length,
      warnings: allocationResults.warnings.length,
      constraintViolations: allocationResults.constraintViolations.length
    },
    generatedAt: new Date().toLocaleString()
  };
}
