
export const MAX_INTERACTION_DIST = 7.5; // Expanded for Pi-Stacking centers

// Interaction Thresholds (Angstroms & Degrees) - ALIGNED WITH PLIP
export const THRESHOLDS = {
  HBOND_DIST: 4.1, // PLIP uses 4.1A for heavy atom distance
  HBOND_ANGLE: 90, // Min Angle at donor heavy atom
  SALT_BRIDGE_DIST: 5.5, // PLIP default for attractive charge interactions
  HYDROPHOBIC_DIST: 4.0, // PLIP standard for C-C contacts
  PI_STACKING_DIST: 7.5, // Centroid-Centroid max
  PI_STACKING_OFFSET: 2.0, // Max offset for parallel
  PI_STACKING_ANGLE_PARALLEL: 30, // Max deviation
  PI_STACKING_ANGLE_TSHAPED: 60, // Min angle
  PI_CATION_DIST: 6.0, // Ring center to charge center
  HALOGEN_DIST: 4.0,
  METAL_DIST: 3.0,
};

// Residue Definitions
export const RESIDUE_PROPS = {
  HYDROPHOBIC: new Set(['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TRP', 'PRO', 'CYS']),
  AROMATIC: new Set(['PHE', 'TYR', 'TRP', 'HIS']),
  POSITIVE: new Set(['ARG', 'LYS', 'HIS']),
  NEGATIVE: new Set(['ASP', 'GLU']),
};

// Explicit Ligand Names to always detect (even if not HETATM)
export const COMMON_LIGANDS = new Set(['LIG', 'UNK', 'DRG', 'INH', '001', '1']);
export const IGNORED_RESIDUES = new Set(['HOH', 'DOD', 'TIP', 'WAT', 'SOL', 'NA', 'CL', 'K', 'MG', 'ZN', 'CA', 'MN', 'SO4', 'PO4']);

// Atom Definitions for specific interaction types
export const ATOM_PROPS = {
  // Protein Side Chain Charge Centers
  POS_CHARGE_ATOMS: {
    'ARG': ['NH1', 'NH2', 'CZ'], // Guanidinium group
    'LYS': ['NZ'],
    'HIS': ['ND1', 'NE2'] 
  },
  NEG_CHARGE_ATOMS: {
    'ASP': ['OD1', 'OD2'],
    'GLU': ['OE1', 'OE2']
  },
  // Protein Aromatic Ring Atoms (for Centroid calc)
  AROMATIC_PLANES: {
    'PHE': ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
    'TYR': ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
    'TRP': ['CG', 'CD1', 'CD2', 'NE1', 'CE2', 'CE3', 'CZ2', 'CZ3', 'CH2'],
    'HIS': ['CG', 'ND1', 'CD2', 'CE1', 'NE2']
  },
  // General
  // Donors: N or O bonded to H. In PDB we assume N/O unless specific non-donor types.
  // We treat all N/O as potential donors/acceptors in simplified mode, refined by geometry.
  DONORS: new Set(['N', 'O', 'S', 'F']), 
  ACCEPTORS: new Set(['N', 'O', 'S', 'F', 'CL', 'BR', 'I']),
  HALOGENS: new Set(['F', 'CL', 'BR', 'I']),
  METALS: new Set(['ZN', 'MG', 'FE', 'CU', 'CA', 'NA', 'K', 'MN', 'CO', 'NI']),
};
