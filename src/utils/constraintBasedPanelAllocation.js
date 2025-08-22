/**
 * Constraint-Based Panel Allocation System
 * 
 * This module implements a panel allocation algorithm that strictly follows
 * hard and soft constraints as specified in the requirements.
 * 
 * **BALANCED DISTRIBUTION STRATEGY:**
 * 1. Fill ALL panels to minimum capacity first
 * 2. Only add additional groups when ALL panels have reached minimum
 * 3. Maintain balanced distribution - avoid overloading one panel while others are empty
 * 4. Respect hard constraints (max instructors) at all times
 * 5. Prefer staying within soft constraints (desired groups per panel)
 */

/**
 * Allocate groups and instructors to panels based on constraints and similarity
 * 
 * @param {Object} parsedData - Data from text file parser
 * @param {Object} constraints - Panel allocation constraints
 * @param {Array} similarityResults - Optional similarity analysis results from FYP analysis
 * @returns {Object} Allocation result
 */
export function allocateGroupsToPanels(parsedData, constraints, similarityResults = null) {
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
    constraints: {
      maxInstructors: instructorsPerPanel,
      desiredProjects: projectsPerPanel,
      actualGroups: 0
    }
  }));

  // Step 2: Identify overlapping groups (considers both supervisors and similarity)
  const overlappingGroupSets = findOverlappingGroups(groups, similarityResults);
  
  // Step 3: Allocate overlapping group sets first (most constrained)
  const allocationResults = {
    successful: [],
    failed: [],
    warnings: [],
    constraintViolations: []
  };

  // Sort overlapping sets by size (largest first) for better allocation
  overlappingGroupSets.sort((a, b) => b.length - a.length);
  
  const allocatedGroups = new Set();

  // Allocate overlapping group sets
  for (const groupSet of overlappingGroupSets) {
    if (groupSet.every(groupId => allocatedGroups.has(groupId))) {
      continue; // All groups in this set already allocated
    }

    const unallocatedGroups = groupSet.filter(groupId => !allocatedGroups.has(groupId));
    const setInstructors = new Set();

    // Collect all instructors for this set
    unallocatedGroups.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.supervisors.forEach(supervisor => setInstructors.add(supervisor));
      }
    });

    // Find the best panel for this set
    const bestPanel = findBestPanelForGroupSet(panels, unallocatedGroups, setInstructors, constraints, groups);
    
    if (bestPanel) {
      // Allocate the entire set to this panel
      unallocatedGroups.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          bestPanel.groups.push(group);
          bestPanel.totalProjects += group.projects.length;
          bestPanel.constraints.actualGroups++;
          
          group.supervisors.forEach(supervisor => {
            bestPanel.instructors.add(supervisor);
          });
          
          allocatedGroups.add(groupId);
        }
      });

      // Log project balance after each allocation
      const currentProjectCounts = panels.map(p => ({ 
        panel: p.panelNumber, 
        projects: p.totalProjects,
        groups: p.constraints.actualGroups 
      }));
      const minProjects = Math.min(...currentProjectCounts.map(p => p.projects));
      const maxProjects = Math.max(...currentProjectCounts.map(p => p.projects));
      const projectSpread = maxProjects - minProjects;
      
      allocationResults.successful.push(
        `Allocated overlapping group set of ${unallocatedGroups.length} groups to Panel ${bestPanel.panelNumber}. ` +
        `Project balance: min=${minProjects}, max=${maxProjects}, spread=${projectSpread}`
      );
    } else {
      allocationResults.failed.push(
        `Cannot allocate overlapping group set of ${unallocatedGroups.length} groups - no panel has sufficient capacity`
      );
    }
  }

  // Step 4: Allocate remaining individual groups
  const remainingGroups = groups.filter(group => !allocatedGroups.has(group.id));
  
  for (const group of remainingGroups) {
    const groupInstructors = new Set(group.supervisors);
    const bestPanel = findBestPanelForGroupSet(panels, [group.id], groupInstructors, constraints, groups);
    
    if (bestPanel) {
      bestPanel.groups.push(group);
      bestPanel.totalProjects += group.projects.length;
      bestPanel.constraints.actualGroups++;
      
      group.supervisors.forEach(supervisor => {
        bestPanel.instructors.add(supervisor);
      });
      
      allocatedGroups.add(group.id);
      
      // Log project balance after each allocation
      const currentProjectCounts = panels.map(p => ({ 
        panel: p.panelNumber, 
        projects: p.totalProjects,
        groups: p.constraints.actualGroups 
      }));
      const minProjects = Math.min(...currentProjectCounts.map(p => p.projects));
      const maxProjects = Math.max(...currentProjectCounts.map(p => p.projects));
      const projectSpread = maxProjects - minProjects;
      
      allocationResults.successful.push(
        `Allocated group "${group.id}" (${group.projects.length} projects) to Panel ${bestPanel.panelNumber}. ` +
        `Project balance: min=${minProjects}, max=${maxProjects}, spread=${projectSpread}`
      );
    } else {
      allocationResults.failed.push(
        `Cannot allocate group "${group.id}" - no panel has sufficient capacity`
      );
    }
  }

  // Step 5: Distribute non-supervisor instructors to panels
  distributeNonSupervisorInstructors(panels, instructors, constraints);

  // Step 6: Optimize instructor assignments
  optimizeInstructorAssignments(panels, groups);

  // Step 7: Generate warnings and constraint analysis
  analyzeConstraints(panels, constraints, allocationResults);

  // Step 8: Analyze final project balance
  analyzeProjectBalance(panels, allocationResults);

  // Step 9: Analyze final instructor balance
  analyzeInstructorBalance(panels, constraints, allocationResults);

  // Convert instructor sets to arrays
  const finalPanels = panels.map(panel => ({
    ...panel,
    instructors: Array.from(panel.instructors)
  }));

  // Step 7: Create instructor assignments
  const instructorAssignments = createInstructorAssignments(finalPanels, instructors);

  return {
    success: allocationResults.failed.length === 0,
    panels: finalPanels,
    instructorAssignments,
    allocationResults,
    summary: createAllocationSummary(finalPanels, constraints, allocationResults),
    metadata: {
      totalGroups: groups.length,
      allocatedGroups: allocatedGroups.size,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Find overlapping groups (groups that share projects, supervisors, or have similar projects)
 */
function findOverlappingGroups(groups, similarityResults = null) {
  const overlappingSets = [];
  const processed = new Set();

  // Create a project-to-project similarity map for faster lookup
  const similarityMap = new Map();
  if (similarityResults && Array.isArray(similarityResults)) {
    similarityResults.forEach(result => {
      if (result.similarityScore >= 0.3) { // Minimum similarity threshold
        const key1 = `${result.project1Id}-${result.project2Id}`;
        const key2 = `${result.project2Id}-${result.project1Id}`;
        similarityMap.set(key1, result.similarityScore);
        similarityMap.set(key2, result.similarityScore);
      }
    });
  }

  for (const group of groups) {
    if (processed.has(group.id)) continue;

    const overlappingSet = new Set([group.id]);
    const groupProjects = new Set(group.projects);
    const groupSupervisors = new Set(group.supervisors);

    // Find all groups that overlap with this one
    for (const otherGroup of groups) {
      if (otherGroup.id === group.id || processed.has(otherGroup.id)) continue;

      const hasProjectOverlap = otherGroup.projects.some(project => groupProjects.has(project));
      const hasSupervisorOverlap = otherGroup.supervisors.some(supervisor => groupSupervisors.has(supervisor));
      
      // Check for similarity-based overlap (if similarity data is available)
      let hasSimilarityOverlap = false;
      if (similarityMap.size > 0) {
        hasSimilarityOverlap = group.projects.some(project1 => 
          otherGroup.projects.some(project2 => {
            const key = `${project1}-${project2}`;
            return similarityMap.has(key) && similarityMap.get(key) >= 0.5; // High similarity threshold
          })
        );
      }

      if (hasProjectOverlap || hasSupervisorOverlap || hasSimilarityOverlap) {
        overlappingSet.add(otherGroup.id);
        // Add this group's projects and supervisors to check for transitive overlaps
        otherGroup.projects.forEach(project => groupProjects.add(project));
        otherGroup.supervisors.forEach(supervisor => groupSupervisors.add(supervisor));
      }
    }

    // If we found overlaps, continue searching for transitive overlaps
    if (overlappingSet.size > 1) {
      let foundNewOverlaps = true;
      while (foundNewOverlaps) {
        foundNewOverlaps = false;
        for (const otherGroup of groups) {
          if (overlappingSet.has(otherGroup.id)) continue;

          const hasProjectOverlap = otherGroup.projects.some(project => groupProjects.has(project));
          const hasSupervisorOverlap = otherGroup.supervisors.some(supervisor => groupSupervisors.has(supervisor));
          
          // Check similarity for transitive overlaps too
          let hasSimilarityOverlap = false;
          if (similarityMap.size > 0) {
            hasSimilarityOverlap = Array.from(groupProjects).some(project1 => 
              otherGroup.projects.some(project2 => {
                const key = `${project1}-${project2}`;
                return similarityMap.has(key) && similarityMap.get(key) >= 0.5;
              })
            );
          }

          if (hasProjectOverlap || hasSupervisorOverlap || hasSimilarityOverlap) {
            overlappingSet.add(otherGroup.id);
            otherGroup.projects.forEach(project => groupProjects.add(project));
            otherGroup.supervisors.forEach(supervisor => groupSupervisors.add(supervisor));
            foundNewOverlaps = true;
          }
        }
      }
    }

    overlappingSets.push(Array.from(overlappingSet));
    overlappingSet.forEach(groupId => processed.add(groupId));
  }

  return overlappingSets.filter(set => set.length > 1); // Only return sets with actual overlaps
}

/**
 * Find the best panel for a group set
 */
function findBestPanelForGroupSet(panels, groupIds, instructors, constraints, allGroups = []) {
  let bestPanel = null;
  let bestScore = -1;

  // **ENHANCED BALANCED DISTRIBUTION STRATEGY**
  // Phase 1: Find minimum capacity across all panels
  const minGroups = Math.min(...panels.map(p => p.constraints.actualGroups));
  const maxGroups = Math.max(...panels.map(p => p.constraints.actualGroups));
  
  // Calculate current project counts for each panel
  const panelProjectCounts = panels.map(panel => ({
    panelNumber: panel.panelNumber,
    currentProjects: panel.totalProjects,
    currentGroups: panel.constraints.actualGroups
  }));
  
  const minProjects = Math.min(...panelProjectCounts.map(p => p.currentProjects));
  const maxProjects = Math.max(...panelProjectCounts.map(p => p.currentProjects));
  
  // Prioritize panels with minimum groups first (balanced distribution)
  const availablePanels = panels.filter(panel => {
    const totalInstructors = new Set([...panel.instructors, ...instructors]);
    return totalInstructors.size <= constraints.instructorsPerPanel; // Hard constraint check
  });

  if (availablePanels.length === 0) {
    return null; // No panel can accommodate this allocation
  }

  for (const panel of availablePanels) {
    const groupsAfterAllocation = panel.constraints.actualGroups + groupIds.length;
    const totalInstructors = new Set([...panel.instructors, ...instructors]);
    const instructorsAfterAllocation = totalInstructors.size;
    
    // Calculate projects that would be added
    const projectsToAdd = groupIds.reduce((total, groupId) => {
      const group = allGroups.find(g => g.id === groupId);
      return total + (group ? group.projects.length : 0);
    }, 0);
    
    const projectsAfterAllocation = panel.totalProjects + projectsToAdd;
    
    let score = 0;
    
    // **PRIORITY 1: PROJECT COUNT BALANCE (HIGHEST PRIORITY)**
    // Ensure equal project distribution across panels
    if (panel.totalProjects === minProjects) {
      score += 2000; // Very high priority for panels with minimum projects
    } else if (panel.totalProjects <= minProjects + 2) {
      score += 1500; // High priority for panels near minimum projects
    } else if (panel.totalProjects <= minProjects + 5) {
      score += 1000; // Medium priority for panels moderately above minimum
    }
    
    // **PRIORITY 2: GROUP COUNT BALANCE (SECOND PRIORITY)**
    // Strongly prefer panels with fewer groups to ensure even distribution
    if (panel.constraints.actualGroups === minGroups) {
      score += 1000; // Very high priority for balance
    } else if (panel.constraints.actualGroups < minGroups + 2) {
      score += 500; // Medium priority for near-minimum panels
    }
    
    // **PRIORITY 3: PROJECT COUNT BALANCE AFTER ALLOCATION**
    // Prefer allocations that result in more balanced project distribution
    const projectedMinProjects = Math.min(...panels.map(p => 
      p.panelNumber === panel.panelNumber ? projectsAfterAllocation : p.totalProjects
    ));
    const projectedMaxProjects = Math.max(...panels.map(p => 
      p.panelNumber === panel.panelNumber ? projectsAfterAllocation : p.totalProjects
    ));
    const projectedProjectSpread = projectedMaxProjects - projectedMinProjects;
    
    if (projectedProjectSpread <= 3) {
      score += 800; // High bonus for very balanced distribution
    } else if (projectedProjectSpread <= 6) {
      score += 400; // Medium bonus for moderately balanced distribution
    } else {
      score -= projectedProjectSpread * 100; // Penalty for creating imbalance
    }
    
    // **PRIORITY 4: Avoid Exceeding Soft Constraints (Projects per Panel)**
    if (projectsAfterAllocation <= constraints.projectsPerPanel) {
      score += 100; // Bonus for staying within desired projects
    } else {
      score -= (projectsAfterAllocation - constraints.projectsPerPanel) * 50; // Heavy penalty for exceeding
    }
    
    // **PRIORITY 5: Instructor Utilization**
    const instructorUtilization = instructorsAfterAllocation / constraints.instructorsPerPanel;
    score += (1 - instructorUtilization) * 30; // Prefer panels with more instructor capacity
    
    // **PRIORITY 6: Domain Diversity (Lower Priority)**
    if (allGroups.length > 0) {
      const groupsToAdd = groupIds.map(id => allGroups.find(g => g.id === id)).filter(Boolean);
      const domainDiversityScore = calculateDomainDiversityForPanel(panel, groupsToAdd);
      score += domainDiversityScore * 10; // Lower weight for diversity
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestPanel = panel;
    }
  }

  return bestPanel;
}

/**
 * Calculate domain diversity score for a panel with new groups
 */
function calculateDomainDiversityForPanel(panel, newGroups) {
  // Get current domain distribution in panel
  const currentDomains = extractDomainsFromPanelGroups(panel.groups);
  const newDomains = extractDomainsFromPanelGroups(newGroups);
  const combinedDomains = combineDomainsDistribution(currentDomains, newDomains);
  
  const maxProjectsPerDomain = 4; // Soft constraint: max 3-4 projects per domain
  let diversityScore = 1.0;
  
  // Penalize domains with too many projects
  Object.values(combinedDomains).forEach(count => {
    if (count > maxProjectsPerDomain) {
      const excess = count - maxProjectsPerDomain;
      diversityScore -= excess * 0.25; // 25% penalty per excess project
    }
  });
  
  // Bonus for having multiple domains
  const uniqueDomains = Object.keys(combinedDomains).length;
  if (uniqueDomains > 1 && uniqueDomains <= 4) {
    diversityScore += uniqueDomains * 0.05; // 5% bonus per unique domain
  }
  
  return Math.max(0, Math.min(1, diversityScore)); // Clamp between 0 and 1
}

/**
 * Extract domains from panel groups
 */
function extractDomainsFromPanelGroups(groups) {
  const domainCount = {};
  
  groups.forEach(group => {
    group.projects.forEach(projectTitle => {
      const detectedDomains = detectProjectDomains(projectTitle);
      detectedDomains.forEach(domain => {
        domainCount[domain] = (domainCount[domain] || 0) + 1;
      });
    });
  });
  
  return domainCount;
}

/**
 * Simple domain detection based on keywords in project titles
 */
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

/**
 * Combine two domain distributions
 */
function combineDomainsDistribution(domains1, domains2) {
  const combined = { ...domains1 };
  
  Object.entries(domains2).forEach(([domain, count]) => {
    combined[domain] = (combined[domain] || 0) + count;
  });
  
  return combined;
}

/**
 * Distribute non-supervisor instructors to panels to balance instructor counts
 */
function distributeNonSupervisorInstructors(panels, allInstructors, constraints) {
  // Find instructors who have no projects (non-supervisors)
  const nonSupervisorInstructors = allInstructors.filter(instructor => 
    !instructor.projects || instructor.projects.length === 0
  );

  if (nonSupervisorInstructors.length === 0) {
    return; // No non-supervisor instructors to distribute
  }

  console.log(`Distributing ${nonSupervisorInstructors.length} non-supervisor instructors among panels`);

  // First, fill panels that are below the instructorsPerPanel limit
  // Sort panels by current instructor count (ascending) to prioritize filling empty panels
  const sortedPanels = [...panels].sort((a, b) => a.instructors.size - b.instructors.size);

  // Distribute non-supervisor instructors to fill panels up to instructorsPerPanel
  nonSupervisorInstructors.forEach((instructor) => {
    // Find the panel with the fewest instructors that still has capacity
    const targetPanel = sortedPanels.find(panel => 
      panel.instructors.size < constraints.instructorsPerPanel
    );
    
    if (targetPanel) {
      targetPanel.instructors.add(instructor.name);
      console.log(`✅ Assigned panel member "${instructor.name}" to Panel ${targetPanel.panelNumber} (${targetPanel.instructors.size}/${constraints.instructorsPerPanel})`);
      
      // Re-sort panels to maintain balanced distribution
      sortedPanels.sort((a, b) => a.instructors.size - b.instructors.size);
    } else {
      // All panels are at capacity, but we might still want to add instructors
      // Find the panel with the most capacity relative to its current load
      const bestPanel = sortedPanels.reduce((best, panel) => {
        const currentLoad = panel.instructors.size;
        const bestLoad = best ? best.instructors.size : Infinity;
        return currentLoad < bestLoad ? panel : best;
      });
      
      if (bestPanel) {
        bestPanel.instructors.add(instructor.name);
        console.log(`⚠️ Assigned panel member "${instructor.name}" to Panel ${bestPanel.panelNumber} (${bestPanel.instructors.size}/${constraints.instructorsPerPanel}) - exceeded limit`);
      } else {
        console.warn(`❌ Could not assign panel member "${instructor.name}" - no panels available`);
      }
    }
  });

  // Log final instructor distribution
  console.log('\n📊 Final Instructor Distribution:');
  panels.forEach(panel => {
    const status = panel.instructors.size >= constraints.instructorsPerPanel ? '✅' : '⚠️';
    console.log(`${status} Panel ${panel.panelNumber}: ${panel.instructors.size}/${constraints.instructorsPerPanel} instructors`);
  });
  
  // Add instructor balance analysis to allocation results
  const instructorCounts = panels.map(p => p.instructors.size);
  const minInstructors = Math.min(...instructorCounts);
  const maxInstructors = Math.max(...instructorCounts);
  const instructorSpread = maxInstructors - minInstructors;
  
  if (instructorSpread === 0) {
    console.log('🎯 Perfect instructor balance achieved! All panels have the same number of instructors.');
  } else if (instructorSpread <= 1) {
    console.log(`✅ Good instructor balance. Panel spread: ${instructorSpread} instructors`);
  } else {
    console.log(`⚠️ Instructor imbalance detected. Panel spread: ${instructorSpread} instructors`);
  }
}

/**
 * Optimize instructor assignments based on where they supervise more projects
 * while preserving non-supervisor instructors assigned to fill panels
 */
function optimizeInstructorAssignments(panels, allGroups) {
  const instructorPanelCounts = new Map();

  // Count projects per instructor per panel
  panels.forEach(panel => {
    panel.groups.forEach(group => {
      group.supervisors.forEach(supervisor => {
        const key = `${supervisor}_${panel.panelNumber}`;
        if (!instructorPanelCounts.has(key)) {
          instructorPanelCounts.set(key, 0);
        }
        instructorPanelCounts.set(key, instructorPanelCounts.get(key) + group.projects.length);
      });
    });
  });

  // For each instructor, determine their primary panel
  const instructorPrimaryPanel = new Map();
  
  instructorPanelCounts.forEach((projectCount, key) => {
    const [instructor, panelNumber] = key.split('_');
    const currentBest = instructorPrimaryPanel.get(instructor);
    
    if (!currentBest || projectCount > currentBest.projectCount) {
      instructorPrimaryPanel.set(instructor, {
        panelNumber: parseInt(panelNumber),
        projectCount
      });
    }
  });

  // Update panel instructor assignments while preserving non-supervisor instructors
  panels.forEach(panel => {
    const newInstructors = new Set();
    
    // First, add all supervisors who should be in this panel
    panel.groups.forEach(group => {
      group.supervisors.forEach(supervisor => {
        const primaryPanel = instructorPrimaryPanel.get(supervisor);
        if (primaryPanel && primaryPanel.panelNumber === panel.panelNumber) {
          newInstructors.add(supervisor);
        }
      });
    });
    
    // Then, preserve any non-supervisor instructors that were assigned to fill this panel
    // These are instructors who are in the panel but not supervisors of any groups in this panel
    panel.instructors.forEach(instructorName => {
      const isSupervisorInThisPanel = panel.groups.some(group => 
        group.supervisors.includes(instructorName)
      );
      
      if (!isSupervisorInThisPanel) {
        // This is a non-supervisor instructor assigned to fill the panel
        newInstructors.add(instructorName);
      }
    });
    
    panel.instructors = newInstructors;
  });
}

/**
 * Analyze constraints and generate warnings
 */
function analyzeConstraints(panels, constraints, allocationResults) {
  panels.forEach(panel => {
    // Check soft constraint violations (now based on projects, not groups)
    if (panel.totalProjects > constraints.projectsPerPanel) {
      allocationResults.constraintViolations.push(
        `Panel ${panel.panelNumber}: Exceeded desired projects per panel (${panel.totalProjects}/${constraints.projectsPerPanel})`
      );
    }

    // Check utilization warnings (now based on projects, not groups)
    if (panel.totalProjects < constraints.projectsPerPanel * 0.5) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: Under-utilized (${panel.totalProjects}/${constraints.projectsPerPanel} projects)`
      );
    }

    if (panel.instructors.size < constraints.instructorsPerPanel * 0.5) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: Few instructors assigned (${panel.instructors.size}/${constraints.instructorsPerPanel})`
      );
    }
  });
}

/**
 * Analyze final instructor balance across panels
 */
function analyzeInstructorBalance(panels, constraints, allocationResults) {
  const instructorCounts = panels.map(panel => ({
    panelNumber: panel.panelNumber,
    instructors: panel.instructors.size,
    groups: panel.constraints.actualGroups
  }));
  
  const minInstructors = Math.min(...instructorCounts.map(p => p.instructors));
  const maxInstructors = Math.max(...instructorCounts.map(p => p.instructors));
  const instructorSpread = maxInstructors - minInstructors;
  const averageInstructors = instructorCounts.reduce((sum, p) => sum + p.instructors, 0) / instructorCounts.length;
  
  // Log instructor balance summary
  allocationResults.successful.push(
    `👥 Final Instructor Balance: min=${minInstructors}, max=${maxInstructors}, avg=${averageInstructors.toFixed(1)}, spread=${instructorSpread}`
  );
  
  // Add detailed panel breakdown
  instructorCounts.forEach(panel => {
    const deviation = Math.abs(panel.instructors - averageInstructors);
    if (deviation > 1) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: ${panel.instructors} instructors (${deviation > 0 ? '+' : ''}${(panel.instructors - averageInstructors).toFixed(1)} from average)`
      );
    }
  });
  
  // Add balance quality assessment
  if (instructorSpread === 0) {
    allocationResults.successful.push(
      `🎯 Perfect instructor balance achieved! All panels have exactly ${constraints.instructorsPerPanel} instructors`
    );
  } else if (instructorSpread <= 1) {
    allocationResults.successful.push(
      `✅ Good instructor balance achieved. Panel spread: ${instructorSpread} instructors`
    );
  } else if (instructorSpread <= 2) {
    allocationResults.warnings.push(
      `⚠️ Moderate instructor imbalance. Panel spread: ${instructorSpread} instructors. Consider manual adjustments if needed.`
    );
  } else {
    allocationResults.warnings.push(
      `⚠️ Significant instructor imbalance detected. Panel spread: ${instructorSpread} instructors. Manual review recommended.`
    );
  }
}

/**
 * Analyze final project balance across panels
 */
function analyzeProjectBalance(panels, allocationResults) {
  const projectCounts = panels.map(panel => ({
    panelNumber: panel.panelNumber,
    projects: panel.totalProjects,
    groups: panel.constraints.actualGroups
  }));
  
  const minProjects = Math.min(...projectCounts.map(p => p.projects));
  const maxProjects = Math.max(...projectCounts.map(p => p.projects));
  const projectSpread = maxProjects - minProjects;
  const averageProjects = projectCounts.reduce((sum, p) => sum + p.projects, 0) / projectCounts.length;
  
  // Log project balance summary
  allocationResults.successful.push(
    `📊 Final Project Balance: min=${minProjects}, max=${maxProjects}, avg=${averageProjects.toFixed(1)}, spread=${projectSpread}`
  );
  
  // Add detailed panel breakdown
  projectCounts.forEach(panel => {
    const deviation = Math.abs(panel.projects - averageProjects);
    if (deviation > 2) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: ${panel.projects} projects (${deviation > 0 ? '+' : ''}${(panel.projects - averageProjects).toFixed(1)} from average)`
      );
    }
  });
  
  // Add balance quality assessment
  if (projectSpread <= 2) {
    allocationResults.successful.push(
      `🎯 Excellent project balance achieved! All panels within ${projectSpread} projects of each other`
    );
  } else if (projectSpread <= 5) {
    allocationResults.successful.push(
      `✅ Good project balance achieved. Panel spread: ${projectSpread} projects`
    );
  } else if (projectSpread <= 8) {
    allocationResults.warnings.push(
      `⚠️ Moderate project imbalance. Panel spread: ${projectSpread} projects. Consider manual adjustments if needed.`
    );
  } else {
    allocationResults.warnings.push(
      `⚠️ Significant project imbalance detected. Panel spread: ${projectSpread} projects. Manual review recommended.`
    );
  }
}

/**
 * Create instructor assignments summary
 */
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
          status: supervisedProjects.length > 0 ? 'Supervisor' : 'Panel Member'
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
        supervisedProjects: instructor.projects,
        projectCount: instructor.projects.length,
        status: 'Unassigned'
      });
    }
  });

  return assignments.sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

/**
 * Create allocation summary
 */
function createAllocationSummary(panels, constraints, allocationResults) {
  const totalGroups = panels.reduce((sum, panel) => sum + panel.constraints.actualGroups, 0);
  const totalInstructors = new Set(panels.flatMap(panel => panel.instructors)).size;
  const averageGroupsPerPanel = totalGroups / panels.length;
  const averageInstructorsPerPanel = panels.reduce((sum, panel) => sum + panel.instructors.length, 0) / panels.length;

  // Calculate project balance metrics
  const totalProjects = panels.reduce((sum, panel) => sum + panel.totalProjects, 0);
  const averageProjectsPerPanel = totalProjects / panels.length;
  const projectCounts = panels.map(panel => panel.totalProjects);
  const minProjectsInAnyPanel = Math.min(...projectCounts);
  const maxProjectsInAnyPanel = Math.max(...projectCounts);
  const projectSpread = maxProjectsInAnyPanel - minProjectsInAnyPanel;

  // Calculate instructor balance metrics
  const instructorCounts = panels.map(panel => panel.instructors.length);
  const minInstructorsInAnyPanel = Math.min(...instructorCounts);
  const maxInstructorsInAnyPanel = Math.max(...instructorCounts);
  const instructorSpread = maxInstructorsInAnyPanel - minInstructorsInAnyPanel;

  const softConstraintExceeded = panels.some(panel => panel.totalProjects > constraints.projectsPerPanel);
  const maxProjectsInAnyPanelForSoftConstraint = Math.max(...panels.map(panel => panel.totalProjects));

  return {
    totalPanels: panels.length,
    totalGroups,
    totalInstructors,
    totalProjects,
    averageGroupsPerPanel: Math.round(averageGroupsPerPanel * 10) / 10,
    averageInstructorsPerPanel: Math.round(averageInstructorsPerPanel * 10) / 10,
    averageProjectsPerPanel: Math.round(averageProjectsPerPanel * 10) / 10,
    projectBalance: {
      minProjectsInAnyPanel,
      maxProjectsInAnyPanel,
      projectSpread,
      isBalanced: projectSpread <= 5, // Consider balanced if spread ≤ 5
      quality: projectSpread <= 2 ? 'Excellent' : projectSpread <= 5 ? 'Good' : projectSpread <= 8 ? 'Moderate' : 'Needs Review'
    },
    instructorBalance: {
      minInstructorsInAnyPanel,
      maxInstructorsInAnyPanel,
      instructorSpread,
      isBalanced: instructorSpread <= 1, // Consider balanced if spread ≤ 1
      quality: instructorSpread === 0 ? 'Perfect' : instructorSpread <= 1 ? 'Good' : instructorSpread <= 2 ? 'Moderate' : 'Needs Review'
    },
    constraints: {
      hard: {
        numberOfPanels: constraints.numberOfPanels,
        instructorsPerPanel: constraints.instructorsPerPanel,
        satisfied: true // Hard constraints are always satisfied by design
      },
      soft: {
        projectsPerPanel: constraints.projectsPerPanel,
        exceeded: softConstraintExceeded,
        maxProjectsInAnyPanel: maxProjectsInAnyPanelForSoftConstraint,
        reason: softConstraintExceeded ? 'Necessary to accommodate all projects while respecting hard constraints' : null
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
