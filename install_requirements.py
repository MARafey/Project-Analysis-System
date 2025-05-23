import subprocess
import sys

def install_package(package):
    """Install a package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✓ Successfully installed {package}")
    except subprocess.CalledProcessError:
        print(f"✗ Failed to install {package}")

packages = [
    "pandas",
    "openpyxl", 
    "transformers",
    "torch",
    "scikit-learn",
    "google-generativeai",
    "sentence-transformers",
    "numpy",
    "matplotlib",
    "seaborn"
]

print("Installing required packages...")
for package in packages:
    install_package(package)

print("\nInstallation complete!") 