"""
Streamlit App Entry Point for Vercel Deployment
"""

import streamlit as st
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import and run the main web application
from web_app import main

if __name__ == "__main__":
    main() 