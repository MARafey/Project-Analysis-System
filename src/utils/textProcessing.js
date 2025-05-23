import natural from 'natural';
import { removeStopwords, eng } from 'stopword';

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
    
    // Convert to lowercase and tokenize
    const tokens = natural.WordTokenizer().tokenize(text.toLowerCase());
    
    // Remove stopwords and filter valid words
    const filteredTokens = removeStopwords(tokens, eng)
      .filter(token => token.length > 2 && /^[a-z]+$/.test(token));
    
    // Add bigrams
    const bigrams = natural.NGrams.bigrams(filteredTokens);
    const bigramStrings = bigrams.map(bigram => bigram.join('_'));
    
    return [...filteredTokens, ...bigramStrings];
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

// Generate similarity explanation
export function generateSimilarityExplanation(proj1Id, proj2Id, score, overlappingDomains, text1, text2) {
  const explanationParts = [];

  // Domain overlap explanation
  if (overlappingDomains.length > 0) {
    const domainStr = overlappingDomains.join(', ');
    explanationParts.push(`Both projects belong to ${domainStr} domain(s)`);
  }

  // Find common keywords
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const commonWords = [...words1].filter(word => words2.has(word));

  // Filter meaningful common words
  const meaningfulCommon = commonWords.filter(word => 
    word.length > 3 && !['that', 'this', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'would'].includes(word)
  );

  if (meaningfulCommon.length > 0) {
    if (meaningfulCommon.length > 5) {
      explanationParts.push('Share multiple technical concepts and approaches');
    } else {
      explanationParts.push(`Share common concepts: ${meaningfulCommon.slice(0, 3).join(', ')}`);
    }
  }

  // Similarity level explanation
  if (score > 0.7) {
    explanationParts.push('Very similar project objectives and methodologies');
  } else if (score > 0.5) {
    explanationParts.push('Similar approach with some methodological overlap');
  } else {
    explanationParts.push('Some conceptual similarities in approach');
  }

  return explanationParts.join('. ') + '.';
}

// Determine similarity level
export function getSimilarityLevel(score) {
  if (score > 0.7) return 'Very High';
  if (score > 0.5) return 'High';
  if (score > 0.3) return 'Medium';
  return 'Low';
} 