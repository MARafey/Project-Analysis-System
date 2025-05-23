import React, { useState } from 'react';
import { Download, Eye, BarChart3, FileText, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ResultsDisplay = ({ 
  domainResults, 
  similarityResults, 
  onDownloadDomains, 
  onDownloadSimilarity, 
  onDownloadCombined 
}) => {
  const [activeTab, setActiveTab] = useState('domains');
  const [domainFilter, setDomainFilter] = useState('');
  const [similarityFilter, setSimilarityFilter] = useState('all');

  // Prepare data for domain chart
  const getDomainChartData = () => {
    const domainCounts = {};
    domainResults.forEach(project => {
      const domains = Array.isArray(project.domains) ? project.domains : [project.domains];
      domains.forEach(domain => {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
    });

    return Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 domains
  };

  // Prepare data for similarity level chart
  const getSimilarityChartData = () => {
    const levelCounts = { 'Very High': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
    similarityResults.forEach(pair => {
      if (levelCounts.hasOwnProperty(pair.similarityLevel)) {
        levelCounts[pair.similarityLevel]++;
      }
    });

    return Object.entries(levelCounts).map(([level, count]) => ({ level, count }));
  };

  // Filter domain results
  const getFilteredDomainResults = () => {
    return domainResults.filter(project => 
      !domainFilter || 
      project.projectTitle.toLowerCase().includes(domainFilter.toLowerCase()) ||
      project.projectId.toLowerCase().includes(domainFilter.toLowerCase()) ||
      (Array.isArray(project.domains) ? project.domains : [project.domains])
        .some(domain => domain.toLowerCase().includes(domainFilter.toLowerCase()))
    );
  };

  // Filter similarity results
  const getFilteredSimilarityResults = () => {
    return similarityResults.filter(pair => 
      similarityFilter === 'all' || pair.similarityLevel === similarityFilter
    );
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'];

  const TabButton = ({ id, label, icon: Icon, active }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        active 
          ? 'bg-primary-600 text-white' 
          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{domainResults.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unique Domains</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(domainResults.flatMap(p => Array.isArray(p.domains) ? p.domains : [p.domains])).size}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Eye className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Similar Pairs</p>
              <p className="text-2xl font-bold text-gray-900">{similarityResults.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download Actions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={onDownloadDomains}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Domain Report</span>
          </button>
          
          <button 
            onClick={onDownloadSimilarity}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Similarity Report</span>
          </button>
          
          <button 
            onClick={onDownloadCombined}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Complete Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-3">
        <TabButton 
          id="domains" 
          label="Domain Analysis" 
          icon={BarChart3} 
          active={activeTab === 'domains'} 
        />
        <TabButton 
          id="similarity" 
          label="Similarity Analysis" 
          icon={Eye} 
          active={activeTab === 'similarity'} 
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* Domain Chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Project Distribution by Domain</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getDomainChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="domain" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Domain Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Domain Categorization Results</h3>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Filter projects..."
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Domain</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">All Domains</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredDomainResults().map((project, index) => {
                    const domains = Array.isArray(project.domains) ? project.domains : [project.domains];
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.projectId}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={project.projectTitle}>
                          {project.projectTitle}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{project.primaryDomain}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex flex-wrap gap-1">
                            {domains.map((domain, idx) => (
                              <span 
                                key={idx}
                                className="inline-block px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full"
                              >
                                {domain}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            project.categorizationMethod === 'gemini_ai' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {project.categorizationMethod === 'gemini_ai' ? 'AI' : 'Keywords'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'similarity' && (
        <div className="space-y-6">
          {/* Similarity Chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Similarity Level Distribution</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={getSimilarityChartData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    labelLine={false}
                    label={({ level, count }) => `${level}: ${count}`}
                  >
                    {getSimilarityChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={getSimilarityChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Similarity Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Similarity Analysis Results</h3>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={similarityFilter}
                    onChange={(e) => setSimilarityFilter(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="Very High">Very High</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project 2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overlapping Domains</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredSimilarityResults().map((pair, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{pair.project1Id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{pair.project2Id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{pair.similarityScore.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          pair.similarityLevel === 'Very High' ? 'bg-red-100 text-red-700' :
                          pair.similarityLevel === 'High' ? 'bg-orange-100 text-orange-700' :
                          pair.similarityLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {pair.similarityLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {pair.overlappingDomains.join(', ') || 'None'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs" title={pair.explanation}>
                        {pair.explanation.length > 100 
                          ? `${pair.explanation.substring(0, 100)}...` 
                          : pair.explanation
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay; 