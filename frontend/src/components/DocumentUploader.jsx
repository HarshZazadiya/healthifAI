import { useState } from 'react';
import api from '../services/api';
import { Upload, FileText, X } from 'lucide-react';

const DocumentUploader = ({ caseId, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    if (!type.trim()) {
      setError('Please provide a document type');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('document', file);

    try {
      await api.post('/default/documents', formData, {
        params: { type, case_id: caseId || undefined },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('Document uploaded successfully!');
      setFile(null);
      setType('');
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Upload size={20} /></div>
        <h3 className="font-bold text-slate-800 text-lg">Upload New Document</h3>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Document Name (e.g. X-Ray, Blood Report)</label>
          <input
            type="text"
            placeholder="Enter document name"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select File</label>
          <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              required
            />
            {file ? (
              <div className="flex flex-col items-center gap-2 text-emerald-600">
                <FileText size={32} />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Upload size={32} className="text-blue-500" />
                <span className="font-medium text-slate-700">Click to browse or drag and drop</span>
                <span className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB</span>
              </div>
            )}
          </div>
        </div>

        {caseId && (
          <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm font-medium flex items-center gap-2 border border-amber-200">
            <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">Info</span>
            This document will be automatically attached to Case #{caseId}
          </div>
        )}

        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm border border-rose-200">{error}</div>}
        {success && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg text-sm border border-emerald-200">{success}</div>}

        <button
          type="submit"
          disabled={uploading}
          className={`w-full text-white font-bold py-3 rounded-xl shadow-sm transition-all flex justify-center items-center gap-2 ${uploading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:shadow-md'}`}
        >
          {uploading ? (
            <><span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> Uploading...</>
          ) : (
            <><Upload size={18} /> Upload Document</>
          )}
        </button>
      </form>
    </div>
  );
};

export default DocumentUploader;