
export interface AtomData {
  index: number;
  name: string;
  element: string;
  x: number;
  y: number;
  z: number;
  resName: string;
  resNo: number;
  chain: string;
  isHet: boolean;
}

export const InteractionType = {
  HydrogenBond: 'Hydrogen Bond',
  Hydrophobic: 'Hydrophobic',
  SaltBridge: 'Salt Bridge',
  PiStacking: 'Pi-Stacking',
  HalogenBond: 'Halogen Bond',
  MetalCoordination: 'Metal Coordination',
  Unknown: 'Unknown'
} as const;

export type InteractionType = typeof InteractionType[keyof typeof InteractionType];

export interface Interaction {
  id: string;
  type: InteractionType;
  distance: number;
  ligandAtom: AtomData;
  proteinAtom: AtomData;
  angle?: number;
}

export interface ResidueOption {
  resName: string;
  resNo: number;        // Primary residue number (first in chain)
  resNos?: number[];    // All residue numbers (for polymer chains like glucans)
  chain: string;
  atomCount: number;
}

export interface AnalysisResult {
  interactions: Interaction[];
  ligandCenter: { x: number; y: number; z: number };
}
