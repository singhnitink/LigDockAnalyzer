
import * as NGL from 'ngl';
import { AtomData, Interaction, InteractionType, AnalysisResult, ResidueOption } from '../types';
import { THRESHOLDS, ATOM_PROPS, MAX_INTERACTION_DIST, COMMON_LIGANDS, IGNORED_RESIDUES } from '../constants';
import { distance, getCenter, getPlaneNormal, angleBetween } from './geometryUtils';

const parseNGLAtom = (ap: any): AtomData => ({
  index: ap.index,
  name: ap.atomname,
  element: ap.element,
  x: ap.x,
  y: ap.y,
  z: ap.z,
  resName: ap.resname,
  resNo: ap.resno,
  chain: ap.chainname,
  isHet: ap.isHetero(),
});

// --- Helper: Ligand Ring Detection (Geometric DFS) ---
const findLigandRings = (atoms: AtomData[]): AtomData[][] => {
  if (!atoms || atoms.length === 0) return [];
  const rings: AtomData[][] = [];
  // Simple adjacency based on bond length < 1.65 (covers C-C, C-N, C-O in rings)
  const adj: number[][] = atoms.map(() => []);
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      if (distance(atoms[i], atoms[j]) < 1.65) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visitedPaths = new Set<string>();

  const dfs = (start: number, current: number, path: number[]) => {
    if (path.length > 6) return;
    if (path.length >= 5) {
       if (adj[current].includes(start)) {
         const sortedPath = [...path].sort((a, b) => a - b);
         const key = sortedPath.join(',');
         if (!visitedPaths.has(key)) {
           visitedPaths.add(key);
           rings.push(path.map(idx => atoms[idx]));
         }
         return;
       }
    }
    
    for (const neighbor of adj[current]) {
      if (!path.includes(neighbor)) {
        dfs(start, neighbor, [...path, neighbor]);
      }
    }
  };

  for (let i = 0; i < atoms.length; i++) {
     // Start searches from Carbon or Nitrogen
     if (['C', 'N'].includes(atoms[i].element)) {
        dfs(i, i, [i]);
     }
  }
  return rings;
};

export const getLigandCandidates = (structure: NGL.Structure): ResidueOption[] => {
  const candidates: Map<string, ResidueOption> = new Map();
  
  structure.eachResidue((rp) => {
    const resNameUpper = rp.resname.toUpperCase();
    const isCommon = COMMON_LIGANDS.has(resNameUpper);
    const isHet = rp.isHetero();
    const isIgnored = IGNORED_RESIDUES.has(resNameUpper);
    
    // Aggressively find potential ligands
    if (isCommon || (isHet && !isIgnored)) {
      const key = `${rp.chainname}:${rp.resno}`;
      if (!candidates.has(key)) {
        candidates.set(key, {
          resName: rp.resname,
          resNo: rp.resno,
          chain: rp.chainname,
          atomCount: rp.atomCount,
        });
      }
    }
  });

  return Array.from(candidates.values()).sort((a, b) => {
    const aIsCommon = COMMON_LIGANDS.has(a.resName.toUpperCase());
    const bIsCommon = COMMON_LIGANDS.has(b.resName.toUpperCase());
    if (aIsCommon && !bIsCommon) return -1;
    if (!aIsCommon && bIsCommon) return 1;
    return b.atomCount - a.atomCount;
  });
};

export const findResidueByName = (structure: NGL.Structure, queryName: string): ResidueOption | null => {
  let found: ResidueOption | null = null;
  const q = queryName.toUpperCase().trim();
  structure.eachResidue((rp) => {
    if (found) return; 
    if (rp.resname.toUpperCase() === q) {
      found = {
        resName: rp.resname,
        resNo: rp.resno,
        chain: rp.chainname,
        atomCount: rp.atomCount
      };
    }
  });
  return found;
};

export const analyzeInteractions = (
  structure: NGL.Structure,
  ligandResidue: ResidueOption
): AnalysisResult => {
  const interactions: Interaction[] = [];
  const ligandAtoms: AtomData[] = [];
  const proteinAtoms: AtomData[] = [];

  // 1. Extract Atoms
  structure.eachAtom((ap) => {
    const isLigand =
      ap.resno === ligandResidue.resNo &&
      ap.chainname === ligandResidue.chain &&
      ap.resname === ligandResidue.resName;

    if (isLigand) {
      ligandAtoms.push(parseNGLAtom(ap));
    } else {
      // Exclude waters/ions from Protein set for general interactions, 
      // but potentially keep them if we wanted water bridges (not implemented yet)
      if (!ap.isHetero()) {
         proteinAtoms.push(parseNGLAtom(ap));
      }
    }
  });

  if (ligandAtoms.length === 0) return { interactions: [], ligandCenter: {x:0,y:0,z:0} };

  const ligandCenter = getCenter(ligandAtoms);
  let idCounter = 0;

  // 2. Filter Protein Atoms by coarse distance (Optimization)
  const relevantProteinAtoms = proteinAtoms.filter(pAtom => {
    const d = distance(pAtom, ligandCenter);
    return d < 18.0; // slightly larger than cutoffs to be safe
  });

  const proteinResidues: Record<string, AtomData[]> = {};
  relevantProteinAtoms.forEach(a => {
    const key = `${a.chain}:${a.resNo}`;
    if (!proteinResidues[key]) proteinResidues[key] = [];
    proteinResidues[key].push(a);
  });

  // 3. Geometric Analysis Prep
  const ligandRings = findLigandRings(ligandAtoms);
  const ligandRingData = ligandRings.map(ring => ({
    center: getCenter(ring),
    normal: getPlaneNormal(ring),
    atoms: ring
  }));

  // --- Interaction Detection ---

  // Iterate over nearby protein residues
  Object.values(proteinResidues).forEach(resAtoms => {
    const resName = resAtoms[0].resName;

    // A. PI-STACKING & PI-CATION (Protein Ring vs Ligand)
    const aromDef = ATOM_PROPS.AROMATIC_PLANES[resName as keyof typeof ATOM_PROPS.AROMATIC_PLANES];
    if (aromDef) {
       const ringAtoms = resAtoms.filter(a => aromDef.includes(a.name));
       if (ringAtoms.length >= 3) {
         const pCenter = getCenter(ringAtoms);
         const pNormal = getPlaneNormal(ringAtoms);

         // Pi-Stacking
         ligandRingData.forEach(lRing => {
           const dist = distance(pCenter, lRing.center);
           if (dist <= THRESHOLDS.PI_STACKING_DIST) {
             const angle = angleBetween(pNormal, lRing.normal);
             const isParallel = angle < THRESHOLDS.PI_STACKING_ANGLE_PARALLEL || angle > (180 - THRESHOLDS.PI_STACKING_ANGLE_PARALLEL);
             const isTShaped = (angle > THRESHOLDS.PI_STACKING_ANGLE_TSHAPED && angle < 120); 

             if (isParallel || isTShaped) {
               interactions.push({
                 id: `pi-${idCounter++}`,
                 type: InteractionType.PiStacking,
                 distance: dist,
                 ligandAtom: lRing.atoms[0], // Representative
                 proteinAtom: ringAtoms[0],  // Representative
                 angle: angle
               });
             }
           }
         });

         // Pi-Cation (Protein Ring -> Ligand Cation)
         ligandAtoms.forEach(lAtom => {
            if ((lAtom.element === 'N' || lAtom.name.includes('NH')) && distance(lAtom, pCenter) < THRESHOLDS.PI_CATION_DIST) {
                 interactions.push({
                   id: `pic-${idCounter++}`,
                   type: InteractionType.PiStacking, // Treating as Pi-interaction
                   distance: distance(lAtom, pCenter),
                   ligandAtom: lAtom,
                   proteinAtom: ringAtoms[0]
                 });
            }
         });
       }
    }

    // B. SALT BRIDGES & PI-CATION (Protein Charge vs Ligand)
    const posDef = ATOM_PROPS.POS_CHARGE_ATOMS[resName as keyof typeof ATOM_PROPS.POS_CHARGE_ATOMS];
    const negDef = ATOM_PROPS.NEG_CHARGE_ATOMS[resName as keyof typeof ATOM_PROPS.NEG_CHARGE_ATOMS];

    // Protein Positive -> Ligand Negative/Ring
    if (posDef) {
       const posAtoms = resAtoms.filter(a => posDef.includes(a.name));
       if (posAtoms.length > 0) {
         const pPosCenter = getCenter(posAtoms);
         
         // Check Ligand Rings (Cation-Pi)
         ligandRingData.forEach(lRing => {
            if (distance(pPosCenter, lRing.center) < THRESHOLDS.PI_CATION_DIST) {
               interactions.push({
                 id: `pic-${idCounter++}`,
                 type: InteractionType.PiStacking, // Cation-Pi
                 distance: distance(pPosCenter, lRing.center),
                 ligandAtom: lRing.atoms[0],
                 proteinAtom: posAtoms[0]
               });
            }
         });

         // Check Ligand Negative (Salt Bridge)
         ligandAtoms.forEach(lAtom => {
             // Crude approx: O or S or P often carry neg charge in phosphates/sulfates/carboxyls
             if (['O', 'S', 'P'].includes(lAtom.element)) {
                 const d = distance(lAtom, pPosCenter);
                 if (d < THRESHOLDS.SALT_BRIDGE_DIST) {
                     interactions.push({
                        id: `sb-${idCounter++}`,
                        type: InteractionType.SaltBridge,
                        distance: d,
                        ligandAtom: lAtom,
                        proteinAtom: posAtoms[0]
                     });
                 }
             }
         });
       }
    }

    // Protein Negative -> Ligand Positive
    if (negDef) {
        const negAtoms = resAtoms.filter(a => negDef.includes(a.name));
        if (negAtoms.length > 0) {
            const pNegCenter = getCenter(negAtoms);
            ligandAtoms.forEach(lAtom => {
                if (lAtom.element === 'N' || lAtom.name.includes('NH')) { // Amine/Guanidine
                    const d = distance(lAtom, pNegCenter);
                    if (d < THRESHOLDS.SALT_BRIDGE_DIST) {
                         interactions.push({
                            id: `sb-${idCounter++}`,
                            type: InteractionType.SaltBridge,
                            distance: d,
                            ligandAtom: lAtom,
                            proteinAtom: negAtoms[0]
                         });
                    }
                }
            });
        }
    }
  });

  // C. ATOM-ATOM INTERACTIONS (HBond, Hydrophobic, Halogen, Metal)
  ligandAtoms.forEach(lAtom => {
    relevantProteinAtoms.forEach(pAtom => {
      const dist = distance(lAtom, pAtom);
      if (dist > Math.max(THRESHOLDS.HBOND_DIST, THRESHOLDS.HYDROPHOBIC_DIST)) return;

      // Hydrogen Bond
      // PLIP uses 4.1A and Angle > 90. We check Element types + Distance.
      if (dist <= THRESHOLDS.HBOND_DIST) {
        const lIsDon = ATOM_PROPS.DONORS.has(lAtom.element);
        const lIsAcc = ATOM_PROPS.ACCEPTORS.has(lAtom.element);
        const pIsDon = ATOM_PROPS.DONORS.has(pAtom.element);
        const pIsAcc = ATOM_PROPS.ACCEPTORS.has(pAtom.element);

        // Avoid Donor-Donor or Acc-Acc clashes (though some atoms are both)
        // Simple rule: If one is D and other is A.
        const match1 = lIsDon && pIsAcc;
        const match2 = lIsAcc && pIsDon;

        if (match1 || match2) {
           // Filter out C-connected donors if they aren't polar? 
           // For now, assume defined ATOM_PROPS sets are strict enough (N, O, S, F).
           interactions.push({
            id: `hb-${idCounter++}`,
            type: InteractionType.HydrogenBond,
            distance: dist,
            ligandAtom: lAtom,
            proteinAtom: pAtom
          });
        }
      }

      // Halogen Bond
      if (ATOM_PROPS.HALOGENS.has(lAtom.element.toUpperCase()) && ATOM_PROPS.ACCEPTORS.has(pAtom.element)) {
        if (dist <= THRESHOLDS.HALOGEN_DIST) {
           interactions.push({
            id: `xb-${idCounter++}`,
            type: InteractionType.HalogenBond,
            distance: dist,
            ligandAtom: lAtom,
            proteinAtom: pAtom
          });
        }
      }

      // Hydrophobic (Carbon-Carbon only)
      if (lAtom.element === 'C' && pAtom.element === 'C') {
        if (dist <= THRESHOLDS.HYDROPHOBIC_DIST) {
           // Ideally check if these C are part of polar groups (e.g. Carbonyl C).
           // PLIP excludes C in C=O.
           // Heuristic: If C is bonded to more than 1 N/O, exclude? 
           // Without graph, hard to tell. We stick to pure distance C-C.
           interactions.push({
            id: `hp-${idCounter++}`,
            type: InteractionType.Hydrophobic,
            distance: dist,
            ligandAtom: lAtom,
            proteinAtom: pAtom
          });
        }
      }
      
      // Metal
      if (ATOM_PROPS.METALS.has(lAtom.element.toUpperCase()) || ATOM_PROPS.METALS.has(pAtom.element.toUpperCase())) {
         if (dist <= THRESHOLDS.METAL_DIST) {
            interactions.push({
              id: `mt-${idCounter++}`,
              type: InteractionType.MetalCoordination,
              distance: dist,
              ligandAtom: lAtom,
              proteinAtom: pAtom
            });
         }
      }
    });
  });

  // Deduplicate: If multiple interactions exist between same atom pair, prioritize Strong > Weak.
  // SB > HB > HP
  const uniqueInteractions: Interaction[] = [];
  const pairMap = new Map<string, Interaction>();

  interactions.forEach(i => {
      const key = `${i.ligandAtom.index}-${i.proteinAtom.index}`;
      const existing = pairMap.get(key);
      if (!existing) {
          pairMap.set(key, i);
      } else {
          // Hierarchy: SB > HB > Pi > HP
          const typeScore = (t: InteractionType) => {
              if (t === InteractionType.SaltBridge) return 4;
              if (t === InteractionType.PiStacking) return 3;
              if (t === InteractionType.HydrogenBond) return 2;
              return 1;
          };
          if (typeScore(i.type) > typeScore(existing.type)) {
              pairMap.set(key, i);
          }
      }
  });
  
  return { interactions: Array.from(pairMap.values()), ligandCenter };
};
