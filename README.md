# 🎓 FYP Analysis & Panel Creation System

A comprehensive React-based application featuring **two powerful systems in one platform**:

1. **FYP Analysis System** - Domain categorization, similarity analysis, and AI-powered insights
2. **Panel Creation System** - Constraint-based evaluation panel allocation with instructor-project management

## ✨ Features

### 🔍 FYP Analysis System

- **Domain Categorization**: Automatically categorize projects across 15+ technical domains
- **Similarity Detection**: Advanced TF-IDF analysis to find similar projects
- **AI Enhancement**: Optional Gemini AI integration for intelligent categorization
- **Multi-format Support**: Supports Excel (.xlsx, .xls) and CSV files

### 🏛️ Panel Creation System

- **Constraint-Based Allocation**: Hard and soft constraint management for panel creation
- **Text File Input**: Simple instructor-project mapping format
- **Overlap Detection**: Automatic detection of overlapping projects and supervisors
- **Optimized Assignment**: Intelligent instructor assignment based on project count
- **Multi-sheet Reports**: Comprehensive Excel output with allocation details

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

- **Multi-sheet Excel Reports**: Organized by domains, similarity levels, and panel allocations
- **Detailed Analysis**: Explanations for categorization, similarity findings, and allocation decisions
- **Interactive Dashboard**: Real-time results with filtering capabilities
- **Download Options**: Domain reports, similarity reports, panel allocation reports, and combined analysis

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone or Download the Project**

   ```bash
   cd "Project-Analysis-System"
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

## 🎯 How to Use

### 📊 FYP Analysis System

#### 1. Upload Data

- Click on the upload area or drag & drop your Excel file
- Supported formats: `.xlsx`, `.xls`, `.csv`
- Required columns: Project Title, Project Scope/Description

#### 2. Configure AI (Optional)

- Click "Settings" in the header
- Enter your Gemini API key for enhanced analysis
- Get your free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

#### 3. Start Analysis

- Review loaded project count
- Click "Start Analysis"
- Monitor real-time progress

#### 4. Download Reports

- View results in the interactive dashboard
- Download individual reports (Domains, Similarity)
- Get complete combined analysis report

### 🏛️ Panel Creation System

#### 1. Navigate to Panel Creation

- Scroll down to the "Panel Creation System" section
- Click "Start Panel Creation" to expand the interface

#### 2. Prepare Your Data

- **Format**: Text file with instructor-project mappings
- **Syntax**: `Instructor Name: Project1, Project2, Project3`
- **Example**:
  ```
  Dr. John Smith: Web Security Platform, Data Analytics Dashboard
  Prof. Jane Doe: Machine Learning System, IoT Sensor Network
  Ms. Alice Wilson: Blockchain Voting System
  ```

#### 3. Upload and Configure

- Upload your text file
- Set constraints:
  - **Hard Constraints**: Number of panels, max instructors per panel
  - **Soft Constraints**: Desired groups per panel (can be exceeded if necessary)
- Click "Generate Panel Allocation"

#### 4. Download Results

- Review allocation summary
- Download comprehensive Excel report with multiple sheets:
  - Panel Allocation
  - Instructor Assignments
  - Summary
  - Detailed Groups
  - Allocation Log

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

### Panel Allocation Algorithm

- **Constraint Management**: Hard vs. soft constraint handling
- **Group Formation**: Automatic detection of overlapping projects
- **Load Balancing**: Optimized distribution across panels
- **Instructor Assignment**: Smart assignment based on project supervision count

### AI Integration

- **Google Generative AI**: Gemini API for intelligent categorization
- **Fallback System**: Keyword-based categorization when AI unavailable
- **Batch Processing**: Efficient handling of multiple projects

### File Processing

- **XLSX Library**: Client-side Excel file reading/writing
- **Text File Parser**: Custom parser for instructor-project mappings
- **Multi-sheet Export**: Organized data output
- **File Validation**: Format and structure checking

## 📊 Sample Data

### FYP Analysis

The system includes a sample data generator. Click "Sample Data" to download a test Excel file with:

- AI-Powered Chatbot project
- E-commerce with Recommendation System
- Smart Home IoT Security System
- VR Educational Game
- Blockchain Voting System

### Panel Creation

Download sample text files for panel creation:

- **Sample File**: Contains example instructor-project mappings
- **Template**: Clean template for your own data

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### File Structure

```
src/
├── components/
│   ├── FileUpload.jsx           # File upload component
│   ├── ProgressTracker.jsx      # Analysis progress tracking
│   ├── ResultsDisplay.jsx       # Results display
│   ├── PanelAllocation.jsx      # Original panel allocation
│   └── ConstraintBasedPanelAllocation.jsx  # New constraint-based system
├── utils/
│   ├── textProcessing.js        # TF-IDF and NLP functions
│   ├── excelUtils.js            # File processing utilities
│   ├── geminiApi.js             # AI integration
│   ├── panelAllocation.js       # Original allocation algorithm
│   ├── constraintBasedPanelAllocation.js  # New constraint algorithm
│   └── textFileParser.js        # Text file parsing utilities
├── App.js                       # Main application component
├── index.js                     # React entry point
└── index.css                    # Application styles
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
2. Add to package.json: `"homepage": "https://yourusername.github.io/project-analysis-system"`
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

### Enhanced Similarity Analysis

1. **Text Preprocessing**: Tokenization, stopword removal, normalization
2. **TF-IDF Vectorization**: Convert text to numerical vectors
3. **Cosine Similarity**: Calculate similarity scores between project pairs
4. **Detailed Reason Analysis**: Multi-layer similarity detection including:
   - **Technology Stack**: Shared programming languages, frameworks, and tools
   - **Feature Overlap**: Common functional requirements and capabilities
   - **Methodology**: Similar development approaches and research methods
   - **Application Domain**: Target industries and use cases
   - **Project Goals**: Shared objectives and outcomes
   - **Textual Overlap**: Significant common terminology and concepts
5. **Comprehensive Explanations**: Each similarity pair includes:
   - Specific reasons with checkmark indicators (✓)
   - Detailed interpretation and recommendations
   - Actionable insights for project coordination
6. **Level Classification**: Very High (>70%), High (50-70%), Medium (30-50%), Low (<30%)

### Panel Allocation Algorithm

1. **Data Parsing**: Parse instructor-project mappings from text files
2. **Group Formation**: Identify overlapping projects and form groups
3. **Constraint Validation**: Check hard constraints (panels, instructors per panel)
4. **Allocation Strategy**: Prioritize overlapping groups, then individual groups
5. **Instructor Assignment**: Assign instructors to panels based on project supervision count
6. **Load Balancing**: Distribute groups evenly while respecting constraints

## 🔍 Troubleshooting

### Common Issues

**Build Errors**:

- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check Node.js version: `node --version` (should be v14+)

**File Upload Issues**:

- **FYP Analysis**: Ensure file has proper headers (Project Title, Project Scope)
- **Panel Creation**: Use correct text format: `Instructor: Project1, Project2`
- Check file format (.xlsx, .xls, .csv for FYP; .txt for panels)
- Verify file size (< 10MB recommended)

**Panel Creation Format Issues**:

- **Error**: "instructor names without projects"
- **Solution**: Use the format helper to download template or convert your list
- **Quick Fix**: Add placeholder projects like "Project 1A, Project 1B"

**AI Integration Issues**:

- Verify Gemini API key is correct
- Check internet connection
- Monitor browser console for error messages

### Performance Tips

- For large datasets (>100 projects), allow extra processing time
- Use AI enhancement sparingly for faster processing
- Close other browser tabs during analysis for optimal performance
- Panel creation works best with <50 instructors for optimal constraint satisfaction

## 🤝 Contributing

This is an academic project for FYP analysis and panel creation. Contributions and improvements are welcome:

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
- For panel creation issues, use the built-in format helper

## 🔮 Future Enhancements

- **Advanced Visualizations**: Charts and graphs for domain distribution and panel load
- **Export Formats**: PDF and JSON export options
- **Batch Processing**: Multiple file analysis
- **Custom Domains**: User-defined categorization domains
- **Collaboration Features**: Shared analysis and comments
- **API Integration**: Connect with institutional databases
- **Panel Optimization**: Machine learning-based panel allocation optimization
- **Real-time Collaboration**: Multi-user panel creation and editing

---

**Built with ❤️ for academic excellence and research innovation**

🌐 **Live Demo**: [https://project-analysis-system.vercel.app](https://project-analysis-system.vercel.app)

⭐ **GitHub**: [https://github.com/MARafey/Project-Analysis-System](https://github.com/MARafey/Project-Analysis-System)
