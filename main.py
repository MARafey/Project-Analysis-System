"""
FYP Analysis System
A comprehensive tool to analyze Final Year Projects (FYPs), categorize them by domains,
and identify similar projects based on their descriptions.
"""

import pandas as pd
import numpy as np
import os
import json
import re
from typing import List, Dict, Tuple, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
import warnings
warnings.filterwarnings('ignore')

# Import Gemini AI
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

class FYPAnalyzer:
    def __init__(self, gemini_api_key: Optional[str] = None):
        """
        Initialize the FYP analyzer
        
        Args:
            gemini_api_key: Optional API key for Gemini AI integration
        """
        self.gemini_api_key = gemini_api_key
        self.projects_df = None
        self.domains = []
        self.similarity_threshold = 0.3
        
        # Initialize Gemini if API key is provided
        self.gemini_model = None
        if self.gemini_api_key and GEMINI_AVAILABLE:
            try:
                genai.configure(api_key=self.gemini_api_key)
                self.gemini_model = genai.GenerativeModel('gemini-pro')
                print("✅ Gemini AI initialized successfully")
            except Exception as e:
                print(f"⚠️ Failed to initialize Gemini AI: {e}")
                self.gemini_model = None
        elif not GEMINI_AVAILABLE:
            print("⚠️ google-generativeai package not available. Install with: pip install google-generativeai")
        
        # Predefined domain categories (fallback when Gemini is not available)
        self.domain_keywords = {
            'Artificial Intelligence & Machine Learning': [
                'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 
                'neural network', 'nlp', 'natural language processing', 'computer vision',
                'recommendation system', 'classification', 'prediction', 'clustering',
                'generative ai', 'llm', 'large language model'
            ],
            'Web Development': [
                'web', 'website', 'web application', 'frontend', 'backend', 'html', 'css',
                'javascript', 'react', 'angular', 'vue', 'nodejs', 'django', 'flask',
                'api', 'rest', 'graphql', 'responsive'
            ],
            'Mobile Development': [
                'mobile', 'android', 'ios', 'flutter', 'react native', 'kotlin', 'swift',
                'mobile app', 'smartphone', 'tablet', 'cross-platform'
            ],
            'Cybersecurity': [
                'security', 'cybersecurity', 'encryption', 'authentication', 'penetration testing',
                'vulnerability', 'firewall', 'intrusion detection', 'malware', 'forensics',
                'risk assessment', 'compliance', 'iso 27001', 'gdpr'
            ],
            'Data Science & Analytics': [
                'data science', 'analytics', 'big data', 'data mining', 'statistics',
                'visualization', 'dashboard', 'business intelligence', 'etl', 'data warehouse',
                'pandas', 'numpy', 'matplotlib', 'tableau', 'power bi'
            ],
            'Internet of Things (IoT)': [
                'iot', 'internet of things', 'sensor', 'embedded', 'arduino', 'raspberry pi',
                'microcontroller', 'smart home', 'automation', 'monitoring', 'rfid', 'bluetooth'
            ],
            'Blockchain & Cryptocurrency': [
                'blockchain', 'cryptocurrency', 'bitcoin', 'ethereum', 'smart contract',
                'decentralized', 'crypto', 'nft', 'defi', 'web3'
            ],
            'Game Development': [
                'game', 'gaming', 'unity', 'unreal', 'game development', 'vr', 'ar',
                'virtual reality', 'augmented reality', '3d', 'simulation'
            ],
            'Healthcare & Medical': [
                'health', 'healthcare', 'medical', 'patient', 'diagnosis', 'telemedicine',
                'electronic health record', 'ehr', 'medical imaging', 'drug', 'pharmacy'
            ],
            'E-commerce & Business': [
                'ecommerce', 'e-commerce', 'online shop', 'marketplace', 'inventory',
                'supply chain', 'crm', 'erp', 'business process', 'payment'
            ],
            'Education & E-learning': [
                'education', 'learning', 'e-learning', 'lms', 'student', 'teacher',
                'course', 'quiz', 'examination', 'classroom', 'school', 'university'
            ],
            'Social Media & Communication': [
                'social media', 'chat', 'messaging', 'communication', 'social network',
                'forum', 'blog', 'community', 'collaboration'
            ],
            'Cloud Computing': [
                'cloud', 'aws', 'azure', 'google cloud', 'docker', 'kubernetes',
                'microservices', 'serverless', 'saas', 'paas', 'iaas'
            ],
            'Computer Vision': [
                'computer vision', 'image processing', 'object detection', 'face recognition',
                'ocr', 'image classification', 'video analysis', 'opencv'
            ],
            'Sports & Fitness': [
                'sports', 'fitness', 'exercise', 'training', 'coaching', 'athlete',
                'performance', 'cricket', 'football', 'basketball', 'workout'
            ]
        }
    
    def load_data(self, file_path: str) -> pd.DataFrame:
        """
        Load FYP data from Excel file
        
        Args:
            file_path: Path to the Excel file
            
        Returns:
            DataFrame containing the FYP data
        """
        try:
            df = pd.read_excel(file_path)
            print(f"✓ Loaded {len(df)} projects from {file_path}")
            
            # Standardize column names
            column_mapping = {
                'Project Title': 'project_title',
                'Project Scope': 'project_scope',
                'Short_Title': 'short_title',
                'Project Short Title': 'short_title',
                'Categorize the primary domain of project': 'primary_domain',
                'Sub-category of the project': 'sub_category'
            }
            
            for old_col, new_col in column_mapping.items():
                if old_col in df.columns:
                    df[new_col] = df[old_col]
            
            # Clean project scope text
            if 'project_scope' in df.columns:
                df['project_scope'] = df['project_scope'].fillna('')
                df['cleaned_scope'] = df['project_scope'].apply(self.clean_text)
            
            if 'project_title' in df.columns:
                df['project_title'] = df['project_title'].fillna('')
                df['cleaned_title'] = df['project_title'].apply(self.clean_text)
            
            self.projects_df = df
            return df
            
        except Exception as e:
            print(f"✗ Error loading data: {e}")
            return pd.DataFrame()
    
    def clean_text(self, text: str) -> str:
        """
        Clean and preprocess text data
        
        Args:
            text: Raw text to clean
            
        Returns:
            Cleaned text
        """
        if pd.isna(text) or not isinstance(text, str):
            return ""
        
        # Remove extra whitespace and newlines
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Convert to lowercase for matching
        return text.lower()
    
    def categorize_with_gemini(self, project_title: str, project_scope: str) -> Dict:
        """
        Use Gemini AI to categorize a project into domains
        
        Args:
            project_title: Title of the project
            project_scope: Description/scope of the project
            
        Returns:
            Dictionary containing domains and confidence information
        """
        if not self.gemini_model:
            return None
        
        # Available domain categories
        domains_list = list(self.domain_keywords.keys())
        domains_str = ", ".join(domains_list)
        
        prompt = f"""
        Analyze the following Final Year Project (FYP) and categorize it into one or more relevant technical domains.

        Project Title: {project_title}
        Project Description: {project_scope}

        Available Domains:
        {domains_str}

        Instructions:
        1. Identify which domains this project belongs to (it can belong to multiple domains)
        2. For each relevant domain, provide a confidence score from 1-10
        3. Explain why the project fits into each selected domain
        4. Consider the technical requirements, methodologies, and objectives

        Respond in JSON format:
        {{
            "domains": [
                {{
                    "name": "Domain Name",
                    "confidence": 8,
                    "reasoning": "Brief explanation why this project fits this domain"
                }}
            ],
            "primary_domain": "Most relevant domain name",
            "summary": "Brief overall categorization summary"
        }}

        Only include domains with confidence >= 6. If no domain fits well, suggest the closest match.
        """
        
        try:
            response = self.gemini_model.generate_content(prompt)
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Clean up response if it has markdown formatting
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].strip()
            
            result = json.loads(response_text)
            return result
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parsing error for Gemini response: {e}")
            return None
        except Exception as e:
            print(f"⚠️ Gemini API error: {e}")
            return None
    
    def categorize_by_domain(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Categorize projects by domain using Gemini AI or keyword matching as fallback
        
        Args:
            df: DataFrame containing project data
            
        Returns:
            DataFrame with domain categorizations
        """
        print("🔍 Categorizing projects by domain...")
        
        if self.gemini_model:
            print("🤖 Using Gemini AI for intelligent domain categorization...")
        else:
            print("📝 Using keyword-based categorization (fallback mode)...")
        
        domain_results = []
        
        for idx, row in df.iterrows():
            project_id = row.get('short_title', f"Project_{idx}")
            title = row.get('project_title', '')
            scope = row.get('project_scope', '')
            
            # Try Gemini AI first
            gemini_result = None
            if self.gemini_model and title and scope:
                print(f"🔄 Analyzing project {idx+1}/{len(df)}: {project_id}")
                gemini_result = self.categorize_with_gemini(title, scope)
            
            matched_domains = []
            confidence_scores = {}
            
            if gemini_result:
                # Use Gemini results
                for domain_info in gemini_result.get('domains', []):
                    domain_name = domain_info.get('name', '')
                    confidence = domain_info.get('confidence', 0)
                    reasoning = domain_info.get('reasoning', '')
                    
                    if domain_name and confidence >= 6:
                        matched_domains.append(domain_name)
                        confidence_scores[domain_name] = {
                            'score': confidence,
                            'reasoning': reasoning,
                            'method': 'gemini_ai'
                        }
                
                # Set primary domain from Gemini
                primary_domain = gemini_result.get('primary_domain', '')
                if primary_domain and primary_domain not in matched_domains:
                    matched_domains.insert(0, primary_domain)
                    confidence_scores[primary_domain] = {
                        'score': 8,
                        'reasoning': 'Primary domain identified by Gemini AI',
                        'method': 'gemini_ai'
                    }
            
            # Fallback to keyword matching if Gemini didn't find domains
            if not matched_domains:
                title_lower = title.lower()
                scope_lower = scope.lower()
                combined_text = f"{title_lower} {scope_lower}"
                
                # Check against predefined domains
                for domain, keywords in self.domain_keywords.items():
                    score = 0
                    matched_keywords = []
                    
                    for keyword in keywords:
                        count = combined_text.count(keyword.lower())
                        if count > 0:
                            score += count
                            matched_keywords.append(keyword)
                    
                    if score > 0:
                        matched_domains.append(domain)
                        confidence_scores[domain] = {
                            'score': score,
                            'keywords': matched_keywords,
                            'method': 'keyword_matching'
                        }
                
                # If still no domains matched, try existing categorization
                if not matched_domains and 'primary_domain' in row:
                    existing_domain = row['primary_domain']
                    if pd.notna(existing_domain) and existing_domain.strip():
                        matched_domains.append(existing_domain.strip())
                        confidence_scores[existing_domain.strip()] = {
                            'score': 1,
                            'keywords': ['manual_categorization'],
                            'method': 'existing_data'
                        }
            
            # Default to 'Other' if no domains found
            if not matched_domains:
                matched_domains = ['Other']
                confidence_scores['Other'] = {
                    'score': 1, 
                    'keywords': [],
                    'method': 'default'
                }
            
            domain_results.append({
                'project_id': project_id,
                'project_title': title,
                'domains': matched_domains,
                'confidence_scores': confidence_scores,
                'primary_domain': matched_domains[0] if matched_domains else 'Other',
                'categorization_method': 'gemini_ai' if gemini_result else 'keyword_matching'
            })
        
        results_df = pd.DataFrame(domain_results)
        print(f"✓ Categorized {len(results_df)} projects into domains")
        
        # Print method statistics
        method_counts = results_df['categorization_method'].value_counts()
        print(f"📊 Categorization methods used:")
        for method, count in method_counts.items():
            print(f"   {method}: {count} projects")
        
        return results_df
    
    def calculate_similarity(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate similarity between projects using TF-IDF and cosine similarity
        
        Args:
            df: DataFrame containing project data
            
        Returns:
            DataFrame with similarity results
        """
        print("🔍 Calculating project similarities...")
        
        # Prepare text data for similarity analysis
        texts = []
        project_ids = []
        
        for idx, row in df.iterrows():
            title = row.get('cleaned_title', '')
            scope = row.get('cleaned_scope', '')
            combined_text = f"{title} {scope}"
            
            if combined_text.strip():
                texts.append(combined_text)
                project_ids.append(row.get('short_title', f"Project_{idx}"))
        
        if len(texts) < 2:
            print("⚠️ Not enough text data for similarity analysis")
            return pd.DataFrame()
        
        # Calculate TF-IDF vectors
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            # Calculate cosine similarity
            similarity_matrix = cosine_similarity(tfidf_matrix)
            
            # Find similar projects
            similar_pairs = []
            
            for i in range(len(project_ids)):
                for j in range(i + 1, len(project_ids)):
                    similarity_score = similarity_matrix[i][j]
                    
                    if similarity_score > self.similarity_threshold:
                        # Get domain overlap
                        proj1_domains = self.get_project_domains(project_ids[i], df)
                        proj2_domains = self.get_project_domains(project_ids[j], df)
                        
                        overlapping_domains = set(proj1_domains) & set(proj2_domains)
                        
                        # Determine similarity level
                        if similarity_score > 0.7:
                            similarity_level = "Very High"
                        elif similarity_score > 0.5:
                            similarity_level = "High"
                        elif similarity_score > 0.3:
                            similarity_level = "Medium"
                        else:
                            similarity_level = "Low"
                        
                        # Generate explanation
                        explanation = self.generate_similarity_explanation(
                            project_ids[i], project_ids[j], 
                            similarity_score, overlapping_domains,
                            texts[i], texts[j]
                        )
                        
                        similar_pairs.append({
                            'project_1_id': project_ids[i],
                            'project_2_id': project_ids[j],
                            'similarity_score': round(similarity_score, 3),
                            'similarity_level': similarity_level,
                            'overlapping_domains': list(overlapping_domains),
                            'explanation': explanation
                        })
            
            results_df = pd.DataFrame(similar_pairs)
            
            # Sort by similarity score (descending)
            if not results_df.empty:
                results_df = results_df.sort_values('similarity_score', ascending=False)
            
            print(f"✓ Found {len(results_df)} similar project pairs")
            return results_df
            
        except Exception as e:
            print(f"✗ Error in similarity calculation: {e}")
            return pd.DataFrame()
    
    def get_project_domains(self, project_id: str, df: pd.DataFrame) -> List[str]:
        """
        Get domains for a specific project
        
        Args:
            project_id: Project identifier
            df: DataFrame containing project data
            
        Returns:
            List of domains for the project
        """
        project_row = df[df.get('short_title', '') == project_id]
        if project_row.empty:
            return []
        
        # Try to get domains from categorization results
        for domain, keywords in self.domain_keywords.items():
            title = project_row.iloc[0].get('cleaned_title', '')
            scope = project_row.iloc[0].get('cleaned_scope', '')
            combined_text = f"{title} {scope}"
            
            for keyword in keywords:
                if keyword.lower() in combined_text:
                    return [domain]
        
        return ['Other']
    
    def generate_similarity_explanation(self, proj1_id: str, proj2_id: str, 
                                      similarity_score: float, overlapping_domains: set,
                                      text1: str, text2: str) -> str:
        """
        Generate an explanation for why two projects are similar
        
        Args:
            proj1_id: First project ID
            proj2_id: Second project ID
            similarity_score: Similarity score between projects
            overlapping_domains: Domains that overlap between projects
            text1: Text content of first project
            text2: Text content of second project
            
        Returns:
            Explanation string
        """
        explanation_parts = []
        
        # Domain overlap explanation
        if overlapping_domains:
            domain_str = ", ".join(overlapping_domains)
            explanation_parts.append(f"Both projects belong to {domain_str} domain(s)")
        
        # Find common keywords
        words1 = set(text1.split())
        words2 = set(text2.split())
        common_words = words1 & words2
        
        # Filter common meaningful words (remove very short words and common words)
        meaningful_common = [word for word in common_words 
                           if len(word) > 3 and word not in ['that', 'this', 'with', 'from', 'they', 'were', 'been']]
        
        if meaningful_common:
            if len(meaningful_common) > 5:
                explanation_parts.append(f"Share multiple technical concepts and approaches")
            else:
                explanation_parts.append(f"Share common concepts: {', '.join(list(meaningful_common)[:3])}")
        
        # Similarity level explanation
        if similarity_score > 0.7:
            explanation_parts.append("Very similar project objectives and methodologies")
        elif similarity_score > 0.5:
            explanation_parts.append("Similar approach with some methodological overlap")
        else:
            explanation_parts.append("Some conceptual similarities in approach")
        
        return ". ".join(explanation_parts) + "."
    
    def create_domain_excel(self, domain_df: pd.DataFrame, output_path: str):
        """
        Create Excel file with projects categorized by domains
        
        Args:
            domain_df: DataFrame with domain categorizations
            output_path: Output file path
        """
        print(f"📊 Creating domain categorization Excel file...")
        
        try:
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                # Main summary sheet
                domain_df.to_excel(writer, sheet_name='Project_Domains', index=False)
                
                # Create separate sheets for each domain
                unique_domains = set()
                for domains_list in domain_df['domains']:
                    unique_domains.update(domains_list)
                
                for domain in sorted(unique_domains):
                    # Filter projects for this domain
                    domain_projects = domain_df[domain_df['domains'].apply(lambda x: domain in x)]
                    
                    if not domain_projects.empty:
                        # Clean sheet name (Excel sheet names have restrictions)
                        sheet_name = re.sub(r'[^\w\s-]', '', domain)[:31]
                        domain_projects.to_excel(writer, sheet_name=sheet_name, index=False)
                
                print(f"✓ Created domain categorization file: {output_path}")
                
        except Exception as e:
            print(f"✗ Error creating domain Excel file: {e}")
    
    def create_similarity_excel(self, similarity_df: pd.DataFrame, output_path: str):
        """
        Create Excel file with project similarities
        
        Args:
            similarity_df: DataFrame with similarity results
            output_path: Output file path
        """
        print(f"📊 Creating similarity analysis Excel file...")
        
        try:
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                # Main similarity sheet
                similarity_df.to_excel(writer, sheet_name='Project_Similarities', index=False)
                
                # Create sheets by similarity level
                similarity_levels = ['Very High', 'High', 'Medium', 'Low']
                
                for level in similarity_levels:
                    level_df = similarity_df[similarity_df['similarity_level'] == level]
                    if not level_df.empty:
                        sheet_name = f"{level}_Similarity"
                        level_df.to_excel(writer, sheet_name=sheet_name, index=False)
                
                print(f"✓ Created similarity analysis file: {output_path}")
                
        except Exception as e:
            print(f"✗ Error creating similarity Excel file: {e}")
    
    def analyze_fyp_data(self, input_file: str, output_dir: str = "output"):
        """
        Main function to analyze FYP data and generate output files
        
        Args:
            input_file: Path to input Excel file
            output_dir: Directory to save output files
        """
        print("🚀 Starting FYP Analysis...")
        print("="*60)
        
        # Create output directory
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Load data
        df = self.load_data(input_file)
        if df.empty:
            print("❌ No data loaded. Exiting.")
            return
        
        # Categorize by domain
        domain_df = self.categorize_by_domain(df)
        
        # Calculate similarities
        similarity_df = self.calculate_similarity(df)
        
        # Generate output files
        domain_output = os.path.join(output_dir, "fyp_domain_categorization.xlsx")
        similarity_output = os.path.join(output_dir, "fyp_similarity_analysis.xlsx")
        
        self.create_domain_excel(domain_df, domain_output)
        self.create_similarity_excel(similarity_df, similarity_output)
        
        # Generate summary statistics
        self.print_summary_statistics(domain_df, similarity_df)
        
        print("="*60)
        print("✅ FYP Analysis Complete!")
        print(f"📁 Output files saved in: {output_dir}")
    
    def print_summary_statistics(self, domain_df: pd.DataFrame, similarity_df: pd.DataFrame):
        """
        Print summary statistics of the analysis
        
        Args:
            domain_df: Domain categorization results
            similarity_df: Similarity analysis results
        """
        print("\n📈 ANALYSIS SUMMARY")
        print("-" * 40)
        
        # Domain statistics
        total_projects = len(domain_df)
        print(f"Total Projects Analyzed: {total_projects}")
        
        # Count projects per domain
        domain_counts = {}
        for domains_list in domain_df['domains']:
            for domain in domains_list:
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
        
        print(f"\nTop Domains:")
        for domain, count in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"  {domain}: {count} projects")
        
        # Similarity statistics
        if not similarity_df.empty:
            total_pairs = len(similarity_df)
            print(f"\nSimilar Project Pairs Found: {total_pairs}")
            
            similarity_level_counts = similarity_df['similarity_level'].value_counts()
            for level, count in similarity_level_counts.items():
                print(f"  {level} Similarity: {count} pairs")
        else:
            print("\nNo similar project pairs found above threshold")


def main():
    """
    Main function to run the FYP analysis
    """
    print("🎓 FYP Analysis System")
    print("=====================")
    
    # Initialize analyzer
    analyzer = FYPAnalyzer()
    
    # Check for available Excel files
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
    
    if not excel_files:
        print("❌ No Excel files found in current directory")
        return
    
    print("📁 Available Excel files:")
    for i, file in enumerate(excel_files, 1):
        print(f"  {i}. {file}")
    
    # Use the first available file for demonstration
    # In a real application, you might want to let the user choose
    input_file = excel_files[0]
    print(f"\n🎯 Analyzing: {input_file}")
    
    # Run analysis
    analyzer.analyze_fyp_data(input_file)


if __name__ == "__main__":
    main()
