import { removeStopwords, eng } from 'stopword';

// Simple tokenizer implementation
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Convert to lowercase, remove punctuation, and split by whitespace
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

// Generate n-grams
function generateNGrams(tokens, n) {
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n));
  }
  return ngrams;
}

// Generate bigrams
function generateBigrams(tokens) {
  return generateNGrams(tokens, 2).map(bigram => bigram.join('_'));
}

// TF-IDF Vectorizer implementation
export class TFIDFVectorizer {
  constructor(options = {}) {
    this.maxFeatures = options.maxFeatures || 1000;
    this.minDf = options.minDf || 1;
    this.maxDf = options.maxDf || 0.95;
    this.vocabulary = new Map();
    this.idf = new Map();
    this.documents = [];
  }

  // Preprocess text
  preprocess(text) {
    if (!text || typeof text !== 'string') return [];
    
    // Tokenize
    const tokens = tokenize(text);
    
    // Remove stopwords and filter valid words
    const filteredTokens = removeStopwords(tokens, eng)
      .filter(token => token.length > 2 && /^[a-z]+$/.test(token));
    
    // Add bigrams
    const bigrams = generateBigrams(filteredTokens);
    
    return [...filteredTokens, ...bigrams];
  }

  // Build vocabulary from documents
  fit(documents) {
    this.documents = documents.map(doc => this.preprocess(doc));
    const docCount = this.documents.length;
    const termDocCount = new Map();
    const termTotalCount = new Map();

    // Count term frequencies across documents
    this.documents.forEach(doc => {
      const uniqueTerms = new Set(doc);
      doc.forEach(term => {
        termTotalCount.set(term, (termTotalCount.get(term) || 0) + 1);
      });
      uniqueTerms.forEach(term => {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      });
    });

    // Filter terms by document frequency
    const validTerms = Array.from(termDocCount.entries())
      .filter(([term, count]) => {
        const df = count / docCount;
        return count >= this.minDf && df <= this.maxDf;
      })
      .sort((a, b) => termTotalCount.get(b[0]) - termTotalCount.get(a[0]))
      .slice(0, this.maxFeatures)
      .map(([term]) => term);

    // Build vocabulary and IDF
    validTerms.forEach((term, index) => {
      this.vocabulary.set(term, index);
      const df = termDocCount.get(term);
      this.idf.set(term, Math.log(docCount / df));
    });
  }

  // Transform documents to TF-IDF vectors
  transform(documents) {
    const processedDocs = documents.map(doc => this.preprocess(doc));
    const vectors = [];

    processedDocs.forEach(doc => {
      const vector = new Array(this.vocabulary.size).fill(0);
      const termFreq = new Map();

      // Calculate term frequencies
      doc.forEach(term => {
        if (this.vocabulary.has(term)) {
          termFreq.set(term, (termFreq.get(term) || 0) + 1);
        }
      });

      // Calculate TF-IDF
      termFreq.forEach((tf, term) => {
        const index = this.vocabulary.get(term);
        const idf = this.idf.get(term);
        vector[index] = tf * idf;
      });

      // Normalize vector
      const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
          vector[i] /= norm;
        }
      }

      vectors.push(vector);
    });

    return vectors;
  }

  // Fit and transform in one step
  fitTransform(documents) {
    this.fit(documents);
    return this.transform(documents);
  }
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

// Domain keywords for categorization
export const DOMAIN_KEYWORDS = {
  'Artificial Intelligence & Machine Learning': [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
    'neural network', 'nlp', 'natural language processing', 'computer vision',
    'recommendation system', 'classification', 'prediction', 'clustering',
    'generative ai', 'llm', 'large language model', 'chatbot', 'opencv'
  ],
  'Web Development': [
    'web', 'website', 'web application', 'frontend', 'backend', 'html', 'css',
    'javascript', 'react', 'angular', 'vue', 'nodejs', 'django', 'flask',
    'api', 'rest', 'graphql', 'responsive', 'bootstrap', 'php', 'laravel'
  ],
  'Mobile Development': [
    'mobile', 'android', 'ios', 'flutter', 'react native', 'kotlin', 'swift',
    'mobile app', 'smartphone', 'tablet', 'cross-platform', 'xamarin'
  ],
  'Cybersecurity': [
    'security', 'cybersecurity', 'encryption', 'authentication', 'penetration testing',
    'vulnerability', 'firewall', 'intrusion detection', 'malware', 'forensics',
    'risk assessment', 'compliance', 'iso 27001', 'gdpr', 'ethical hacking'
  ],
  'Data Science & Analytics': [
    'data science', 'analytics', 'big data', 'data mining', 'statistics',
    'visualization', 'dashboard', 'business intelligence', 'etl', 'data warehouse',
    'pandas', 'numpy', 'matplotlib', 'tableau', 'power bi', 'excel'
  ],
  'Internet of Things (IoT)': [
    'iot', 'internet of things', 'sensor', 'embedded', 'arduino', 'raspberry pi',
    'microcontroller', 'smart home', 'automation', 'monitoring', 'rfid', 'bluetooth'
  ],
  'Blockchain & Cryptocurrency': [
    'blockchain', 'cryptocurrency', 'bitcoin', 'ethereum', 'smart contract',
    'decentralized', 'crypto', 'nft', 'defi', 'web3', 'solidity'
  ],
  'Game Development': [
    'game', 'gaming', 'unity', 'unreal', 'game development', 'vr', 'ar',
    'virtual reality', 'augmented reality', '3d', 'simulation', 'godot'
  ],
  'Healthcare & Medical': [
    'health', 'healthcare', 'medical', 'patient', 'diagnosis', 'telemedicine',
    'electronic health record', 'ehr', 'medical imaging', 'drug', 'pharmacy'
  ],
  'E-commerce & Business': [
    'ecommerce', 'e-commerce', 'online shop', 'marketplace', 'inventory',
    'supply chain', 'crm', 'erp', 'business process', 'payment', 'shopping'
  ],
  'Education & E-learning': [
    'education', 'learning', 'e-learning', 'lms', 'student', 'teacher',
    'course', 'quiz', 'examination', 'classroom', 'school', 'university'
  ],
  'Social Media & Communication': [
    'social media', 'chat', 'messaging', 'communication', 'social network',
    'forum', 'blog', 'community', 'collaboration', 'discord', 'whatsapp'
  ],
  'Cloud Computing': [
    'cloud', 'aws', 'azure', 'google cloud', 'docker', 'kubernetes',
    'microservices', 'serverless', 'saas', 'paas', 'iaas', 'devops'
  ],
  'Computer Vision': [
    'computer vision', 'image processing', 'object detection', 'face recognition',
    'ocr', 'image classification', 'video analysis', 'opencv', 'image'
  ],
  'Sports & Fitness': [
    'sports', 'fitness', 'exercise', 'training', 'coaching', 'athlete',
    'performance', 'cricket', 'football', 'basketball', 'workout', 'gym'
  ]
};

// Categorize project using keyword matching
export function categorizeByKeywords(title, scope) {
  const text = `${title} ${scope}`.toLowerCase();
  const matchedDomains = [];
  const confidenceScores = {};

  Object.entries(DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
    let score = 0;
    const matchedKeywords = [];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
        matchedKeywords.push(keyword);
      }
    });

    if (score > 0) {
      matchedDomains.push(domain);
      confidenceScores[domain] = {
        score,
        keywords: matchedKeywords,
        method: 'keyword_matching'
      };
    }
  });

  return {
    domains: matchedDomains.length > 0 ? matchedDomains : ['Other'],
    confidenceScores: matchedDomains.length > 0 ? confidenceScores : {
      'Other': { score: 1, keywords: [], method: 'default' }
    },
    primaryDomain: matchedDomains[0] || 'Other'
  };
}

// Generate detailed similarity explanation with specific reasons
export function generateSimilarityExplanation(proj1Id, proj2Id, score, overlappingDomains, text1, text2) {
  const explanationParts = [];
  const reasons = [];

  // Preprocess texts for analysis
  const tokens1 = tokenize(text1.toLowerCase());
  const tokens2 = tokenize(text2.toLowerCase());
  const words1 = new Set(tokens1);
  const words2 = new Set(tokens2);
  const commonWords = [...words1].filter(word => words2.has(word));

  // Domain overlap analysis
  if (overlappingDomains.length > 0) {
    const domainStr = overlappingDomains.join(', ');
    reasons.push(`✓ Domain Overlap: Both projects belong to ${domainStr} domain(s)`);
  }  // Find technical keywords and technologies  
  const technologyPatterns = [    // Programming Languages & Frameworks
    'python', 'javascript', 'java', 'react', 'nodejs', 'django', 'flask', 'angular', 'vue',
    'php', 'laravel', 'spring', 'html', 'css', 'bootstrap', 'flutter', 'kotlin', 'swift',
    
    // AI/ML Technologies
    'tensorflow', 'pytorch', 'scikit-learn', 'opencv', 'pandas', 'numpy', 'matplotlib',
    'machine learning', 'deep learning', 'neural network', 'nlp', 'computer vision',
    'recommendation system', 'classification', 'clustering', 'prediction',
    
    // Databases & Cloud
    'mysql', 'postgresql', 'mongodb', 'firebase', 'aws', 'azure', 'docker', 'kubernetes',
    
    // IoT & Hardware
    'arduino', 'raspberry pi', 'sensor', 'bluetooth', 'wifi', 'rfid', 'microcontroller',
    
    // Development Concepts
    'api', 'rest', 'graphql', 'microservices', 'authentication', 'encryption', 'blockchain',
    'mobile app', 'web app', 'dashboard', 'admin panel', 'user interface'
  ];
  

  const foundTechnologies = [];
  technologyPatterns.forEach(tech => {
    const regex = new RegExp(`\\b${tech}\\b`, 'gi');
    if (text1.match(regex) && text2.match(regex)) {
      foundTechnologies.push(tech);
    }
  });

  if (foundTechnologies.length > 0) {
    const techList = foundTechnologies.slice(0, 5).join(', ');
    reasons.push(`✓ Shared Technologies: Both use ${techList}`);
  }

  // Find common functional features
  const featureKeywords = [
    'authentication', 'login', 'registration', 'dashboard', 'admin', 'user management',
    'notification', 'alert', 'real-time', 'monitoring', 'analytics', 'reporting',
    'search', 'filter', 'recommendation', 'payment', 'cart', 'checkout',
    'chat', 'messaging', 'communication', 'social', 'sharing', 'feedback',
    'security', 'encryption', 'backup', 'data protection', 'privacy'
  ];

  const commonFeatures = [];
  featureKeywords.forEach(feature => {
    const regex = new RegExp(`\\b${feature}\\b`, 'gi');
    if (text1.match(regex) && text2.match(regex)) {
      commonFeatures.push(feature);
    }
  });

  if (commonFeatures.length > 0) {
    const featureList = commonFeatures.slice(0, 4).join(', ');
    reasons.push(`✓ Similar Features: Both implement ${featureList}`);
  }

  // Find common methodological approaches
  const methodologyKeywords = [
    'agile', 'waterfall', 'prototype', 'testing', 'deployment', 'development',
    'design', 'implementation', 'analysis', 'research', 'survey', 'interview',
    'evaluation', 'validation', 'optimization', 'integration', 'automation'
  ];

  const commonMethodologies = [];
  methodologyKeywords.forEach(method => {
    const regex = new RegExp(`\\b${method}\\b`, 'gi');
    if (text1.match(regex) && text2.match(regex)) {
      commonMethodologies.push(method);
    }
  });

  if (commonMethodologies.length > 0) {
    const methodList = commonMethodologies.slice(0, 3).join(', ');
    reasons.push(`✓ Similar Methodology: Both use ${methodList} approaches`);
  }

  // Find common problem domains or application areas
  const applicationAreas = [
    'healthcare', 'education', 'business', 'ecommerce', 'social media', 'gaming',
    'finance', 'banking', 'retail', 'transportation', 'logistics', 'manufacturing',
    'agriculture', 'environment', 'energy', 'smart city', 'smart home'
  ];

  const commonAreas = [];
  applicationAreas.forEach(area => {
    const regex = new RegExp(`\\b${area}\\b`, 'gi');
    if (text1.match(regex) && text2.match(regex)) {
      commonAreas.push(area);
    }
  });

  if (commonAreas.length > 0) {
    const areaList = commonAreas.join(', ');
    reasons.push(`✓ Target Domain: Both focus on ${areaList} applications`);
  }

  // Find common objectives or goals
  const objectiveKeywords = [
    'improve', 'enhance', 'optimize', 'automate', 'simplify', 'streamline',
    'reduce cost', 'increase efficiency', 'better user experience', 'accessibility',
    'scalability', 'performance', 'security', 'reliability', 'usability'
  ];

  const commonObjectives = [];
  objectiveKeywords.forEach(objective => {
    const regex = new RegExp(`\\b${objective}\\b`, 'gi');
    if (text1.match(regex) && text2.match(regex)) {
      commonObjectives.push(objective);
    }
  });

  if (commonObjectives.length > 0) {
    const objList = commonObjectives.slice(0, 3).join(', ');
    reasons.push(`✓ Common Goals: Both aim to ${objList}`);
  }

  // Analyze text similarity level
  const meaningfulCommon = commonWords.filter(word => 
    word.length > 3 && 
    !['that', 'this', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'would', 'using', 'based', 'system', 'project', 'development'].includes(word)
  );

  if (meaningfulCommon.length > 8) {
    reasons.push(`✓ High Textual Overlap: Share ${meaningfulCommon.length} significant common terms`);
  } else if (meaningfulCommon.length > 4) {
    const termList = meaningfulCommon.slice(0, 5).join(', ');
    reasons.push(`✓ Conceptual Overlap: Share key terms including ${termList}`);
  }

  // Calculate detailed similarity metrics
  const similarityLevel = getSimilarityLevel(score);
  const scorePercentage = (score * 100).toFixed(1);

  // Build comprehensive explanation
  explanationParts.push(`SIMILARITY ANALYSIS (${scorePercentage}% match - ${similarityLevel} similarity):`);
  
  if (reasons.length > 0) {
    explanationParts.push('\nSPECIFIC REASONS:');
    reasons.forEach(reason => {
      explanationParts.push(reason);
    });
  } else {
    explanationParts.push('\nSPECIFIC REASONS:');
    explanationParts.push('✓ Textual Similarity: Projects share conceptual approaches and terminology');
    if (score > 0.5) {
      explanationParts.push('✓ Methodological Overlap: Similar project structure and implementation approach');
    }
  }

  // Add similarity interpretation
  explanationParts.push('\nSIMILARITY INTERPRETATION:');
  if (score > 0.7) {
    explanationParts.push('→ Very High Similarity: Projects have nearly identical objectives, methodologies, and technical approaches. Consider reviewing for potential duplication or encouraging collaboration.');
  } else if (score > 0.5) {
    explanationParts.push('→ High Similarity: Projects share significant conceptual and technical overlap. May benefit from cross-referencing methodologies or coordinated development.');
  } else if (score > 0.3) {
    explanationParts.push('→ Moderate Similarity: Projects have some common elements but maintain distinct approaches. Could benefit from knowledge sharing.');
  } else {
    explanationParts.push('→ Low Similarity: Projects share basic conceptual elements but are largely distinct in approach and implementation.');
  }

  return explanationParts.join('\n');
}

// Determine similarity level
export function getSimilarityLevel(score) {
  if (score > 0.7) return 'Very High';
  if (score > 0.5) return 'High';
  if (score > 0.3) return 'Medium';
  return 'Low';
} 