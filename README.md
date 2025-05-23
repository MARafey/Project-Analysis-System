# 🎓 FYP Analysis System

A comprehensive tool to analyze Final Year Projects (FYPs), categorize them by domains, and identify similar projects based on their descriptions.

## 🌟 Features

- **🤖 AI-Powered Domain Categorization**: Uses Gemini AI for intelligent project categorization with reasoning
- **📊 Fallback Keyword Matching**: Automatic fallback to keyword-based categorization if AI is unavailable
- **🔍 Advanced Similarity Analysis**: Identifies similar projects and explains why they overlap
- **🎯 Multiple Domain Support**: Projects can belong to multiple domains with confidence scores
- **📈 Similarity Levels**: Classifies similarity as Very High, High, Medium, or Low with detailed explanations
- **📑 Comprehensive Excel Export**: Generates organized Excel files with multiple sheets and insights
- **🌐 Modern Web Interface**: Easy-to-use Streamlit web application with progress tracking
- **🔑 API Integration**: Full Gemini AI and optional HuggingFace API support

## 🚀 Quick Start

### Option 1: Use Online (Recommended)

🌐 **[Try the live demo on Vercel →](https://project-analysis-system.vercel.app)**

Simply visit the deployed application and start analyzing your FYP projects immediately - no installation required!

### Option 2: Local Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/MARafey/Project-Analysis-System.git
   cd Project-Analysis-System
   ```

2. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Web App**:

   ```bash
   streamlit run web_app.py
   ```

4. **Upload Your Data**: Upload an Excel file containing FYP project data through the web interface

5. **Download Results**: Get two Excel files with domain categorization and similarity analysis

### Option 3: Command Line

1. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

2. **Run Analysis**:
   ```python
   python main.py
   ```

## 🚀 Deployment

This project is configured for easy deployment on Vercel:

### Deploy to Vercel

1. **Fork this repository**
2. **Connect to Vercel**:

   - Visit [vercel.com](https://vercel.com)
   - Import your forked repository
   - Deploy automatically

3. **Optional: Configure Environment Variables**:
   - Add `GEMINI_API_KEY` for AI-powered categorization
   - Add `HUGGINGFACE_API_KEY` for enhanced NLP

## 📊 Input Data Format

Your Excel file should contain the following columns:

| Column        | Description                             | Required    |
| ------------- | --------------------------------------- | ----------- |
| Project Title | Title of the FYP                        | ✅ Yes      |
| Project Scope | Detailed description of the project     | ✅ Yes      |
| Short_Title   | Short identifier (e.g., F24-001-AI-Bot) | ❌ Optional |

### Sample Data Format:

```
Project Title: AI-Powered Cricket Coaching System
Project Scope: Development of an advanced application that uses artificial intelligence to provide personalized cricket coaching and performance analysis. The project focuses on delivering real-time feedback on player techniques through video analysis and performance metrics...
Short_Title: F24-002-Cricket-AI
```

## 📁 Output Files

The system generates two main Excel files:

### 1. Domain Categorization (`fyp_domain_categorization.xlsx`)

- **Main Sheet**: All projects with their assigned domains
- **Domain-specific Sheets**: Projects grouped by each domain
- **Columns**:
  - `project_id`: Unique identifier
  - `project_title`: Full project title
  - `domains`: List of assigned domains
  - `primary_domain`: Main domain category
  - `confidence_scores`: Scoring details

### 2. Similarity Analysis (`fyp_similarity_analysis.xlsx`)

- **Main Sheet**: All similar project pairs
- **Similarity Level Sheets**: Grouped by Very High, High, Medium, Low similarity
- **Columns**:
  - `project_1_id`, `project_2_id`: Project identifiers
  - `similarity_score`: Numerical similarity (0-1)
  - `similarity_level`: Classification level
  - `overlapping_domains`: Common domains
  - `explanation`: Why projects are similar

## 🔧 Configuration

### API Keys (Optional)

For enhanced analysis, you can provide API keys:

- **Gemini API**: For advanced text understanding ([Get API Key](https://makersuite.google.com/app/apikey))
- **HuggingFace API**: For enhanced NLP processing

Set as environment variables or enter in the web interface:

```bash
export GEMINI_API_KEY="your_gemini_api_key"
export HUGGINGFACE_API_KEY="your_hf_api_key"
```

### Analysis Settings

You can customize the analysis by modifying `config.py`:

```python
# Similarity threshold (0.1 - 0.9)
SIMILARITY_THRESHOLD = 0.3

# TF-IDF parameters
MAX_FEATURES_TFIDF = 1000
NGRAM_RANGE = (1, 2)
```

## 🎯 Domain Categories

The system recognizes 15+ domain categories:

- **Artificial Intelligence & Machine Learning**
- **Web Development**
- **Mobile Development**
- **Cybersecurity**
- **Data Science & Analytics**
- **Internet of Things (IoT)**
- **Blockchain & Cryptocurrency**
- **Game Development**
- **Healthcare & Medical**
- **E-commerce & Business**
- **Education & E-learning**
- **Social Media & Communication**
- **Cloud Computing**
- **Computer Vision**
- **Sports & Fitness**

## 📈 Similarity Analysis

The system uses advanced NLP techniques:

1. **Text Preprocessing**: Cleans and normalizes project descriptions
2. **TF-IDF Vectorization**: Converts text to numerical vectors
3. **Cosine Similarity**: Measures similarity between project vectors
4. **Domain Overlap**: Considers shared technical domains
5. **Explanation Generation**: Creates human-readable explanations

### Similarity Levels:

- **Very High (>0.7)**: Nearly identical projects
- **High (0.5-0.7)**: Very similar with some differences
- **Medium (0.3-0.5)**: Similar concepts, different approaches
- **Low (0.3-0.4)**: Some conceptual overlap

## 🛠️ Technical Details

### Dependencies:

- **pandas**: Data manipulation and analysis
- **scikit-learn**: Machine learning algorithms
- **streamlit**: Web application framework
- **openpyxl**: Excel file handling
- **google-generativeai**: Gemini AI integration
- **matplotlib/seaborn**: Data visualization

### Algorithm:

1. Load and preprocess Excel data
2. Extract and clean text from project descriptions
3. Apply AI-powered or keyword-based domain categorization
4. Generate TF-IDF vectors for similarity analysis
5. Calculate cosine similarity between all project pairs
6. Filter results by similarity threshold
7. Generate explanations and export to Excel

## 📋 Example Usage

### Web Interface:

1. Visit the [deployed app](https://project-analysis-system.vercel.app)
2. Upload Excel file
3. Optional: Configure Gemini API key for AI analysis
4. Click "Analyze FYP Data"
5. Download results

### Programmatic Usage:

```python
from main import FYPAnalyzer

# Initialize analyzer
analyzer = FYPAnalyzer(gemini_api_key="your_api_key")  # Optional

# Run analysis
analyzer.analyze_fyp_data("your_fyp_data.xlsx", output_dir="results")
```

## 🔍 Example Output

### Domain Categorization Result:

```json
{
  "project_id": "F24-001-ProbeXpert",
  "project_title": "ProbeXpert",
  "domains": ["Cybersecurity"],
  "primary_domain": "Cybersecurity",
  "confidence_scores": {
    "Cybersecurity": {
      "score": 8,
      "reasoning": "Project focuses on vulnerability assessment and security testing",
      "method": "gemini_ai"
    }
  }
}
```

### Similarity Analysis Result:

```json
{
  "project_1_id": "F24-001-ProbeXpert",
  "project_2_id": "F24-015-SecureNet",
  "similarity_score": 0.742,
  "similarity_level": "Very High",
  "overlapping_domains": ["Cybersecurity"],
  "explanation": "Both projects belong to Cybersecurity domain(s). Share common concepts: security, vulnerability, assessment. Very similar project objectives and methodologies."
}
```

## 🚀 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/MARafey/Project-Analysis-System/issues) page
2. Create a new issue with a detailed description
3. Review the documentation above
4. Ensure your Excel file has the required columns

## 🔮 Future Enhancements

- [ ] Support for PDF project reports
- [ ] Advanced ML-based domain classification
- [ ] Integration with university project databases
- [ ] Real-time collaboration features
- [ ] Advanced visualization dashboards
- [ ] Multi-language support
- [ ] Bulk processing capabilities
- [ ] API endpoints for integration

---

**Made with ❤️ for better FYP management and analysis**

Visit the live demo: **[https://project-analysis-system.vercel.app](https://project-analysis-system.vercel.app)**
