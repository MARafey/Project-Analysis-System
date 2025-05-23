"""
Configuration file for FYP Analysis System
"""

import os
from typing import Optional

class Config:
    """Configuration class for FYP Analysis System"""
    
    # API Keys (can be set via environment variables)
    GEMINI_API_KEY: Optional[str] = os.getenv('GEMINI_API_KEY')
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv('HUGGINGFACE_API_KEY')
    
    # Analysis Settings
    SIMILARITY_THRESHOLD: float = 0.3
    MIN_SIMILARITY_SCORE: float = 0.3
    MAX_FEATURES_TFIDF: int = 1000
    
    # Output Settings
    OUTPUT_DIRECTORY: str = "output"
    DOMAIN_FILE_NAME: str = "fyp_domain_categorization.xlsx"
    SIMILARITY_FILE_NAME: str = "fyp_similarity_analysis.xlsx"
    
    # Text Processing Settings
    STOP_WORDS: str = 'english'
    NGRAM_RANGE: tuple = (1, 2)
    MIN_DF: int = 1
    MAX_DF: float = 0.95
    
    @classmethod
    def set_gemini_api_key(cls, api_key: str):
        """Set Gemini API key"""
        cls.GEMINI_API_KEY = api_key
    
    @classmethod
    def set_huggingface_api_key(cls, api_key: str):
        """Set HuggingFace API key"""
        cls.HUGGINGFACE_API_KEY = api_key
    
    @classmethod
    def get_config_summary(cls) -> dict:
        """Get configuration summary"""
        return {
            'similarity_threshold': cls.SIMILARITY_THRESHOLD,
            'output_directory': cls.OUTPUT_DIRECTORY,
            'tfidf_max_features': cls.MAX_FEATURES_TFIDF,
            'gemini_api_configured': bool(cls.GEMINI_API_KEY),
            'huggingface_api_configured': bool(cls.HUGGINGFACE_API_KEY)
        } 