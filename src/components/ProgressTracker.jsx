import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const ProgressTracker = ({ 
  currentStep, 
  totalSteps, 
  currentProject, 
  totalProjects, 
  status, 
  error 
}) => {
  const steps = [
    { id: 1, name: 'Loading Data', description: 'Reading Excel file' },
    { id: 2, name: 'Domain Categorization', description: 'Analyzing project domains' },
    { id: 3, name: 'Similarity Analysis', description: 'Calculating project similarities' },
    { id: 4, name: 'Generating Reports', description: 'Creating Excel outputs' }
  ];

  const getStepStatus = (stepId) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const getStepIcon = (stepId) => {
    const stepStatus = getStepStatus(stepId);
    
    if (stepStatus === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (stepStatus === 'current') {
      return <div className="loading-spinner"></div>;
    } else {
      return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getProgressPercentage = () => {
    if (currentStep === 2 && totalProjects > 0) {
      // During categorization, show progress based on projects processed
      const projectProgress = (currentProject / totalProjects) * 100;
      const stepProgress = ((currentStep - 1) / totalSteps) * 100;
      return stepProgress + (projectProgress / totalSteps);
    }
    return (currentStep / totalSteps) * 100;
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Analysis Progress</h3>
        <span className="text-sm font-medium text-primary-600">
          {Math.round(getProgressPercentage())}% Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${getProgressPercentage()}%` }}
        ></div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const stepStatus = getStepStatus(step.id);
          
          return (
            <div key={step.id} className="flex items-center space-x-3">
              {getStepIcon(step.id)}
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-medium ${
                    stepStatus === 'completed' ? 'text-green-700' :
                    stepStatus === 'current' ? 'text-primary-700' :
                    'text-gray-500'
                  }`}>
                    {step.name}
                  </h4>
                  
                  {stepStatus === 'completed' && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ Done
                    </span>
                  )}
                </div>
                
                <p className={`text-xs ${
                  stepStatus === 'current' ? 'text-primary-600' : 'text-gray-500'
                }`}>
                  {step.description}
                </p>
                
                {/* Show project progress during categorization */}
                {step.id === 2 && stepStatus === 'current' && totalProjects > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-primary-600">
                      <span>Processing projects...</span>
                      <span>{currentProject} / {totalProjects}</span>
                    </div>
                    <div className="w-full bg-primary-100 rounded-full h-1 mt-1">
                      <div 
                        className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(currentProject / totalProjects) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      {status && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
          <p className="text-sm text-primary-700">{status}</p>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker; 