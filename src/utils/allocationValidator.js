// Deterministic checker for panel allocations.
// Validates hard restrictions, soft restrictions and collision separation
// locally (no AI call), so every AI-suggested schedule can be audited.

// panels: [{ panelNumber, suggestedProjects: [projectId], instructorAssignment?: [name] }]
// constraints: { numberOfPanels, instructorsPerPanel, projectsPerPanel }
// similarityResults: [{ project1Id, project2Id, similarityScore }]
// projects: [{ projectId, primaryDomain?, supervisor? }]
export function validateAllocation(panels, constraints, similarityResults = [], projects = []) {
  const hardViolations = [];
  const softWarnings = [];
  const collisionIssues = [];

  const projectById = {};
  projects.forEach(p => { projectById[String(p.projectId)] = p; });

  const panelOfProject = {};
  panels.forEach(panel => {
    (panel.suggestedProjects || []).forEach(id => {
      const key = String(id);
      if (panelOfProject[key] !== undefined) {
        hardViolations.push(`Project ${id} appears in panel ${panelOfProject[key]} AND panel ${panel.panelNumber}`);
      }
      panelOfProject[key] = panel.panelNumber;
    });
  });

  // Hard: panel count
  if (constraints.numberOfPanels && panels.length !== Number(constraints.numberOfPanels)) {
    hardViolations.push(`Expected ${constraints.numberOfPanels} panels, got ${panels.length}`);
  }

  // Hard: every known project assigned
  projects.forEach(p => {
    if (panelOfProject[String(p.projectId)] === undefined) {
      hardViolations.push(`Project ${p.projectId} is not assigned to any panel`);
    }
  });

  panels.forEach(panel => {
    const ids = panel.suggestedProjects || [];

    // Hard: instructor cap
    const instructors = panel.instructorAssignment || [];
    if (constraints.instructorsPerPanel && instructors.length > Number(constraints.instructorsPerPanel)) {
      hardViolations.push(`Panel ${panel.panelNumber}: ${instructors.length} instructors exceeds max ${constraints.instructorsPerPanel}`);
    }

    // Hard: a supervisor evaluating their own project
    const instructorNames = instructors.map(n => String(n).replace(/\s*\(\d+.*\)$/, '').trim().toLowerCase());
    ids.forEach(id => {
      const proj = projectById[String(id)];
      if (proj && proj.supervisor) {
        const sup = String(proj.supervisor).trim().toLowerCase();
        if (instructorNames.some(n => n && (n === sup || sup.includes(n) || n.includes(sup)))) {
          hardViolations.push(`Panel ${panel.panelNumber}: supervisor "${proj.supervisor}" would evaluate own project ${id}`);
        }
      }
    });

    // Soft: size balance
    if (constraints.projectsPerPanel) {
      const target = Number(constraints.projectsPerPanel);
      if (Math.abs(ids.length - target) > 2) {
        softWarnings.push(`Panel ${panel.panelNumber}: ${ids.length} projects (target ${target} ±2)`);
      }
    }

    // Soft: domain concentration
    const domainCount = {};
    ids.forEach(id => {
      const d = projectById[String(id)]?.primaryDomain || 'Unknown';
      domainCount[d] = (domainCount[d] || 0) + 1;
    });
    Object.entries(domainCount).forEach(([domain, count]) => {
      if (domain !== 'Unknown' && count > 4) {
        softWarnings.push(`Panel ${panel.panelNumber}: ${count} projects from "${domain}" (max 4 recommended)`);
      }
    });
  });

  // Collisions: similar projects landing in the same panel
  similarityResults.forEach(pair => {
    if (pair.similarityScore < 0.5) return;
    const p1 = panelOfProject[String(pair.project1Id)];
    const p2 = panelOfProject[String(pair.project2Id)];
    if (p1 !== undefined && p1 === p2) {
      collisionIssues.push(
        `Panel ${p1}: colliding projects ${pair.project1Id} & ${pair.project2Id} (similarity ${(pair.similarityScore * 100).toFixed(0)}%) are together`
      );
    }
  });

  return {
    valid: hardViolations.length === 0,
    hardViolations,
    softWarnings,
    collisionIssues,
    score: computeQualityScore(hardViolations, softWarnings, collisionIssues)
  };
}

// 0-100 quality score: hard violations dominate, then collisions, then soft warnings.
function computeQualityScore(hard, soft, collisions) {
  let score = 100;
  score -= hard.length * 25;
  score -= collisions.length * 10;
  score -= soft.length * 5;
  return Math.max(0, score);
}
