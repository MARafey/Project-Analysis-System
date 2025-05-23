"""
Streamlit Web Application for FYP Analysis System
"""

import streamlit as st
import pandas as pd
import os
import tempfile
from main import FYPAnalyzer
from config import Config
import zipfile
import io

def main():
    st.set_page_config(
        page_title="FYP Analysis System",
        page_icon="🎓",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    st.title("🎓 Final Year Project (FYP) Analysis System")
    st.markdown("---")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # API Key configuration
        st.subheader("API Keys")
        gemini_key = st.text_input("Gemini API Key", type="password", 
                                 help="Enter your Google Gemini API key for AI-powered domain categorization")
        hf_key = st.text_input("HuggingFace API Key", type="password",
                             help="Enter your HuggingFace API key for enhanced text processing")
        
        if gemini_key:
            Config.set_gemini_api_key(gemini_key)
            st.success("✅ Gemini API key configured")
        if hf_key:
            Config.set_huggingface_api_key(hf_key)
            st.success("✅ HuggingFace API key configured")
        
        # Analysis settings
        st.subheader("Analysis Settings")
        similarity_threshold = st.slider("Similarity Threshold", 0.1, 0.9, 0.3, 0.1,
                                       help="Projects with similarity above this threshold will be considered similar")
        Config.SIMILARITY_THRESHOLD = similarity_threshold
        
        # Display current config
        st.subheader("Current Configuration")
        config_summary = Config.get_config_summary()
        for key, value in config_summary.items():
            st.text(f"{key}: {value}")
        
        # Information about Gemini AI
        st.subheader("🤖 AI-Powered Analysis")
        if gemini_key:
            st.info("🚀 Gemini AI enabled for intelligent domain categorization")
        else:
            st.warning("⚠️ Gemini AI not configured. Using keyword-based categorization.")
            st.markdown("""
            **To enable AI categorization:**
            1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
            2. Enter the key above
            3. Run analysis for better results!
            """)
    
    # Main content area
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("📁 Upload FYP Data")
        st.markdown("""
        Upload an Excel file containing FYP project data. The file should contain columns for:
        - **Project Title**: Title of the FYP
        - **Project Scope**: Detailed description of the project
        - **Short_Title**: Short identifier (optional)
        """)
        
        uploaded_file = st.file_uploader(
            "Choose an Excel file",
            type=['xlsx', 'xls'],
            help="Upload your FYP projects Excel file"
        )
        
        if uploaded_file is not None:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                temp_path = tmp_file.name
            
            try:
                # Display file info
                st.success(f"✅ File uploaded: {uploaded_file.name}")
                
                # Preview data
                df = pd.read_excel(temp_path)
                st.subheader("📊 Data Preview")
                st.dataframe(df.head(), use_container_width=True)
                st.info(f"Total projects: {len(df)}")
                
                # Analysis method info
                if Config.GEMINI_API_KEY:
                    st.info("🤖 Will use Gemini AI for intelligent domain categorization")
                else:
                    st.info("📝 Will use keyword-based categorization")
                
                # Analysis button
                if st.button("🚀 Analyze FYP Data", type="primary", key="analyze_btn"):
                    with st.spinner("Analyzing FYP data... This may take a few minutes."):
                        # Initialize analyzer with Gemini API key
                        analyzer = FYPAnalyzer(gemini_api_key=Config.GEMINI_API_KEY)
                        analyzer.similarity_threshold = Config.SIMILARITY_THRESHOLD
                        
                        # Create output directory
                        output_dir = tempfile.mkdtemp()
                        
                        # Progress tracking
                        progress_bar = st.progress(0)
                        status_text = st.empty()
                        
                        try:
                            status_text.text("🔄 Loading and preprocessing data...")
                            progress_bar.progress(20)
                            
                            status_text.text("🤖 Categorizing projects by domain...")
                            progress_bar.progress(50)
                            
                            status_text.text("🔍 Calculating project similarities...")
                            progress_bar.progress(80)
                            
                            # Run analysis
                            analyzer.analyze_fyp_data(temp_path, output_dir)
                            
                            progress_bar.progress(100)
                            status_text.text("✅ Analysis completed!")
                            
                            st.success("🎉 Analysis completed successfully!")
                            
                            # Display results
                            domain_file = os.path.join(output_dir, Config.DOMAIN_FILE_NAME)
                            similarity_file = os.path.join(output_dir, Config.SIMILARITY_FILE_NAME)
                            
                            # Create tabs for results
                            tab1, tab2 = st.tabs(["📈 Domain Results", "🔍 Similarity Results"])
                            
                            with tab1:
                                if os.path.exists(domain_file):
                                    st.subheader("📈 Domain Categorization Results")
                                    domain_df = pd.read_excel(domain_file)
                                    st.dataframe(domain_df, use_container_width=True)
                                    
                                    # Download button for domain file
                                    with open(domain_file, 'rb') as f:
                                        st.download_button(
                                            label="📥 Download Domain Categorization",
                                            data=f.read(),
                                            file_name=Config.DOMAIN_FILE_NAME,
                                            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                            key="download_domain"
                                        )
                            
                            with tab2:
                                if os.path.exists(similarity_file):
                                    st.subheader("🔍 Similarity Analysis Results")
                                    similarity_df = pd.read_excel(similarity_file)
                                    
                                    if not similarity_df.empty:
                                        st.dataframe(similarity_df, use_container_width=True)
                                        
                                        # Show top similar pairs
                                        st.subheader("🏆 Top Similar Project Pairs")
                                        top_pairs = similarity_df.head(5)
                                        for idx, row in top_pairs.iterrows():
                                            with st.expander(f"{row['project_1_id']} ↔ {row['project_2_id']} (Score: {row['similarity_score']})"):
                                                st.write(f"**Similarity Level:** {row['similarity_level']}")
                                                st.write(f"**Overlapping Domains:** {', '.join(row['overlapping_domains'])}")
                                                st.write(f"**Explanation:** {row['explanation']}")
                                    else:
                                        st.info("No similar project pairs found above the threshold.")
                                    
                                    # Download button for similarity file
                                    with open(similarity_file, 'rb') as f:
                                        st.download_button(
                                            label="📥 Download Similarity Analysis",
                                            data=f.read(),
                                            file_name=Config.SIMILARITY_FILE_NAME,
                                            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                            key="download_similarity"
                                        )
                            
                            # Download all reports as ZIP
                            st.subheader("📦 Download All Reports")
                            zip_buffer = io.BytesIO()
                            with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
                                if os.path.exists(domain_file):
                                    zip_file.write(domain_file, Config.DOMAIN_FILE_NAME)
                                if os.path.exists(similarity_file):
                                    zip_file.write(similarity_file, Config.SIMILARITY_FILE_NAME)
                            
                            st.download_button(
                                label="📦 Download All Reports (ZIP)",
                                data=zip_buffer.getvalue(),
                                file_name="fyp_analysis_reports.zip",
                                mime="application/zip",
                                key="download_all"
                            )
                        
                        except Exception as e:
                            st.error(f"❌ Error during analysis: {str(e)}")
                            st.error("Please check your data format and try again.")
                
            except Exception as e:
                st.error(f"❌ Error reading file: {str(e)}")
                st.error("Please ensure your Excel file has the required columns.")
            
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
    
    with col2:
        st.header("ℹ️ How it Works")
        st.markdown("""
        **🤖 AI-Powered Domain Categorization:**
        - Uses Gemini AI for intelligent analysis (if API key provided)
        - Analyzes project titles and descriptions
        - Categorizes into 15+ technical domains
        - Projects can belong to multiple domains
        - Provides confidence scores and reasoning
        
        **🔍 Similarity Analysis:**
        - Compares all project pairs using TF-IDF
        - Uses cosine similarity for scoring
        - Identifies overlapping projects
        - Provides detailed explanations
        - Handles different aspects of similar ideas
        
        **📊 Output Files:**
        1. **Domain Categorization Excel**: Projects grouped by domains
        2. **Similarity Analysis Excel**: Similar project pairs with explanations
        """)
        
        st.header("📋 Sample Data Format")
        sample_data = {
            'Project Title': ['AI Chatbot', 'E-commerce Website'],
            'Project Scope': [
                'Development of an AI-powered chatbot using NLP...',
                'Creation of a responsive e-commerce platform...'
            ],
            'Short_Title': ['F24-001-AI-Bot', 'F24-002-Ecom']
        }
        st.dataframe(pd.DataFrame(sample_data), use_container_width=True)
        
        st.header("🚀 Enhanced Features")
        st.markdown("""
        - 🤖 **AI-Powered Categorization** with Gemini
        - 📊 **Multiple domain categorization**
        - 🔍 **Similarity detection with explanations**  
        - 🎯 **Handles similar projects with different focuses**
        - 📑 **Export to Excel with multiple sheets**
        - ⚙️ **Configurable similarity thresholds**
        - 📈 **Support for large datasets**
        - 🌐 **Web-based interface**
        - 📥 **Easy download options**
        """)
        
        st.header("🔑 Getting Gemini API Key")
        st.markdown("""
        1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
        2. Sign in with your Google account
        3. Click "Create API Key"
        4. Copy the key and paste it in the sidebar
        5. Enjoy AI-powered analysis!
        """)

if __name__ == "__main__":
    main() 