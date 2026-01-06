
import React, { useEffect, useRef } from 'react';
import * as NGL from 'ngl';
import { Interaction, InteractionType, ResidueOption } from '../types';
import { ZoomIn, ZoomOut, Camera } from 'lucide-react';
import { VisualSettings } from '../App';

interface Props {
  file: File | null;
  onStructureLoaded: (structure: NGL.Structure) => void;
  selectedLigand: ResidueOption | null;
  interactions: Interaction[];
  showInteractions: boolean;
  visualSettings: VisualSettings;
  triggerRecenter: number; // Increment to trigger
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

  // Initialize NGL Stage
  useEffect(() => {
    if (!containerRef.current) return;
    
    const stage = new NGL.Stage(containerRef.current, { 
      backgroundColor: 'white',
      cameraType: 'orthographic',
      tooltip: true,
      clipDist: 0
    });
    stageRef.current = stage;

    const resizeObserver = new ResizeObserver(() => {
      stage.handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      stage.dispose();
    };
  }, []);

  // Load File
  useEffect(() => {
    if (!file || !stageRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const ext = file.name.split('.').pop() || 'pdb';
      
      stageRef.current?.removeAllComponents();
      const blob = new Blob([result], { type: 'text/plain'});
      stageRef.current?.loadFile(blob, { ext }).then((component) => {
        if (component) {
          const structComp = component as NGL.StructureComponent;
          structureCompRef.current = structComp;
          onStructureLoaded(structComp.structure);
          component.autoView();
        }
      });
    };
    reader.readAsText(file);
  }, [file, onStructureLoaded]);

  // Handle Recenter Trigger
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

  // Render Scene
  useEffect(() => {
    const comp = structureCompRef.current;
    const stage = stageRef.current;
    if (!comp || !stage) return;

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

      // 1. Ligand
      comp.addRepresentation(visualSettings.ligandStyle as any, { 
        sele: ligSele,
        multipleBond: 'symmetric',
        colorValue: '#333333', 
        radiusScale: visualSettings.ligandStyle === 'spacefill' ? 0.8 : 2.0
      });

      // 2. Pocket Residues (Always detailed, user configurable style)
      if (pocketSele) {
        let style = visualSettings.pocketStyle as string;
        if (style === 'stick') style = 'licorice'; // NGL fallback

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

      // 3. Protein Context (User Configurable)
      if (visualSettings.proteinStyle !== 'hidden') {
        comp.addRepresentation(visualSettings.proteinStyle as any, {
          sele: `not (${ligSele})`, // everything else
          color: '#cccccc',
          opacity: 0.2, // Ghost
          depthWrite: false,
          side: 'front'
        });
      }

      // 4. Interactions
      if (showInteractions && interactions.length > 0) {
        const shape = new NGL.Shape('interactions');
        const w = visualSettings.interactionWidth / 10.0; // Scale user input (1-10) to reasonable 0.1-1.0
        
        interactions.forEach(i => {
          const p1: [number, number, number] = [i.ligandAtom.x, i.ligandAtom.y, i.ligandAtom.z];
          const p2: [number, number, number] = [i.proteinAtom.x, i.proteinAtom.y, i.proteinAtom.z];
          const mp: [number, number, number] = [
            (i.ligandAtom.x + i.proteinAtom.x) / 2,
            (i.ligandAtom.y + i.proteinAtom.y) / 2,
            (i.ligandAtom.z + i.proteinAtom.z) / 2,
          ];
          
          switch (i.type) {
            case InteractionType.HydrogenBond:
              shape.addCylinder(p1, p2, [0.2, 0.6, 1.0], w, 'hbond'); // Blue
              shape.addText(mp, [0.2, 0.6, 1.0], 1.2, i.distance.toFixed(2));
              break;
            case InteractionType.SaltBridge:
              shape.addCylinder(p1, p2, [1.0, 0.8, 0.0], w * 1.5, 'saltbridge'); // Yellow/Orange
              shape.addText(mp, [0.8, 0.6, 0.0], 1.2, i.distance.toFixed(2));
              break;
            case InteractionType.PiStacking:
              shape.addCylinder(p1, p2, [0.0, 0.7, 0.0], w * 1.5, 'pistacking'); // Green
              shape.addText(mp, [0.0, 0.5, 0.0], 1.2, 'π');
              break;
            case InteractionType.Hydrophobic:
              shape.addCylinder(p1, p2, [0.7, 0.7, 0.7], w * 0.5, 'hydrophobic'); // Grey Thin
              break;
            case InteractionType.HalogenBond:
              shape.addCylinder(p1, p2, [0.6, 0.0, 0.8], w, 'halogen'); // Purple
              shape.addText(mp, [0.6, 0.0, 0.8], 1.2, i.distance.toFixed(2));
              break;
            default: break;
          }
        });
        
        const shapeComp = stage.addComponentFromObject(shape);
        if (shapeComp) {
          shapeCompRef.current = shapeComp;
          shapeCompRef.current.addRepresentation('buffer', { opacity: 0.9 });
        }
      }

      // Auto-zoom instantly
      comp.autoView(ligSele, 0);
    } 

  }, [selectedLigand, interactions, showInteractions, visualSettings]);

  const handleZoom = (delta: number) => {
    if (stageRef.current) {
      // NGL zoom: positive zooms OUT, negative zooms IN.
      // We use a larger step for buttons.
      const stage = stageRef.current;
      stage.animationControls.zoom(delta); 
    }
  };

  const handleSnapshot = () => {
    if (stageRef.current) {
      stageRef.current.makeImage({ factor: 2, antialias: true, trim: false, transparent: false }).then((blob) => {
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `ligand_view_${new Date().getTime()}.png`;
         link.click();
      });
    }
  };

  if (!file) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 border-dashed border-2 border-slate-200 m-4 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">3D Viewer</p>
          <p className="text-sm">Upload PDB to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group">
      <div ref={containerRef} className="w-full h-full bg-white" />
      
      {/* Overlay Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 p-1.5 rounded-lg shadow-md border border-slate-200 backdrop-blur-sm z-10">
        <button 
           onClick={() => handleZoom(-5)}
           className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
           title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <button 
           onClick={() => handleZoom(5)}
           className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
           title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
        <hr className="border-slate-200" />
        <button 
           onClick={handleSnapshot}
           className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
           title="Save Image"
        >
          <Camera size={20} />
        </button>
      </div>
    </div>
  );
};

export default Viewer;
