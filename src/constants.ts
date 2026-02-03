
export const MAX_INTERACTION_DIST = 6.0; // Max distance for any interaction search

// Interaction Thresholds (Angstroms & Degrees) - SCIENTIFICALLY CORRECTED
export const THRESHOLDS = {
  HBOND_DIST: 3.5, // Heavy atom donor-acceptor distance
  HBOND_ANGLE: 120, // Donor-H-Acceptor angle (≥120°, ≥130° preferred)
  SALT_BRIDGE_DIST: 4.0, // Between charged heavy atoms
  HYDROPHOBIC_DIST: 4.5, // Nonpolar carbon contacts (aliphatic/aromatic)
  PI_STACKING_DIST: 5.5, // Centroid-centroid max
  PI_STACKING_OFFSET: 2.0, // Max offset for parallel stacking
  PI_STACKING_ANGLE_PARALLEL: 30, // Max deviation from parallel
  PI_STACKING_ANGLE_TSHAPED: 60, // Min angle for T-shaped
  PI_CATION_DIST: 5.0, // Ring center to charge center
  HALOGEN_DIST: 3.5, // Halogen bond distance
  HALOGEN_ANGLE: 140, // C-X···A angle (strong directionality)
  METAL_DIST: 2.8, // General metal coordination (varies by metal)
};

// Residue Definitions
export const RESIDUE_PROPS = {
  HYDROPHOBIC: new Set(['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TRP', 'PRO', 'CYS']),
  AROMATIC: new Set(['PHE', 'TYR', 'TRP', 'HIS']),
  POSITIVE: new Set(['ARG', 'LYS', 'HIS']),
  NEGATIVE: new Set(['ASP', 'GLU']),
};

// Explicit Ligand Names to always detect (even if not HETATM)
// Includes common drug-like ligands and carbohydrate/polymer residues
export const COMMON_LIGANDS = new Set([
  // Generic ligand names
  'LIG', 'UNK', 'DRG', 'INH', '001', '1',
  // Carbohydrates/Glycans (often appear as ATOM not HETATM)
  'NAG', 'NDG', 'MAN', 'BMA', 'GAL', 'GLC', 'FUC', 'SIA', 'BGC',
  'BGLC', 'BGLCC', 'AGLC', 'AGLCA', // Beta/Alpha glucose variants
  'GLA', 'GUP', 'XYL', 'RIB', 'ARA', // Other sugars
  // Lipids/Fatty acids
  'PLM', 'OLA', 'MYR', 'STE',
  // Common cofactors
  'ATP', 'ADP', 'AMP', 'GTP', 'GDP', 'NAD', 'NADP', 'FAD', 'FMN', 'HEM', 'HEC'
]);
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
  // Donors: N or O bonded to H. S can also donate in some cases (thiols).
  // Fluorine is NOT a routine H-bond participant in biological systems.
  DONORS: new Set(['N', 'O', 'S']),
  ACCEPTORS: new Set(['N', 'O', 'S']),
  // Halogen bond donors: Cl, Br, I (F has weak σ-hole, rarely forms halogen bonds)
  HALOGENS: new Set(['CL', 'BR', 'I']),
  METALS: new Set(['ZN', 'MG', 'FE', 'CU', 'CA', 'NA', 'K', 'MN', 'CO', 'NI']),
};
