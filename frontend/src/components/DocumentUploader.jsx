import { useState } from 'react';
import api from '../services/api';

const DocumentUploader = ({ caseId, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('REPORT');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);
    if (caseId) {
      formData.append('case_id', caseId);
    }

    try {
      await api.post('/default/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Upload successful');
      setFile(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border p-4 rounded bg-white">
      <h3 className="font-bold mb-3">Upload Document</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Document Type</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="border p-2 rounded w-full"
          >
            <option value="REPORT">Report</option>
            <option value="PRESCRIPTION">Prescription</option>
            <option value="POLICY">Policy</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Choose File</label>
          <input 
            type="file" 
            onChange={(e) => setFile(e.target.files[0])} 
            className="border p-2 rounded w-full"
          />
        </div>
        {caseId && (
          <div className="text-sm text-gray-600">
            This document will be attached to Case #{caseId}
          </div>
        )}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button 
          onClick={handleUpload} 
          disabled={uploading} 
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </div>
  );
};

export default DocumentUploader;