import pandas as pd

# Create sample FYP data
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
        'Project Title': 'Blockchain-based Voting System',
        'Project Scope': 'Secure electronic voting system using blockchain technology to ensure transparency and prevent fraud. Implements smart contracts for vote counting and verification.',
        'Short_Title': 'F24-005-Blockchain-Vote'
    },
    {
        'Project Title': 'Mobile Health Monitoring App',
        'Project Scope': 'Cross-platform mobile application for health monitoring using wearable devices. Tracks vital signs, provides health insights, and connects with healthcare providers.',
        'Short_Title': 'F24-006-Health-App'
    },
    {
        'Project Title': 'Cybersecurity Vulnerability Scanner',
        'Project Scope': 'Automated security scanning tool that identifies vulnerabilities in web applications and networks. Provides detailed reports and remediation suggestions.',
        'Short_Title': 'F24-007-Vuln-Scanner'
    },
    {
        'Project Title': 'Data Analytics Dashboard for Business Intelligence',
        'Project Scope': 'Interactive dashboard for business data visualization and analytics. Integrates multiple data sources and provides real-time insights for decision making.',
        'Short_Title': 'F24-008-BI-Dashboard'
    }
]

df = pd.DataFrame(sample_projects)
df.to_excel('sample_fyp_data.xlsx', index=False)
print("✅ Sample data created successfully: sample_fyp_data.xlsx")
print(f"📊 Created {len(sample_projects)} sample projects")
print("🚀 You can now test the FYP Analysis System with this data!") 