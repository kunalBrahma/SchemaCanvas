'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectName = async (projectId: string) => {
    if (!editingName.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update project');

      toast.success('Project renamed');
      setEditingId(null);
      fetchProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    } finally {
      setUpdating(false);
    }
  };

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleQuickStart = () => {
    router.push('/editor');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          schema: { tables: [], relations: [] }
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const project = await response.json();
      toast.success('Project created!');
      router.push(`/editor?projectId=${project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleLoadProject = (projectId: string) => {
    router.push(`/editor?projectId=${projectId}`);
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    // Optimistic update: remove immediately
    setProjects(current => current.filter(p => p.id !== projectId));

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      toast.success('Project deleted');
      // No need to re-fetch if optimistic update worked, but can do so to be safe
      // fetchProjects(); 
    } catch (error) {
      toast.error('Failed to delete project');
      // Rollback if failed
      fetchProjects();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <span className="text-lg font-semibold">SchemaCanvas</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-20">
          <h1 className="text-6xl font-bold mb-6 tracking-tight">
            Visual Database
            <br />
            Schema Designer
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl">
            Design database schemas visually. Generate PostgreSQL SQL and Prisma schemas instantly.
          </p>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <button
              onClick={handleQuickStart}
              className="px-6 py-3 bg-white text-gray-950 font-medium rounded hover:bg-gray-100 transition-colors"
            >
              Start Designing →
            </button>
            <form onSubmit={handleCreateProject} className="flex gap-2 flex-1 sm:max-w-md">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name..."
                disabled={creating}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-12 text-sm">
            <div>
              <h3 className="font-semibold mb-2 text-gray-100">Visual Editor</h3>
              <p className="text-gray-400">Drag-and-drop interface for designing database schemas</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-gray-100">Auto Validation</h3>
              <p className="text-gray-400">Real-time validation ensures schema correctness</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-gray-100">Export Formats</h3>
              <p className="text-gray-400">Generate PostgreSQL SQL or Prisma schema code</p>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="border-t border-white/5 pt-16">
          <h2 className="text-2xl font-semibold mb-8">Projects</h2>

          {loading ? (
            <div className="text-gray-400 py-12">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-gray-400">
              <p>No projects yet. Create your first project above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}


              {/* Project Rows */}
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-[1fr,auto,auto,auto] gap-4 px-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors group items-center"
                >
                  <div className="font-medium truncate">
                    {editingId === project.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded focus:outline-none focus:ring-1 focus:ring-white/30 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateProjectName(project.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => handleUpdateProjectName(project.id)}
                          disabled={updating}
                          className="p-1 hover:text-green-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={updating}
                          className="p-1 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {project.name}
                        <button
                          onClick={() => startEditing(project)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-300 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm text-right w-32">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="w-20">
                    <button
                      onClick={() => handleLoadProject(project.id)}
                      className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
                    >
                      Open
                    </button>
                  </div>
                  <div className="w-20">
                    <button
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      className="text-sm text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-500">© 2026 SchemaCanvas</p>
        </div>
      </footer>
    </div>
  );
}
