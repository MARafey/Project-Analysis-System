"""
Demo script for FYP Analysis System
This script demonstrates how to use the FYP analyzer programmatically.
"""

import pandas as pd
from main import FYPAnalyzer
from config import Config
import os

def run_demo():
    """
    Run a demonstration of the FYP Analysis System
    """
    print("🎯 FYP Analysis System Demo")
    print("=" * 50)
    
    # Initialize the analyzer
    print("🔧 Initializing FYP Analyzer...")
    analyzer = FYPAnalyzer()
    
    # Set custom similarity threshold
    analyzer.similarity_threshold = 0.25  # Lower threshold for demo
    print(f"📊 Set similarity threshold to: {analyzer.similarity_threshold}")
    
    # Check for available Excel files
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~')]
    
    if not excel_files:
        print("❌ No Excel files found!")
        return
    
    # Use the first available file
    input_file = excel_files[0]
    print(f"📁 Using input file: {input_file}")
    
    # Create custom output directory
    output_dir = "demo_output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    print(f"📂 Output directory: {output_dir}")
    
    # Run the analysis
    print("\n🚀 Starting analysis...")
    analyzer.analyze_fyp_data(input_file, output_dir)
    
    # Display some additional insights
    print("\n📈 Additional Insights:")
    
    # Load the results to show some statistics
    domain_file = os.path.join(output_dir, "fyp_domain_categorization.xlsx")
    similarity_file = os.path.join(output_dir, "fyp_similarity_analysis.xlsx")
    
    if os.path.exists(domain_file):
        domain_df = pd.read_excel(domain_file, sheet_name='Project_Domains')
        print(f"📊 Total projects categorized: {len(domain_df)}")
        
        # Count multi-domain projects
        multi_domain_count = len(domain_df[domain_df['domains'].str.len() > 20])  # Rough estimate
        print(f"🔀 Projects in multiple domains: ~{multi_domain_count}")
    
    if os.path.exists(similarity_file):
        similarity_df = pd.read_excel(similarity_file, sheet_name='Project_Similarities')
        if not similarity_df.empty:
            print(f"🎯 Similar project pairs found: {len(similarity_df)}")
            
            # Show highest similarity pair
            top_pair = similarity_df.iloc[0]
            print(f"🏆 Most similar pair:")
            print(f"   Project 1: {top_pair['project_1_id']}")
            print(f"   Project 2: {top_pair['project_2_id']}")
            print(f"   Similarity: {top_pair['similarity_score']:.3f}")
            print(f"   Level: {top_pair['similarity_level']}")
    
    print(f"\n✅ Demo completed! Check '{output_dir}' for results.")
    
    # Show file paths
    print("\n📁 Generated Files:")
    for file in os.listdir(output_dir):
        if file.endswith('.xlsx'):
            file_path = os.path.join(output_dir, file)
            file_size = os.path.getsize(file_path) / 1024  # KB
            print(f"   📄 {file} ({file_size:.1f} KB)")

def create_sample_data():
    """
    Create a sample dataset for testing
    """
    print("📝 Creating sample dataset...")
    
    sample_projects = [
        {
            'Project Title': 'AI-Powered Chatbot for Customer Service',
            'Project Scope': 'Development of an intelligent chatbot using natural language processing and machine learning to handle customer inquiries automatically. The system will use deep learning models to understand customer intent and provide accurate responses.',
            'Short_Title': 'F24-001-AI-Chatbot'
        },
        {
            'Project Title': 'E-commerce Website with Recommendation System',
            'Project Scope': 'Building a comprehensive e-commerce platform with integrated recommendation engine. Uses collaborative filtering and machine learning algorithms to suggest products to customers based on their browsing history and preferences.',
            'Short_Title': 'F24-002-Ecom-Rec'
        },
        {
            'Project Title': 'Smart Home IoT Security System',
            'Project Scope': 'Development of a comprehensive security system for smart homes using IoT sensors, cameras, and machine learning for threat detection. Includes mobile app for monitoring and real-time alerts.',
            'Short_Title': 'F24-003-IoT-Security'
        },
        {
            'Project Title': 'Virtual Reality Game for Education',
            'Project Scope': 'Creating an immersive VR educational game using Unity 3D. The game teaches physics concepts through interactive simulations and gamification elements to enhance learning experience.',
            'Short_Title': 'F24-004-VR-Education'
        },
        {
            'Project Title': 'Conversational AI Assistant',
            'Project Scope': 'Building an advanced conversational AI system using transformer models and natural language understanding. The assistant can handle complex conversations and learn from user interactions.',
            'Short_Title': 'F24-005-AI-Assistant'
        }
    ]
    
    df = pd.DataFrame(sample_projects)
    df.to_excel('sample_fyp_data.xlsx', index=False)
    print("✅ Sample data created: sample_fyp_data.xlsx")
    
    return df

if __name__ == "__main__":
    # Check if we have data files, if not create sample data
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~')]
    
    if not excel_files:
        print("🔍 No Excel files found. Creating sample data...")
        create_sample_data()
    
    # Run the demo
    run_demo() 