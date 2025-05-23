@echo off
echo Starting FYP Analysis System Web Interface...
echo.
echo Installing required packages (if needed)...
pip install -r requirements.txt
echo.
echo Starting web application...
echo The app will open in your browser at http://localhost:8501
echo.
echo Press Ctrl+C to stop the application
echo.
streamlit run web_app.py
pause 