import {
  generateJSON,
  isAIAvailable,
  getActiveProviderName,
  testConnection
} from './modelApi';
import {
  DOMAIN_KEYWORDS,
  TFIDFVectorizer,
  cosineSimilarity,
  getSimilarityLevel
} from './textProcessing';

// AI analysis layer. All calls route through modelApi (the deployed model
// endpoint). Function names keep the legacy "Gemini" naming so existing
// components continue to work unchanged.

const CLASSIFY_BATCH_SIZE = 8;
const SIMILARITY_BATCH_SIZE = 6;
const MAX_CANDIDATE_PAIRS = 60;
const LOCAL_PREFILTER_THRESHOLD = 0.15;

// ---- Provider management (legacy API) ----

// Legacy name — true when the deployed model endpoint is configured.
export function isGeminiAvailable() {
  return isAIAvailable();
}

export async function testGeminiConnection() {
  return testConnection();
}

// ---- Classification ----

// Classify a single project (kept for compatibility; batch path is preferred).
export async function categorizeWithGemini(projectTitle, projectScope) {
  const results = await classifyBatch([{ projectId: '_single', projectTitle, projectScope }]);
  const entry = results['_single'];
  if (!entry) return { success: false, error: 'No classification returned' };
  return { success: true, data: entry };
}

function classificationPrompt(projects) {
  const domainsStr = Object.keys(DOMAIN_KEYWORDS).join(', ');
  const items = projects.map(p =>
    `ID: ${p.projectId}\nTitle: ${p.projectTitle}\nScope: ${(p.projectScope || '').slice(0, 600)}`
  ).join('\n---\n');

  return `You classify Final Year Projects into technical domains. Be precise and concise.

Allowed domains: ${domainsStr}
If none fit, use the closest real technical domain name.

Projects:
${items}

For EACH project return: its domains (1-3, most relevant first) with a 1-10 confidence and a one-sentence reason, plus a one-sentence summary and 2-4 key points.

Respond with ONLY this JSON (no markdown, no commentary):
{
  "projects": [
    {
      "id": "<project id>",
      "domains": [{"name": "Domain", "confidence": 8, "reasoning": "one sentence"}],
      "primary_domain": "Domain",
      "summary": "one sentence",
      "keyPoints": ["point 1", "point 2"]
    }
  ]
}`;
}

async function classifyBatch(projects) {
  const parsed = await generateJSON(classificationPrompt(projects), { retries: 1 });
  const list = parsed.projects || (Array.isArray(parsed) ? parsed : null);
  if (!list) throw new Error('Invalid classification response structure');

  const byId = {};
  list.forEach(item => {
    if (!item || !item.id || !Array.isArray(item.domains) || item.domains.length === 0) return;
    byId[item.id] = {
      domains: item.domains,
      primary_domain: item.primary_domain || item.domains[0].name,
      summary: item.summary || '',
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints.join('; ') : (item.keyPoints || ''),
      'list of domains': item.domains.map(d => d.name)
    };
  });
  return byId;
}

// Batch categorize: sends projects in chunks of CLASSIFY_BATCH_SIZE per request
// instead of one request per project.
export async function batchCategorizeWithGemini(projects, onProgress) {
  const results = [];
  const total = projects.length;

  for (let start = 0; start < projects.length; start += CLASSIFY_BATCH_SIZE) {
    const chunk = projects.slice(start, start + CLASSIFY_BATCH_SIZE);
    let byId = {};
    let chunkError = null;

    try {
      byId = await classifyBatch(chunk);
    } catch (error) {
      console.error('Batch classification failed:', error);
      chunkError = error.message;
    }

    const chunkStart = start;
    chunk.forEach((project, idx) => {
      const data = byId[project.projectId] || byId[String(project.projectId)];
      results.push({
        projectId: project.projectId,
        result: data
          ? { success: true, data }
          : { success: false, error: chunkError || 'Project missing from model response' }
      });
      if (onProgress) onProgress(chunkStart + idx + 1, total, project.projectId);
    });
  }

  return results;
}

// ---- Similarity / collision detection ----

export async function analyzeProjectSimilarityWithGemini(project1, project2) {
  try {
    const parsed = await analyzeSimilarityPairs([[project1, project2]]);
    const item = parsed[0];
    if (!item) return { success: false, error: 'No similarity result returned' };
    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function similarityPrompt(pairs) {
  const items = pairs.map((pair, idx) => {
    const [a, b] = pair;
    return `PAIR ${idx}:
A (${a.projectId}): ${a.projectTitle} — ${(a.keyPoints || a.projectScope || '').slice(0, 300)}
B (${b.projectId}): ${b.projectTitle} — ${(b.keyPoints || b.projectScope || '').slice(0, 300)}`;
  }).join('\n\n');

  return `You detect overlap/collision between Final Year Projects. For each pair, judge how similar the two projects are in problem domain, technical approach, and deliverable. Be strict: high scores only for genuine overlap.

${items}

Respond with ONLY this JSON array (one entry per pair, same order):
[
  {
    "pairIndex": 0,
    "similarityScore": 0.0,
    "overlappingAreas": ["area"],
    "keyDifferences": ["difference"],
    "analysis": "one or two sentences on the core overlap",
    "recommendation": "one sentence: same panel or not, and why"
  }
]`;
}

async function analyzeSimilarityPairs(pairs) {
  const parsed = await generateJSON(similarityPrompt(pairs), { retries: 1 });
  const list = Array.isArray(parsed) ? parsed : parsed.pairs;
  if (!Array.isArray(list)) throw new Error('Invalid similarity response structure');

  return pairs.map((pair, idx) => {
    const item = list.find(r => r && r.pairIndex === idx) || list[idx];
    if (!item || typeof item.similarityScore !== 'number') return null;
    return {
      similarityScore: Math.max(0, Math.min(1, item.similarityScore)),
      similarityLevel: getSimilarityLevel(Math.max(0, Math.min(1, item.similarityScore))),
      overlappingAreas: item.overlappingAreas || [],
      keyDifferences: item.keyDifferences || [],
      detailedAnalysis: item.analysis || '',
      recommendation: item.recommendation || ''
    };
  });
}

// Local TF-IDF pre-filter: only plausible collisions are sent to the AI,
// instead of every possible pair (O(n²) API calls in the old version).
function selectCandidatePairs(projects) {
  const texts = projects.map(p => `${p.projectTitle} ${p.projectScope || ''}`);
  const vectorizer = new TFIDFVectorizer({ maxFeatures: 1000, minDf: 1, maxDf: 0.95 });
  const vectors = vectorizer.fitTransform(texts);

  const candidates = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const localScore = cosineSimilarity(vectors[i], vectors[j]);
      const sharedDomain =
        Array.isArray(projects[i].domains) && Array.isArray(projects[j].domains) &&
        projects[i].domains.some(d => projects[j].domains.includes(d));
      if (localScore >= LOCAL_PREFILTER_THRESHOLD || (sharedDomain && localScore >= 0.08)) {
        candidates.push({ i, j, localScore });
      }
    }
  }
  candidates.sort((a, b) => b.localScore - a.localScore);
  return candidates.slice(0, MAX_CANDIDATE_PAIRS);
}

// Batch similarity: pre-filter locally, then analyze candidates in batches.
export async function batchAnalyzeSimilarityWithGemini(projects, onProgress) {
  const threshold = 0.3;
  const candidates = selectCandidatePairs(projects);
  const results = [];
  const total = candidates.length;
  let done = 0;

  for (let start = 0; start < candidates.length; start += SIMILARITY_BATCH_SIZE) {
    const chunk = candidates.slice(start, start + SIMILARITY_BATCH_SIZE);
    const pairObjects = chunk.map(c => [projects[c.i], projects[c.j]]);

    try {
      const analyses = await analyzeSimilarityPairs(pairObjects);

      analyses.forEach((analysis, idx) => {
        const { i, j } = chunk[idx];
        if (analysis && analysis.similarityScore > threshold) {
          results.push({
            project1Id: projects[i].projectId,
            project2Id: projects[j].projectId,
            similarityScore: analysis.similarityScore,
            similarityLevel: analysis.similarityLevel,
            overlappingDomains: analysis.overlappingAreas,
            explanation: analysis.detailedAnalysis,
            keyDifferences: analysis.keyDifferences,
            recommendation: analysis.recommendation,
            analysisMethod: 'gemini_ai'
          });
        }
      });
    } catch (error) {
      console.error('Similarity batch failed:', error);
    }

    done += chunk.length;
    if (onProgress) {
      const label = chunk.map(c => `${projects[c.i].projectId} vs ${projects[c.j].projectId}`).join(', ');
      onProgress(Math.min(done, total), total, label);
    }
  }

  // Second-opinion pass: high collisions get re-judged from a skeptical angle
  // and the two scores are averaged, reducing false positives.
  const verified = await verifyHighCollisions(results);
  return verified.sort((a, b) => b.similarityScore - a.similarityScore);
}

async function verifyHighCollisions(results) {
  const suspects = results.filter(r => r.similarityScore >= 0.55);
  if (suspects.length === 0) return results;

  const items = suspects.map((r, idx) =>
    `PAIR ${idx}: ${r.project1Id} vs ${r.project2Id} — claimed overlap: ${r.explanation || r.overlappingDomains.join(', ')}`
  ).join('\n');

  const prompt = `You are a skeptical second reviewer. For each claimed project collision below, argue whether the two projects are ACTUALLY overlapping or merely superficially similar, and give your own similarity score (0.0-1.0).

${items}

Respond with ONLY this JSON array (same order):
[{"pairIndex": 0, "verifiedScore": 0.0, "verdict": "confirmed|weakened", "note": "one sentence"}]`;

  try {
    const parsed = await generateJSON(prompt, { retries: 1 });
    const list = Array.isArray(parsed) ? parsed : parsed.pairs;
    if (!Array.isArray(list)) return results;

    suspects.forEach((r, idx) => {
      const v = list.find(x => x && x.pairIndex === idx) || list[idx];
      if (v && typeof v.verifiedScore === 'number') {
        r.similarityScore = Math.max(0, Math.min(1, (r.similarityScore + v.verifiedScore) / 2));
        r.similarityLevel = getSimilarityLevel(r.similarityScore);
        r.verification = { verdict: v.verdict || 'confirmed', note: v.note || '' };
      }
    });
  } catch (error) {
    console.error('Collision verification pass failed (keeping first-pass scores):', error);
  }
  return results;
}

// ---- Panel allocation suggestions ----

export async function generatePanelAllocationSuggestions(projects, constraints, existingSimilarity = [], options = {}) {
  const projectsSummary = projects.slice(0, 30).map(p => ({
    id: p.projectId,
    title: p.projectTitle,
    domain: p.primaryDomain || 'Unknown'
  }));

  const prompt = `You allocate Final Year Projects to evaluation panels.

PROJECTS:
${JSON.stringify(projectsSummary)}

CONSTRAINTS:
- Panels: ${constraints.numberOfPanels}
- Max instructors per panel: ${constraints.instructorsPerPanel}
- Target projects per panel: ${constraints.projectsPerPanel}
- Max 3-4 projects from the same domain per panel; keep domains diverse.
- ${existingSimilarity.length} similar project pairs exist; spread similar projects across panels.
${options.specialInstructions ? `\nSPECIAL CONDITIONS FROM THE USER (high priority):\n${options.specialInstructions}` : ''}

Respond with ONLY this JSON:
{
  "recommendations": [
    {"panelNumber": 1, "suggestedProjects": ["ID"], "domainDistribution": {"Domain": 1}, "reasoning": "one sentence"}
  ],
  "domainBalanceAnalysis": "one or two sentences",
  "potentialIssues": ["issue"],
  "optimizationTips": ["tip"]
}`;

  try {
    const data = await generateJSON(prompt, { retries: 1 });
    return { success: true, data };
  } catch (error) {
    console.error('Panel allocation suggestion error:', error);
    return { success: false, error: error.message };
  }
}

export async function generateBalancedPanelAllocationSuggestions(projects, constraints, existingSimilarity = [], options = {}) {
  const projectsSummary = projects.slice(0, 30).map(p => ({
    id: p.projectId,
    title: p.projectTitle,
    domain: p.primaryDomain || 'Unknown',
    supervisor: p.supervisor || 'Unknown'
  }));

  const highPairs = existingSimilarity
    .filter(r => r.similarityScore >= 0.6)
    .slice(0, 10)
    .map(r => `${r.project1Id} & ${r.project2Id} (${r.similarityScore.toFixed(2)})`);

  const prompt = `You create BALANCED evaluation panels with domain diversity.

Rules:
1. Distribute highly similar projects across DIFFERENT panels (never cluster them).
2. Each panel: 2-5 distinct domains, max 4 projects per domain.
3. Assign each instructor to the panel holding the majority of their projects.
4. Keep project counts even across panels (±2).

PROJECTS:
${JSON.stringify(projectsSummary)}

HIGH-SIMILARITY PAIRS (must be split across panels):
${highPairs.length ? highPairs.join('\n') : 'None'}

CONSTRAINTS:
- Panels: ${constraints.numberOfPanels}
- Max instructors per panel: ${constraints.instructorsPerPanel}
- Target projects per panel: ${constraints.projectsPerPanel}
${options.specialInstructions ? `\nSPECIAL CONDITIONS FROM THE USER (high priority):\n${options.specialInstructions}` : ''}

Respond with ONLY this JSON:
{
  "balancedRecommendations": [
    {
      "panelNumber": 1,
      "suggestedProjects": ["ID"],
      "domainDistribution": {"Domain": 1},
      "similarityDistribution": "one sentence",
      "instructorAssignment": ["Name (n projects)"],
      "balanceReasoning": "one sentence"
    }
  ],
  "distributionStrategy": "one or two sentences",
  "domainBalanceAnalysis": "one or two sentences",
  "instructorOptimization": "one or two sentences",
  "balanceMetrics": {"projectSpread": "…", "domainDiversity": "…", "similarityBalance": "…"},
  "potentialIssues": ["issue"],
  "optimizationTips": ["tip"]
}`;

  try {
    const data = await generateJSON(prompt, { retries: 1 });
    return { success: true, data };
  } catch (error) {
    console.error('Balanced panel allocation error:', error);
    return { success: false, error: error.message };
  }
}

// Generate MULTIPLE allocation variants in one call, honoring the user's
// special conditions. Each variant uses a different strategy so the user can
// compare possible schedules side by side.
export async function generatePanelVariants(projects, constraints, existingSimilarity = [], options = {}) {
  const { specialInstructions = '', variantCount = 3 } = options;

  const projectsSummary = projects.slice(0, 40).map(p => ({
    id: p.projectId,
    title: p.projectTitle,
    domain: p.primaryDomain || 'Unknown',
    supervisor: p.supervisor || 'Unknown'
  }));

  const highPairs = existingSimilarity
    .filter(r => r.similarityScore >= 0.5)
    .slice(0, 15)
    .map(r => `${r.project1Id} & ${r.project2Id} (${r.similarityScore.toFixed(2)})`);

  const prompt = `You create evaluation-panel schedules for Final Year Projects. Produce ${variantCount} DISTINCT allocation variants using different strategies (e.g. domain-diversity-first, supervisor-majority-first, collision-splitting-first).

HARD CONSTRAINTS (must never be violated):
- Exactly ${constraints.numberOfPanels} panels
- Max ${constraints.instructorsPerPanel} instructors per panel
- A supervisor must never evaluate their own project's panel unless unavoidable
- Every project appears in exactly one panel

SOFT CONSTRAINTS (satisfy as much as possible):
- ~${constraints.projectsPerPanel} projects per panel (±2)
- Max 4 projects from the same domain per panel
- Highly similar (colliding) projects go to DIFFERENT panels

${specialInstructions ? `SPECIAL CONDITIONS FROM THE USER (treat as high priority):\n${specialInstructions}\n` : ''}
PROJECTS:
${JSON.stringify(projectsSummary)}

COLLIDING PAIRS (split across panels):
${highPairs.length ? highPairs.join('\n') : 'None detected'}

Respond with ONLY this JSON:
{
  "variants": [
    {
      "variantName": "short name",
      "strategy": "one sentence",
      "panels": [
        {
          "panelNumber": 1,
          "suggestedProjects": ["ID"],
          "domainDistribution": {"Domain": 1},
          "instructorAssignment": ["Name"],
          "reasoning": "one sentence"
        }
      ],
      "hardConstraintStatus": "one sentence on hard-constraint compliance",
      "softConstraintTradeoffs": ["tradeoff"],
      "collisionHandling": "one sentence on how colliding projects were separated"
    }
  ],
  "comparison": "two sentences comparing the variants and which to prefer"
}`;

  try {
    const data = await generateJSON(prompt, { retries: 1 });
    if (!data.variants || !Array.isArray(data.variants)) {
      throw new Error('Model did not return variants');
    }
    return { success: true, data };
  } catch (error) {
    console.error('Panel variant generation error:', error);
    return { success: false, error: error.message };
  }
}

export function getGeminiUsageStats() {
  return {
    provider: getActiveProviderName(),
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: null
  };
}
