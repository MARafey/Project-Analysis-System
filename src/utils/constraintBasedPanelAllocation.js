/**
 * Constraint-Based Panel Allocation System
 * 
 * This module implements a panel allocation algorithm that strictly follows
 * hard and soft constraints as specified in the requirements.
 */

/**
 * Allocate groups and instructors to panels based on constraints
 * 
 * @param {Object} parsedData - Data from text file parser
 * @param {Object} constraints - Panel allocation constraints
 * @returns {Object} Allocation result
 */
export function allocateGroupsToPanels(parsedData, constraints) {
  const {
    numberOfPanels,
    instructorsPerPanel,
    groupsPerPanel,
    sessionDurationMinutes = 120
  } = constraints;

  // Validate inputs
  if (!parsedData || !parsedData.groups || !parsedData.instructors) {
    throw new Error('Invalid parsed data provided');
  }

  if (numberOfPanels < 1 || instructorsPerPanel < 1 || groupsPerPanel < 1) {
    throw new Error('All constraints must be positive numbers');
  }

  const { groups, instructors } = parsedData;
  
  // Step 1: Create all panels first
  const panels = Array.from({ length: numberOfPanels }, (_, i) => ({
    panelNumber: i + 1,
    groups: [],
    instructors: new Set(),
    totalProjects: 0,
    sessionDuration: sessionDurationMinutes,
    constraints: {
      maxInstructors: instructorsPerPanel,
      desiredGroups: groupsPerPanel,
      actualGroups: 0
    }
  }));

  // Step 2: Identify overlapping groups (groups that share projects or supervisors)
  const overlappingGroupSets = findOverlappingGroups(groups);
  
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
    let totalProjectsInSet = 0;

    // Collect all instructors and count projects for this set
    unallocatedGroups.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.supervisors.forEach(supervisor => setInstructors.add(supervisor));
        totalProjectsInSet += group.projects.length;
      }
    });

    // Find the best panel for this set
    const bestPanel = findBestPanelForGroupSet(panels, unallocatedGroups, setInstructors, constraints);
    
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

      allocationResults.successful.push(
        `Allocated overlapping group set of ${unallocatedGroups.length} groups to Panel ${bestPanel.panelNumber}`
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
    const bestPanel = findBestPanelForGroupSet(panels, [group.id], groupInstructors, constraints);
    
    if (bestPanel) {
      bestPanel.groups.push(group);
      bestPanel.totalProjects += group.projects.length;
      bestPanel.constraints.actualGroups++;
      
      group.supervisors.forEach(supervisor => {
        bestPanel.instructors.add(supervisor);
      });
      
      allocatedGroups.add(group.id);
      
      allocationResults.successful.push(
        `Allocated group "${group.id}" to Panel ${bestPanel.panelNumber}`
      );
    } else {
      allocationResults.failed.push(
        `Cannot allocate group "${group.id}" - no panel has sufficient capacity`
      );
    }
  }

  // Step 5: Optimize instructor assignments
  optimizeInstructorAssignments(panels, groups);

  // Step 6: Generate warnings and constraint analysis
  analyzeConstraints(panels, constraints, allocationResults);

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
 * Find overlapping groups (groups that share projects or supervisors)
 */
function findOverlappingGroups(groups) {
  const overlappingSets = [];
  const processed = new Set();

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

      if (hasProjectOverlap || hasSupervisorOverlap) {
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

          if (hasProjectOverlap || hasSupervisorOverlap) {
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
function findBestPanelForGroupSet(panels, groupIds, instructors, constraints) {
  let bestPanel = null;
  let bestScore = -1;

  for (const panel of panels) {
    // Check hard constraint: instructors per panel
    const totalInstructors = new Set([...panel.instructors, ...instructors]);
    if (totalInstructors.size > constraints.instructorsPerPanel) {
      continue; // Cannot violate hard constraint
    }

    // Calculate score based on current utilization
    const groupsAfterAllocation = panel.constraints.actualGroups + groupIds.length;
    const instructorsAfterAllocation = totalInstructors.size;
    
    // Prefer panels that are closer to their desired capacity but not over
    const groupUtilization = groupsAfterAllocation / constraints.groupsPerPanel;
    const instructorUtilization = instructorsAfterAllocation / constraints.instructorsPerPanel;
    
    // Penalize going over the soft constraint (groups per panel)
    let score = 1 - Math.abs(groupUtilization - 0.8); // Target 80% utilization
    
    if (groupsAfterAllocation > constraints.groupsPerPanel) {
      score -= 0.3; // Penalty for exceeding soft constraint
    }
    
    // Bonus for better instructor utilization
    score += (1 - Math.abs(instructorUtilization - 0.8)) * 0.3;
    
    if (score > bestScore) {
      bestScore = score;
      bestPanel = panel;
    }
  }

  return bestPanel;
}

/**
 * Optimize instructor assignments based on where they supervise more projects
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

  // Update panel instructor assignments
  panels.forEach(panel => {
    const newInstructors = new Set();
    panel.groups.forEach(group => {
      group.supervisors.forEach(supervisor => {
        const primaryPanel = instructorPrimaryPanel.get(supervisor);
        if (primaryPanel && primaryPanel.panelNumber === panel.panelNumber) {
          newInstructors.add(supervisor);
        }
      });
    });
    panel.instructors = newInstructors;
  });
}

/**
 * Analyze constraints and generate warnings
 */
function analyzeConstraints(panels, constraints, allocationResults) {
  panels.forEach(panel => {
    // Check soft constraint violations
    if (panel.constraints.actualGroups > constraints.groupsPerPanel) {
      allocationResults.constraintViolations.push(
        `Panel ${panel.panelNumber}: Exceeded desired groups per panel (${panel.constraints.actualGroups}/${constraints.groupsPerPanel})`
      );
    }

    // Check utilization warnings
    if (panel.constraints.actualGroups < constraints.groupsPerPanel * 0.5) {
      allocationResults.warnings.push(
        `Panel ${panel.panelNumber}: Under-utilized (${panel.constraints.actualGroups}/${constraints.groupsPerPanel} groups)`
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
          status: 'Assigned'
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

  const softConstraintExceeded = panels.some(panel => panel.constraints.actualGroups > constraints.groupsPerPanel);
  const maxGroupsInAnyPanel = Math.max(...panels.map(panel => panel.constraints.actualGroups));

  return {
    totalPanels: panels.length,
    totalGroups,
    totalInstructors,
    averageGroupsPerPanel: Math.round(averageGroupsPerPanel * 10) / 10,
    averageInstructorsPerPanel: Math.round(averageInstructorsPerPanel * 10) / 10,
    constraints: {
      hard: {
        numberOfPanels: constraints.numberOfPanels,
        instructorsPerPanel: constraints.instructorsPerPanel,
        satisfied: true // Hard constraints are always satisfied by design
      },
      soft: {
        groupsPerPanel: constraints.groupsPerPanel,
        exceeded: softConstraintExceeded,
        maxGroupsInAnyPanel,
        reason: softConstraintExceeded ? 'Necessary to accommodate all groups while respecting hard constraints' : null
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
