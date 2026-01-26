
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as NGL from 'ngl';
import { Upload, Settings, Search, Microscope, Table as TableIcon, RefreshCw, Move, Info, Palette, Filter } from 'lucide-react';
import Viewer from './components/Viewer';
import InteractionTable from './components/InteractionTable';
import { getLigandCandidates, analyzeInteractions, findResidueByName } from './services/interactionService';
import { ResidueOption, AnalysisResult, InteractionType } from './types';
import { THRESHOLDS } from './constants';

export interface VisualSettings {
  proteinStyle: 'cartoon' | 'rope' | 'trace' | 'line' | 'hidden';
  ligandStyle: 'ball+stick' | 'licorice' | 'spacefill';
  pocketStyle: 'licorice' | 'ball+stick' | 'stick';
  interactionWidth: number;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [structure, setStructure] = useState<NGL.Structure | null>(null);
  const [ligandCandidates, setLigandCandidates] = useState<ResidueOption[]>([]);
  const [selectedLigand, setSelectedLigand] = useState<ResidueOption | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showInteractions, setShowInteractions] = useState(true);
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  // Interaction Filters
  const [interactionFilters, setInteractionFilters] = useState<Record<InteractionType, boolean>>({
    [InteractionType.HydrogenBond]: true,
    [InteractionType.SaltBridge]: true,
    [InteractionType.Hydrophobic]: true,
    [InteractionType.PiStacking]: true,
    [InteractionType.HalogenBond]: true,
    [InteractionType.MetalCoordination]: true,
    [InteractionType.Unknown]: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visual Settings
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    proteinStyle: 'cartoon',
    ligandStyle: 'ball+stick',
    pocketStyle: 'licorice',
    interactionWidth: 1.0
  });

  // Trigger for Viewer
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Supported molecular structure file extensions
  const SUPPORTED_EXTENSIONS = ['.pdb', '.ent', '.cif', '.sdf', '.mol2'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      const fileName = uploadedFile.name.toLowerCase();
      const isValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));

      if (!isValidExtension) {
        alert(`Unsupported file format. Please upload a molecular structure file.\n\nSupported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`);
        // Reset the input so the same file can be re-selected if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setFile(uploadedFile);
      setStructure(null);
      setLigandCandidates([]);
      setSelectedLigand(null);
      setAnalysisResult(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setStructure(null);
    setLigandCandidates([]);
    setSelectedLigand(null);
    setAnalysisResult(null);
    setManualSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStructureLoaded = useCallback((struct: NGL.Structure) => {
    setStructure(struct);
    const candidates = getLigandCandidates(struct);
    setLigandCandidates(candidates);
    if (candidates.length > 0) {
      setSelectedLigand(candidates[0]);
    }
  }, []);

  const handleManualSearch = () => {
    if (!structure || !manualSearchQuery) return;
    const found = findResidueByName(structure, manualSearchQuery);
    if (found) {
      setLigandCandidates(prev => {
        const exists = prev.some(l => l.chain === found.chain && l.resNo === found.resNo);
        return exists ? prev : [found, ...prev];
      });
      setSelectedLigand(found);
    } else {
      alert(`Residue '${manualSearchQuery}' not found.`);
    }
  };

  useEffect(() => {
    if (structure && selectedLigand) {
      const result = analyzeInteractions(structure, selectedLigand);
      setAnalysisResult(result);
    }
  }, [structure, selectedLigand]);

  // Filter Interactions based on state
  const filteredInteractions = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.interactions.filter(i => interactionFilters[i.type]);
  }, [analysisResult, interactionFilters]);

  const toggleFilter = (type: InteractionType) => {
    setInteractionFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 shrink-0 h-14 flex items-center justify-between px-6 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Microscope className="text-indigo-600 w-6 h-6" />
          <h1 className="text-lg font-bold text-slate-800">LigPlot<span className="text-indigo-600">3D</span> Pro</h1>
        </div>

        <div className="flex items-center gap-3">
          {file && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} /> New Analysis
            </button>
          )}
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-all shadow-sm">
            <Upload size={14} />
            <span>Upload Structure</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdb,.ent,.cif,.sdf,.mol2"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[100vw]">

        {/* LEFT PANEL: Controls */}
        <aside className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 overflow-y-auto">
          <div className="p-4 flex flex-col gap-6">

            {/* Ligand Selection */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h2 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                <Settings size={14} /> Target Selection
              </h2>

              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ligand</label>
                <select
                  className="w-full border-slate-300 rounded text-sm p-2 border bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={selectedLigand ? `${selectedLigand.chain}:${selectedLigand.resNo}` : ''}
                  onChange={(e) => {
                    const [chain, resNo] = e.target.value.split(':');
                    const lig = ligandCandidates.find(l => l.chain === chain && l.resNo === parseInt(resNo));
                    if (lig) setSelectedLigand(lig);
                  }}
                  disabled={ligandCandidates.length === 0}
                >
                  {ligandCandidates.map(lig => (
                    <option key={`${lig.chain}:${lig.resNo}`} value={`${lig.chain}:${lig.resNo}`}>
                      {lig.resName} {lig.resNo} (Chain {lig.chain})
                    </option>
                  ))}
                  {ligandCandidates.length === 0 && <option>No ligands</option>}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded text-sm px-2 py-1"
                    placeholder="Residue (e.g. LIG)"
                    value={manualSearchQuery}
                    onChange={e => setManualSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                  />
                  <button onClick={handleManualSearch} className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-sm shadow-sm">
                    <Search size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Interaction Filters (New) */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h2 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                <Filter size={14} /> Interaction Filters
              </h2>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded -mx-1 transition-colors">
                  <input type="checkbox" checked={interactionFilters[InteractionType.HydrogenBond]} onChange={() => toggleFilter(InteractionType.HydrogenBond)} className="rounded text-blue-500 focus:ring-0" />
                  <div className="w-2 h-2 rounded-full bg-[#3399ff]"></div>
                  <span>Hydrogen Bonds</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded -mx-1 transition-colors">
                  <input type="checkbox" checked={interactionFilters[InteractionType.SaltBridge]} onChange={() => toggleFilter(InteractionType.SaltBridge)} className="rounded text-yellow-500 focus:ring-0" />
                  <div className="w-2 h-2 rounded-full bg-[#ffcc00]"></div>
                  <span>Salt Bridges</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded -mx-1 transition-colors">
                  <input type="checkbox" checked={interactionFilters[InteractionType.PiStacking]} onChange={() => toggleFilter(InteractionType.PiStacking)} className="rounded text-green-600 focus:ring-0" />
                  <div className="w-2 h-2 rounded-full bg-[#00b300]"></div>
                  <span>Pi-Interactions</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded -mx-1 transition-colors">
                  <input type="checkbox" checked={interactionFilters[InteractionType.Hydrophobic]} onChange={() => toggleFilter(InteractionType.Hydrophobic)} className="rounded text-slate-400 focus:ring-0" />
                  <div className="w-2 h-2 rounded-full bg-[#b3b3b3]"></div>
                  <span>Hydrophobic</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded -mx-1 transition-colors">
                  <input type="checkbox" checked={interactionFilters[InteractionType.HalogenBond]} onChange={() => toggleFilter(InteractionType.HalogenBond)} className="rounded text-purple-600 focus:ring-0" />
                  <div className="w-2 h-2 rounded-full bg-[#9900cc]"></div>
                  <span>Halogen Bonds</span>
                </label>
              </div>
            </div>

            {/* Visual Settings */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h2 className="text-xs font-bold uppercase text-slate-500 mb-3">Visualization</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Protein Context</label>
                  <select
                    className="w-full text-xs border p-1 rounded"
                    value={visualSettings.proteinStyle}
                    onChange={e => setVisualSettings({ ...visualSettings, proteinStyle: e.target.value as any })}
                  >
                    <option value="cartoon">Cartoon (Ghost)</option>
                    <option value="rope">Rope</option>
                    <option value="line">Lines</option>
                    <option value="hidden">Hidden (Ligand Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ligand Style</label>
                  <select
                    className="w-full text-xs border p-1 rounded"
                    value={visualSettings.ligandStyle}
                    onChange={e => setVisualSettings({ ...visualSettings, ligandStyle: e.target.value as any })}
                  >
                    <option value="ball+stick">Ball & Stick</option>
                    <option value="licorice">Licorice</option>
                    <option value="spacefill">Spacefill</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pocket Residues</label>
                  <select
                    className="w-full text-xs border p-1 rounded"
                    value={visualSettings.pocketStyle}
                    onChange={e => setVisualSettings({ ...visualSettings, pocketStyle: e.target.value as any })}
                  >
                    <option value="licorice">Licorice (Thick)</option>
                    <option value="ball+stick">Ball & Stick</option>
                    <option value="stick">Sticks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Interaction Line Width</label>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={visualSettings.interactionWidth}
                    onChange={e => setVisualSettings({ ...visualSettings, interactionWidth: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={showInteractions}
                    onChange={(e) => setShowInteractions(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Show All Interactions</span>
                </label>
              </div>
            </div>

            {/* Analysis Params */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-xs">
              <h2 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                <Info size={14} /> Thresholds (PLIP)
              </h2>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between"><span>H-Bond:</span> <span>{THRESHOLDS.HBOND_DIST} Å</span></div>
                <div className="flex justify-between"><span>Hydrophobic:</span> <span>{THRESHOLDS.HYDROPHOBIC_DIST} Å</span></div>
                <div className="flex justify-between"><span>Salt Bridge:</span> <span>{THRESHOLDS.SALT_BRIDGE_DIST} Å</span></div>
                <div className="flex justify-between"><span>Pi-Stacking:</span> <span>{THRESHOLDS.PI_STACKING_DIST} Å</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <button
                onClick={() => setRecenterTrigger(prev => prev + 1)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium hover:bg-slate-100 text-slate-700"
              >
                <Move size={14} /> Recenter View
              </button>
            </div>

          </div>
        </aside>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* 3D Viewer */}
          <div className="flex-[3] relative bg-white min-h-[300px] z-0">
            <Viewer
              key={file ? file.name : 'empty'}
              file={file}
              onStructureLoaded={handleStructureLoaded}
              selectedLigand={selectedLigand}
              interactions={filteredInteractions}
              showInteractions={showInteractions}
              visualSettings={visualSettings}
              triggerRecenter={recenterTrigger}
            />
          </div>

          {/* Table */}
          <div className="flex-[2] bg-white border-t border-slate-200 flex flex-col min-h-[200px] z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-700 shrink-0">
              <TableIcon size={16} /> Interaction List
            </div>
            <div className="flex-1 overflow-hidden relative">
              <InteractionTable interactions={filteredInteractions} />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
