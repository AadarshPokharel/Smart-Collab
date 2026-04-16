import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, FolderKanban } from 'lucide-react';

const FeaturePlaceholderPage = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-sm p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <FolderKanban size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">SmartCollab</p>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
        <p className="mt-3 text-sm text-slate-500">
          This area is ready for API integration and can be expanded into a full workspace view when the feature is built.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Back to dashboard
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Open projects
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeaturePlaceholderPage;
