# 🎓 FYP Analysis System

A comprehensive React-based tool to analyze Final Year Projects (FYPs), categorize them by domains, and identify similar projects based on their descriptions. Built with modern web technologies for client-side processing and easy deployment.

## 🌟 Features

- **🤖 AI-Powered Domain Categorization**: Uses Gemini AI for intelligent project categorization with reasoning
- **📊 Fallback Keyword Matching**: Automatic fallback to keyword-based categorization if AI is unavailable
- **🔍 Advanced Similarity Analysis**: Identifies similar projects and explains why they overlap using TF-IDF vectorization
- **🎯 Multiple Domain Support**: Projects can belong to multiple domains with confidence scores
- **📈 Similarity Levels**: Classifies similarity as Very High, High, Medium, or Low with detailed explanations
- **📑 Comprehensive Excel Export**: Generates organized Excel files with multiple sheets and insights
- **🌐 Modern React Interface**: Beautiful, responsive web application with real-time progress tracking
- **⚡ Client-Side Processing**: All analysis runs in your browser - no server required
- **🔑 API Integration**: Optional Gemini AI integration for enhanced categorization

## 🚀 Quick Start

### Option 1: Use Online (Recommended)

🌐 **[Try the live demo on Vercel →](https://project-analysis-system.vercel.app)**

Simply visit the deployed application and start analyzing your FYP projects immediately - no installation required!

### Option 2: Local Development

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/MARafey/Project-Analysis-System.git
   cd Project-Analysis-System
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Start Development Server**:

   ```bash
   npm start
   ```

4. **Upload Your Data**: Upload an Excel file containing FYP project data through the web interface

5. **Download Results**: Get comprehensive Excel files with domain categorization and similarity analysis

### Option 3: Build for Production

1. **Build the Application**:

   ```bash
   npm run build
   ```

2. **Deploy**: Upload the `build` folder to any static hosting service

## 🚀 Deployment

This project is configured for easy deployment on Vercel and other static hosting platforms:

### Deploy to Vercel

1. **Fork this repository**
2. **Connect to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Import your forked repository
   - Deploy automatically
3. **Optional: Configure Environment Variables**:
   - Add `REACT_APP_GEMINI_API_KEY` for AI-powered categorization

### Deploy to Netlify

1. **Build the project**: `npm run build`
2. **Upload the `build` folder** to Netlify

### Deploy to GitHub Pages

1. **Install gh-pages**: `npm install --save-dev gh-pages`
2. **Add to package.json**:
   ```json
   "homepage": "https://yourusername.github.io/Project-Analysis-System",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
3. **Deploy**: `npm run deploy`

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

The system generates comprehensive Excel files with multiple sheets:

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

Enter your API key in the application settings or set as environment variable:

```bash
REACT_APP_GEMINI_API_KEY="your_gemini_api_key"
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
2. **TF-IDF Vectorization**: Converts text to numerical vectors using JavaScript implementation
3. **Cosine Similarity**: Measures similarity between project vectors
4. **Domain Overlap**: Considers shared technical domains
5. **Explanation Generation**: Creates human-readable explanations

### Similarity Levels:

- **Very High (>0.7)**: Nearly identical projects
- **High (0.5-0.7)**: Very similar with some differences
- **Medium (0.3-0.5)**: Similar concepts, different approaches
- **Low (0.3-0.4)**: Some conceptual overlap

## 🛠️ Technical Details

### Tech Stack:

- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Data visualization
- **XLSX**: Excel file processing
- **Natural**: Natural language processing
- **Lucide React**: Modern icon library
- **React Toastify**: Notifications
- **React Dropzone**: File upload

### JavaScript Libraries for Analysis:

- **TF-IDF Implementation**: Custom vectorizer for similarity analysis
- **Stopword Removal**: Text preprocessing
- **Cosine Similarity**: Mathematical similarity calculation
- **Domain Categorization**: Keyword-based and AI-powered classification

### Algorithm:

1. Load and preprocess Excel data using XLSX library
2. Extract and clean text from project descriptions
3. Apply AI-powered or keyword-based domain categorization
4. Generate TF-IDF vectors for similarity analysis
5. Calculate cosine similarity between all project pairs
6. Filter results by similarity threshold
7. Generate explanations and export to Excel

## 📋 Example Usage

### Basic Usage:

1. Visit the [deployed app](https://project-analysis-system.vercel.app)
2. Upload Excel file with FYP data
3. Optional: Configure Gemini API key for AI analysis
4. Click "Start Analysis"
5. Download comprehensive Excel reports

### Advanced Features:

- **AI Enhancement**: Add Gemini API key for intelligent categorization
- **Real-time Progress**: Track analysis progress with detailed status
- **Interactive Results**: Filter and explore results in the web interface
- **Multiple Export Options**: Download domain-specific or combined reports

## 🔍 Example Output

### Domain Categorization Result:

```json
{
  "projectId": "F24-001-ProbeXpert",
  "projectTitle": "ProbeXpert",
  "domains": ["Cybersecurity"],
  "primaryDomain": "Cybersecurity",
  "confidenceScores": {
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
  "project1Id": "F24-001-ProbeXpert",
  "project2Id": "F24-015-SecureNet",
  "similarityScore": 0.742,
  "similarityLevel": "Very High",
  "overlappingDomains": ["Cybersecurity"],
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
- [ ] Mobile-responsive enhancements
- [ ] Offline mode support

---

**Made with ❤️ for better FYP management and analysis**

🌐 **Live Demo**: [https://project-analysis-system.vercel.app](https://project-analysis-system.vercel.app)

⭐ **GitHub**: [https://github.com/MARafey/Project-Analysis-System](https://github.com/MARafey/Project-Analysis-System)
