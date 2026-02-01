
import React, { useMemo } from 'react';
import type { Interaction } from '../types';
import { InteractionType } from '../types';
import { Download, FileJson } from 'lucide-react';

interface Props {
  interactions: Interaction[];
}

const InteractionTable: React.FC<Props> = ({ interactions }) => {

  const downloadCSV = () => {
    const headers = ['ID', 'Type', 'Distance (Å)', 'Ligand Atom', 'Protein Atom', 'Residue'];
    const rows = interactions.map(i => [
      i.id,
      i.type,
      i.distance.toFixed(2),
      `${i.ligandAtom.element}:${i.ligandAtom.name}`,
      `${i.proteinAtom.element}:${i.proteinAtom.name}`,
      `${i.proteinAtom.resName} ${i.proteinAtom.resNo}`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'interactions.csv');
    link.click();
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(interactions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'interactions.json');
    link.click();
  };

  const sortedInteractions = useMemo(() => {
    return [...interactions].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.distance - b.distance;
    });
  }, [interactions]);

  if (interactions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>No interaction data available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar with export buttons - responsive layout */}
      <div className="px-3 md:px-4 py-2 bg-white border-b border-slate-100 flex flex-wrap justify-end gap-2">
        <button onClick={downloadCSV} className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 text-slate-700">
          <Download size={12} /> <span className="hidden sm:inline">Export</span> CSV
        </button>
        <button onClick={downloadJSON} className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 text-slate-700">
          <FileJson size={12} /> <span className="hidden sm:inline">Export</span> JSON
        </button>
      </div>

      {/* Scrollable table container - horizontal scroll on mobile */}
      <div className="overflow-auto flex-1 bg-white">
        <table className="w-full text-xs md:text-sm text-left text-slate-600 min-w-[480px]">
          <thead className="text-[10px] md:text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-2 md:px-4 py-2 border-b">Type</th>
              <th className="px-2 md:px-4 py-2 border-b">Dist</th>
              <th className="px-2 md:px-4 py-2 border-b">Ligand</th>
              <th className="px-2 md:px-4 py-2 border-b">Protein Res</th>
              <th className="px-2 md:px-4 py-2 border-b hidden sm:table-cell">Protein Atom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedInteractions.map((interaction) => {
              let badgeColor = 'bg-slate-100 text-slate-800';
              if (interaction.type === InteractionType.HydrogenBond) badgeColor = 'bg-blue-50 text-blue-700 border border-blue-100';
              if (interaction.type === InteractionType.Hydrophobic) badgeColor = 'bg-orange-50 text-orange-700 border border-orange-100';
              if (interaction.type === InteractionType.SaltBridge) badgeColor = 'bg-yellow-50 text-yellow-700 border border-yellow-100';
              if (interaction.type === InteractionType.HalogenBond) badgeColor = 'bg-purple-50 text-purple-700 border border-purple-100';

              // Shorten type names for mobile
              const shortType = interaction.type.replace('Hydrogen Bond', 'H-Bond').replace('Hydrophobic', 'Hydro').replace('Salt Bridge', 'Salt');

              return (
                <tr key={interaction.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 md:px-4 py-2">
                    <span className={`px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${badgeColor}`}>
                      <span className="hidden md:inline">{interaction.type}</span>
                      <span className="md:hidden">{shortType}</span>
                    </span>
                  </td>
                  <td className="px-2 md:px-4 py-2 font-mono text-slate-900 font-medium">{interaction.distance.toFixed(2)}</td>
                  <td className="px-2 md:px-4 py-2 text-slate-600">
                    {interaction.ligandAtom.name}
                    <span className="hidden md:inline text-slate-400 text-xs"> ({interaction.ligandAtom.element})</span>
                  </td>
                  <td className="px-2 md:px-4 py-2 font-medium text-slate-800">
                    {interaction.proteinAtom.resName} {interaction.proteinAtom.resNo}
                    <span className="text-slate-400 font-normal hidden sm:inline"> ({interaction.proteinAtom.chain})</span>
                  </td>
                  <td className="px-2 md:px-4 py-2 text-slate-600 hidden sm:table-cell">{interaction.proteinAtom.name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InteractionTable;
