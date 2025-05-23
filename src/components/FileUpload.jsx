import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';

const FileUpload = ({ onFileSelect, isLoading, error }) => {
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      console.error('Rejected files:', rejectedFiles);
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false,
    disabled: isLoading
  });

  const getDropzoneClasses = () => {
    let classes = 'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ';
    
    if (isLoading) {
      classes += 'border-gray-300 bg-gray-50 cursor-not-allowed ';
    } else if (isDragReject) {
      classes += 'border-red-300 bg-red-50 ';
    } else if (isDragActive) {
      classes += 'border-primary-500 bg-primary-50 ';
    } else {
      classes += 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 ';
    }
    
    return classes;
  };

  return (
    <div className="w-full">
      <div {...getRootProps()} className={getDropzoneClasses()}>
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="p-3 bg-primary-100 rounded-full">
              {isDragReject ? (
                <AlertCircle className="w-8 h-8 text-red-500" />
              ) : (
                <Upload className="w-8 h-8 text-primary-600" />
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">
              {isLoading ? 'Processing...' : 'Upload FYP Data File'}
            </h3>
            
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : isDragReject ? (
              <p className="text-sm text-red-600">
                Please upload a valid Excel file (.xlsx, .xls) or CSV file
              </p>
            ) : isDragActive ? (
              <p className="text-sm text-primary-600">Drop the file here...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Drag and drop your Excel file here, or click to select
                </p>
                <p className="text-xs text-gray-500">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </div>
            )}
          </div>
          
          {!isLoading && (
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel/CSV</span>
              </div>
              <span>•</span>
              <span>Max 10MB</span>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 