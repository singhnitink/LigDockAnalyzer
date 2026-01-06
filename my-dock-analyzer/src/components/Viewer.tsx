
import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import { InteractionType } from '../types';
import type { Interaction, ResidueOption } from '../types';
import { ZoomIn, ZoomOut, Camera, Loader2 } from 'lucide-react';
import type { VisualSettings } from '../App';

interface Props {
  file: File | null;
  onStructureLoaded: (structure: NGL.Structure) => void;
  selectedLigand: ResidueOption | null;
  interactions: Interaction[];
  showInteractions: boolean;
  visualSettings: VisualSettings;
  triggerRecenter: number;
}

const Viewer: React.FC<Props> = ({
  file,
  onStructureLoaded,
  selectedLigand,
  interactions,
  showInteractions,
  visualSettings,
  triggerRecenter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<NGL.Stage | null>(null);
  const structureCompRef = useRef<NGL.StructureComponent | null>(null);
  const shapeCompRef = useRef<NGL.Component | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize NGL Stage
  useEffect(() => {
    if (!containerRef.current) return;

    // Wait for container to have dimensions
    const checkDimensions = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;

      console.log('Checking container dimensions:', width, 'x', height);

      // Only initialize if container has proper dimensions
      if (width === 0 || height === 0) {
        console.log('Container not ready, waiting...');
        setTimeout(checkDimensions, 50);
        return;
      }

      console.log('Container ready! Initializing NGL Stage with dimensions:', width, 'x', height);

      // Create stage with white background
      const stage = new NGL.Stage(containerRef.current, {
        backgroundColor: 'white',
        cameraType: 'orthographic',
        tooltip: true,
        clipDist: 0
      });
      stageRef.current = stage;

      // Force initial resize to ensure canvas matches container
      setTimeout(() => {
        stage.handleResize();
        console.log('NGL Stage initialized and resized');
      }, 100);

      // Handle window resizing
      const resizeObserver = new ResizeObserver(() => {
        stage.handleResize();
      });
      resizeObserver.observe(containerRef.current);

      // Cleanup function
      return () => {
        resizeObserver.disconnect();
        stage.dispose();
      };
    };

    // Start checking for dimensions
    checkDimensions();
  }, []);

  // Load File
  useEffect(() => {
    if (!file || !stageRef.current) return;

    console.log('Loading file:', file.name);
    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as string;
      const ext = file.name.split('.').pop() || 'pdb';

      console.log('File loaded, parsing as:', ext);
      stageRef.current?.removeAllComponents();
      const blob = new Blob([result], { type: 'text/plain' });

      stageRef.current?.loadFile(blob, { ext }).then((component) => {
        if (component) {
          console.log('Structure loaded successfully');
          const structComp = component as NGL.StructureComponent;
          structureCompRef.current = structComp;
          onStructureLoaded(structComp.structure);

          // Force a resize and autoview after a longer delay to ensure DOM is ready
          setTimeout(() => {
            stageRef.current?.handleResize();
            // Default to viewing everything first
            structComp.autoView('all', 500);
            setLoading(false);
            console.log('AutoView(all) applied, viewer ready');
          }, 300);
        }
      }).catch(err => {
        console.error("NGL Load Error:", err);
        setLoading(false);
      });
    };

    reader.onerror = () => {
      setLoading(false);
      alert("Error reading file");
    };

    reader.readAsText(file);
  }, [file, onStructureLoaded]);

  // Handle Recenter
  useEffect(() => {
    if (triggerRecenter > 0 && structureCompRef.current) {
      if (selectedLigand) {
        const ligSele = `${selectedLigand.resNo}:${selectedLigand.chain}`;
        structureCompRef.current.autoView(ligSele, 500);
      } else {
        structureCompRef.current.autoView('all', 500);
      }
    }
  }, [triggerRecenter, selectedLigand]);

  // Render Scene Updates
  useEffect(() => {
    const comp = structureCompRef.current;
    const stage = stageRef.current;
    if (!comp || !stage) return;

    console.log('Rendering scene, selectedLigand:', selectedLigand);
    comp.removeAllRepresentations();

    if (shapeCompRef.current) {
      stage.removeComponent(shapeCompRef.current);
      shapeCompRef.current = null;
    }

    if (selectedLigand) {
      const ligSele = `${selectedLigand.resNo}:${selectedLigand.chain}`;
      const interactingResidues = new Set<string>();
      interactions.forEach(i => interactingResidues.add(`${i.proteinAtom.resNo}:${i.proteinAtom.chain}`));
      const pocketSele = Array.from(interactingResidues).join(' or ');

      console.log('Rendering ligand:', ligSele, 'with', interactions.length, 'interactions');

      // 1. Ligand
      comp.addRepresentation(visualSettings.ligandStyle as any, {
        sele: ligSele,
        multipleBond: 'symmetric',
        colorValue: '#333333',
        radiusScale: visualSettings.ligandStyle === 'spacefill' ? 0.8 : 2.0
      });

      // 2. Pocket Residues
      if (pocketSele) {
        let style = visualSettings.pocketStyle;
        if (style === 'stick') style = 'licorice'; // NGL mapping

        comp.addRepresentation(style as any, {
          sele: pocketSele,
          scale: style === 'licorice' ? 0.8 : 0.5,
          colorScheme: 'element'
        });

        comp.addRepresentation('label', {
          sele: `(${pocketSele}) and .CA`,
          color: '#333333',
          scale: 2.0,
          labelType: 'format',
          labelFormat: '%(resname)s %(resno)s',
          yOffset: 0.5,
          zOffset: 1.0,
          attachment: 'bottom-center',
          showBackground: true,
          backgroundColor: 'white',
          backgroundOpacity: 0.7,
        });
      }

      // 3. Protein Context
      if (visualSettings.proteinStyle !== 'hidden') {
        const params: any = {
          sele: `not (${ligSele})`,
          color: '#888888',
          opacity: 1.0,
        };

        // Enhance visibility for thinner representations
        if (visualSettings.proteinStyle === 'rope' || visualSettings.proteinStyle === 'trace') {
          params.radius = 0.3;
          params.scale = 4.0;
        } else if (visualSettings.proteinStyle === 'line') {
          params.linewidth = 5;
        }

        comp.addRepresentation(visualSettings.proteinStyle as any, params);
      }

      // 4. Interactions
      if (showInteractions && interactions.length > 0) {
        const shape = new NGL.Shape('interactions');
        const w = visualSettings.interactionWidth / 10.0;

        interactions.forEach(i => {
          // Explicit Tuple Types for NGL Shape
          const p1: [number, number, number] = [i.ligandAtom.x, i.ligandAtom.y, i.ligandAtom.z];
          const p2: [number, number, number] = [i.proteinAtom.x, i.proteinAtom.y, i.proteinAtom.z];
          const mp: [number, number, number] = [
            (i.ligandAtom.x + i.proteinAtom.x) / 2,
            (i.ligandAtom.y + i.proteinAtom.y) / 2,
            (i.ligandAtom.z + i.proteinAtom.z) / 2,
          ];

          switch (i.type) {
            case InteractionType.HydrogenBond:
              shape.addCylinder(p1, p2, [0.2, 0.6, 1.0], w, 'hbond');
              shape.addText(mp, [0.2, 0.6, 1.0], 1.2, i.distance.toFixed(2));
              break;
            case InteractionType.SaltBridge:
              shape.addCylinder(p1, p2, [1.0, 0.8, 0.0], w * 1.5, 'saltbridge');
              shape.addText(mp, [0.8, 0.6, 0.0], 1.2, i.distance.toFixed(2));
              break;
            case InteractionType.PiStacking:
              shape.addCylinder(p1, p2, [0.0, 0.7, 0.0], w * 1.5, 'pistacking');
              shape.addText(mp, [0.0, 0.5, 0.0], 1.2, 'π');
              break;
            case InteractionType.Hydrophobic:
              shape.addCylinder(p1, p2, [0.7, 0.7, 0.7], w * 0.5, 'hydrophobic');
              break;
            case InteractionType.HalogenBond:
              shape.addCylinder(p1, p2, [0.6, 0.0, 0.8], w, 'halogen');
              shape.addText(mp, [0.6, 0.0, 0.8], 1.2, i.distance.toFixed(2));
              break;
          }
        });

        const shapeComp = stage.addComponentFromObject(shape);
        if (shapeComp) {
          shapeCompRef.current = shapeComp;
          shapeCompRef.current.addRepresentation('buffer', { opacity: 0.9 });
        }
      }

      // Auto-zoom to ligand
      setTimeout(() => {
        // Use 'all' instead of ligand specific to ensure visibility
        comp.autoView('all', 500);
        console.log('AutoView(all) applied during render');
      }, 100);
    } else {
      // Fallback: show entire structure if no ligand selected
      console.log('No ligand selected, showing entire structure');
      comp.addRepresentation('cartoon', {
        color: 'chainindex'
      });
      setTimeout(() => {
        comp.autoView('all', 500);
        console.log('AutoView to all applied');
      }, 100);
    }

  }, [selectedLigand, interactions, showInteractions, visualSettings]);

  const handleZoom = (delta: number) => {
    if (stageRef.current) {
      stageRef.current.animationControls.zoom(delta);
    }
  };

  const handleSnapshot = () => {
    if (stageRef.current) {
      stageRef.current.makeImage({ factor: 2, antialias: true, trim: false, transparent: false }).then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ligand_view.png`;
        link.click();
      });
    }
  };

  if (!file) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-dashed border-2 border-slate-200 rounded-lg select-none">
        <Camera className="w-12 h-12 mb-2 opacity-50" />
        <p className="font-medium">3D Viewer</p>
        <p className="text-sm">Upload a file to begin</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-white overflow-hidden group shadow-inner rounded-lg">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <span className="text-sm font-medium text-slate-600">Loading Structure...</span>
          </div>
        </div>
      )}

      {/* CRITICAL: Absolute inset ensures container fills parent even if flex breaks */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 p-1.5 rounded-lg shadow-md border border-slate-200 backdrop-blur-sm z-10">
        <button onClick={() => handleZoom(-5)} className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Zoom In"><ZoomIn size={20} /></button>
        <button onClick={() => handleZoom(5)} className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Zoom Out"><ZoomOut size={20} /></button>
        <hr className="border-slate-200 my-1" />
        <button onClick={handleSnapshot} className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Snapshot"><Camera size={20} /></button>
      </div>
    </div>
  );
};

export default Viewer;
