import React, { useMemo, useState } from 'react';
import { validateAllocation } from '../utils/allocationValidator';

// Compact constraint & collision audit panel.
// audit: result of validateAllocation → { valid, hardViolations, softWarnings, collisionIssues, score }
export const AllocationAudit = ({ audit }) => {
  if (!audit) return null;

  const scoreClass = audit.score >= 80 ? 'audit-score-good' : audit.score >= 50 ? 'audit-score-warn' : 'audit-score-bad';

  return (
    <div className="allocation-audit">
      <div className="audit-header">
        <span className={`audit-score-badge ${scoreClass}`}>Score: {audit.score}/100</span>
        {audit.valid && (
          <span className="audit-valid-text">✅ All hard constraints satisfied</span>
        )}
      </div>

      {audit.hardViolations.length > 0 && (
        <details className="audit-section audit-hard" open>
          <summary>❌ Hard restriction violations ({audit.hardViolations.length})</summary>
          <ul>
            {audit.hardViolations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </details>
      )}

      {audit.softWarnings.length > 0 && (
        <details className="audit-section audit-soft">
          <summary>⚠️ Soft restriction warnings ({audit.softWarnings.length})</summary>
          <ul>
            {audit.softWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {audit.collisionIssues.length > 0 && (
        <details className="audit-section audit-collision">
          <summary>💥 Collision issues ({audit.collisionIssues.length})</summary>
          <ul>
            {audit.collisionIssues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

// Renders AI-generated schedule variants as tabs, each with a full breakdown
// and a locally computed constraint/collision audit.
// Props:
//   variantsData: { variants: [...], comparison } from generatePanelVariants
//   constraints: { numberOfPanels, instructorsPerPanel, projectsPerPanel }
//   similarityResults: [{ project1Id, project2Id, similarityScore }]
//   projects: [{ projectId, projectTitle, primaryDomain, supervisor }]
const ScheduleVariants = ({ variantsData, constraints, similarityResults = [], projects = [] }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const variants = useMemo(
    () => (variantsData && Array.isArray(variantsData.variants) ? variantsData.variants : []),
    [variantsData]
  );

  const audits = useMemo(
    () =>
      variants.map(variant =>
        validateAllocation(variant.panels || [], constraints, similarityResults || [], projects || [])
      ),
    [variants, constraints, similarityResults, projects]
  );

  if (variants.length === 0) return null;

  const safeIndex = Math.min(activeIndex, variants.length - 1);
  const variant = variants[safeIndex];
  const audit = audits[safeIndex];

  return (
    <div className="schedule-variants">
      <h3>🧬 AI Schedule Variants</h3>

      <div className="variant-tabs">
        {variants.map((v, index) => (
          <button
            key={index}
            type="button"
            className={`variant-tab ${index === safeIndex ? 'active' : ''}`}
            onClick={() => setActiveIndex(index)}
          >
            {v.variantName || `Variant ${index + 1}`}
            {audits[index] && (
              <span
                className={`variant-tab-score ${
                  audits[index].score >= 80
                    ? 'audit-score-good'
                    : audits[index].score >= 50
                    ? 'audit-score-warn'
                    : 'audit-score-bad'
                }`}
              >
                {audits[index].score}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="variant-card">
        <div className="variant-card-header">
          <h4>{variant.variantName || `Variant ${safeIndex + 1}`}</h4>
          {variant.strategy && <p className="variant-strategy">{variant.strategy}</p>}
        </div>

        <AllocationAudit audit={audit} />

        <div className="variant-panels-grid">
          {(variant.panels || []).map(panel => (
            <div key={panel.panelNumber} className="variant-panel-card">
              <h5>Panel {panel.panelNumber}</h5>

              <div className="variant-panel-section">
                <strong>Projects:</strong>{' '}
                {panel.suggestedProjects && panel.suggestedProjects.length > 0
                  ? panel.suggestedProjects.join(', ')
                  : 'None listed'}
              </div>

              {panel.domainDistribution && Object.keys(panel.domainDistribution).length > 0 && (
                <div className="variant-panel-section">
                  <strong>Domains:</strong>{' '}
                  {Object.entries(panel.domainDistribution).map(([domain, count]) => (
                    <span key={domain} className="domain-tag">
                      {domain}: {count}
                    </span>
                  ))}
                </div>
              )}

              {panel.instructorAssignment && panel.instructorAssignment.length > 0 && (
                <div className="variant-panel-section">
                  <strong>Instructors:</strong> {panel.instructorAssignment.join(', ')}
                </div>
              )}

              {panel.reasoning && (
                <div className="variant-panel-section variant-panel-reasoning">
                  <strong>Reasoning:</strong> {panel.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="variant-meta">
          {variant.hardConstraintStatus && (
            <div className="variant-meta-item">
              <strong>Hard constraints:</strong> {variant.hardConstraintStatus}
            </div>
          )}
          {variant.softConstraintTradeoffs && variant.softConstraintTradeoffs.length > 0 && (
            <div className="variant-meta-item">
              <strong>Soft constraint trade-offs:</strong>
              <ul>
                {variant.softConstraintTradeoffs.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {variant.collisionHandling && (
            <div className="variant-meta-item">
              <strong>Collision handling:</strong> {variant.collisionHandling}
            </div>
          )}
        </div>
      </div>

      {variantsData.comparison && (
        <div className="variant-comparison">
          <h4>📊 Variant Comparison</h4>
          <p>{variantsData.comparison}</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleVariants;
