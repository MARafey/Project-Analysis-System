# 🎓 FYP Analysis System

A comprehensive React-based application for analyzing Final Year Projects (FYPs), featuring domain categorization, similarity analysis, and AI-powered insights.

## ✨ Features

### 🔍 Core Analysis

- **Domain Categorization**: Automatically categorize projects across 15+ technical domains
- **Similarity Detection**: Advanced TF-IDF analysis to find similar projects
- **AI Enhancement**: Optional Gemini AI integration for intelligent categorization
- **Multi-format Support**: Supports Excel (.xlsx, .xls) and CSV files

### 📊 Analysis Domains

- Artificial Intelligence & Machine Learning
- Web Development
- Mobile Development
- Cybersecurity
- Data Science & Analytics
- Internet of Things (IoT)
- Blockchain & Cryptocurrency
- Game Development
- Healthcare & Medical
- E-commerce & Business
- Education & E-learning
- Social Media & Communication
- Cloud Computing
- Computer Vision
- Sports & Fitness

### 📋 Reporting

- **Multi-sheet Excel Reports**: Organized by domains and similarity levels
- **Detailed Analysis**: Explanations for categorization and similarity findings
- **Interactive Dashboard**: Real-time results with filtering capabilities
- **Download Options**: Domain reports, similarity reports, and combined analysis

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone or Download the Project**

   ```bash
   cd "FYP Automation"
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Start Development Server**

   ```bash
   npm start
   ```

4. **Access the Application**
   - Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## 🔍 Enhanced Similarity Analysis FeaturesThe system now provides **detailed, specific reasons** for why two FYPs are considered similar, including:### 🎯 Multi-Layer Analysis- **Technology Stack Detection**: Identifies shared programming languages, frameworks, and tools- **Feature Overlap Analysis**: Finds common functional requirements and capabilities - **Methodology Matching**: Detects similar development approaches and research methods- **Domain Targeting**: Identifies shared application areas and industries- **Goal Alignment**: Recognizes common project objectives and outcomes- **Textual Similarity**: Analyzes significant terminology and concept overlap### 📋 Comprehensive Reporting- **Structured Explanations**: Each similarity includes specific reasons with ✓ indicators- **Detailed Interpretations**: Actionable insights and recommendations for each pair- **Enhanced Excel Reports**: Multi-column breakdown with specific reasons, interpretations, and full explanations- **Interactive UI**: Preview of key reasons directly in the web interface### 🎚️ Similarity Levels with Context- **Very High (>70%)**: Nearly identical approaches - consider collaboration or review for duplication- **High (50-70%)**: Significant overlap - opportunities for cross-referencing methodologies- **Medium (30-50%)**: Some common elements - potential for knowledge sharing- **Low (<30%)**: Basic conceptual similarities - largely distinct approaches## 📚 How to Use

### 1. Upload Data

- Click on the upload area or drag & drop your Excel file
- Supported formats: `.xlsx`, `.xls`, `.csv`
- Required columns: Project Title, Project Scope/Description

### 2. Configure AI (Optional)

- Click "Settings" in the header
- Enter your Gemini API key for enhanced analysis
- Get your free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 3. Start Analysis

- Review loaded project count
- Click "Start Analysis"
- Monitor real-time progress

### 4. Download Reports

- View results in the interactive dashboard
- Download individual reports (Domains, Similarity)
- Get complete combined analysis report

## 🛠 Technical Architecture

### Frontend Stack

- **React 18**: Modern React with hooks and functional components
- **Custom CSS**: Responsive design without framework dependencies
- **Browser-only**: Runs entirely client-side

### Text Processing

- **Custom TF-IDF Implementation**: Browser-compatible vectorization
- **N-gram Analysis**: Unigram and bigram text processing
- **Stopword Removal**: Enhanced text cleaning
- **Cosine Similarity**: Mathematical similarity computation

### AI Integration

- **Google Generative AI**: Gemini API for intelligent categorization
- **Fallback System**: Keyword-based categorization when AI unavailable
- **Batch Processing**: Efficient handling of multiple projects

### File Processing

- **XLSX Library**: Client-side Excel file reading/writing
- **Multi-sheet Export**: Organized data output
- **File Validation**: Format and structure checking

## 📊 Sample Data

The system includes a sample data generator. Click "Sample Data" to download a test Excel file with:

- AI-Powered Chatbot project
- E-commerce with Recommendation System
- Smart Home IoT Security System
- VR Educational Game
- Blockchain Voting System

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### File Structure

```
src/
├── components/          # React components (future expansion)
├── utils/
│   ├── textProcessing.js   # TF-IDF and NLP functions
│   ├── excelUtils.js       # File processing utilities
│   └── geminiApi.js        # AI integration
├── App.js              # Main application component
├── index.js            # React entry point
└── index.css           # Application styles
```

## 🚀 Deployment

### Static Hosting (Recommended)

**Vercel** (Recommended):

1. Build the project: `npm run build`
2. Deploy to Vercel: `npx vercel --prod`

**Netlify**:

1. Build the project: `npm run build`
2. Drag the `build` folder to Netlify

**GitHub Pages**:

1. Install gh-pages: `npm install --save-dev gh-pages`
2. Add to package.json: `"homepage": "https://yourusername.github.io/fyp-analysis"`
3. Deploy: `npm run deploy`

### Custom Server

The `build` folder contains static files that can be served by any web server:

- Apache
- Nginx
- Express.js
- Python HTTP server

## 📈 Analysis Methodology

### Domain Categorization

1. **Keyword Matching**: Pattern-based categorization using curated domain keywords
2. **AI Enhancement**: Gemini AI provides context-aware categorization with confidence scores
3. **Multi-domain Support**: Projects can belong to multiple domains
4. **Confidence Scoring**: Numerical confidence for categorization decisions

### Enhanced Similarity Analysis1. **Text Preprocessing**: Tokenization, stopword removal, normalization2. **TF-IDF Vectorization**: Convert text to numerical vectors3. **Cosine Similarity**: Calculate similarity scores between project pairs4. **Detailed Reason Analysis**: Multi-layer similarity detection including: - **Technology Stack**: Shared programming languages, frameworks, and tools - **Feature Overlap**: Common functional requirements and capabilities - **Methodology**: Similar development approaches and research methods - **Application Domain**: Target industries and use cases - **Project Goals**: Shared objectives and outcomes - **Textual Overlap**: Significant common terminology and concepts5. **Comprehensive Explanations**: Each similarity pair includes: - Specific reasons with checkmark indicators (✓) - Detailed interpretation and recommendations - Actionable insights for project coordination6. **Level Classification**: Very High (>70%), High (50-70%), Medium (30-50%), Low (<30%)

## 🔍 Troubleshooting

### Common Issues

**Build Errors**:

- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check Node.js version: `node --version` (should be v14+)

**File Upload Issues**:

- Ensure file has proper headers (Project Title, Project Scope)
- Check file format (.xlsx, .xls, .csv only)
- Verify file size (< 10MB recommended)

**AI Integration Issues**:

- Verify Gemini API key is correct
- Check internet connection
- Monitor browser console for error messages

### Performance Tips

- For large datasets (>100 projects), allow extra processing time
- Use AI enhancement sparingly for faster processing
- Close other browser tabs during analysis for optimal performance

## 🤝 Contributing

This is an academic project for FYP analysis. Contributions and improvements are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is for educational and research purposes. Please ensure compliance with your institution's guidelines when using for academic work.

## 🆘 Support

For technical support or questions:

- Check the troubleshooting section above
- Review browser console for error messages
- Ensure all dependencies are properly installed

## 🔮 Future Enhancements

- **Advanced Visualizations**: Charts and graphs for domain distribution
- **Export Formats**: PDF and JSON export options
- **Batch Processing**: Multiple file analysis
- **Custom Domains**: User-defined categorization domains
- **Collaboration Features**: Shared analysis and comments
- **API Integration**: Connect with institutional databases

---

**Built with ❤️ for academic excellence and research innovation**

🌐 **Live Demo**: [https://project-analysis-system.vercel.app](https://project-analysis-system.vercel.app)

⭐ **GitHub**: [https://github.com/MARafey/Project-Analysis-System](https://github.com/MARafey/Project-Analysis-System)
