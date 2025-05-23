import pandas as pd
import numpy as np

def examine_excel_files():
    """Examine the structure of Excel files in the workspace"""
    
    print("=== Examining FYP Projects.xlsx ===")
    try:
        df = pd.read_excel('FYP Projects.xlsx')
        print(f"Columns: {df.columns.tolist()}")
        print(f"Total rows: {len(df)}")
        print(f"Shape: {df.shape}")
        print("\nFirst few rows:")
        print(df.head(3).to_string())
        
        # Check for missing values in key columns
        print(f"\nMissing values in Project Title: {df['Project Title'].isna().sum()}")
        print(f"Missing values in Project Scope: {df['Project Scope'].isna().sum()}")
        
        # Show sample project scopes
        print(f"\nSample Project Scopes:")
        for i, scope in enumerate(df['Project Scope'].dropna().head(3)):
            print(f"{i+1}. {scope[:200]}...")
            
    except Exception as e:
        print(f"Error reading FYP Projects.xlsx: {e}")
    
    print("\n" + "="*60)
    print("=== Examining MasterList Fall 2024.xlsx ===")
    try:
        df2 = pd.read_excel('MasterList Fall 2024.xlsx')
        print(f"Columns: {df2.columns.tolist()}")
        print(f"Total rows: {len(df2)}")
        print(f"Shape: {df2.shape}")
        print("\nFirst few rows:")
        print(df2.head(2).to_string())
        
    except Exception as e:
        print(f"Error reading MasterList Fall 2024.xlsx: {e}")

if __name__ == "__main__":
    examine_excel_files() 