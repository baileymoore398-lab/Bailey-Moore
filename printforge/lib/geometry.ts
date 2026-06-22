// Geometry analysis for uploaded 3D models.
//
// The instant-quote engine needs the solid VOLUME of a mesh to estimate
// material usage. For binary STL we compute it exactly using the signed
// tetrahedron method (sum of signed volumes of tetrahedra formed by each
// triangle and the origin). For ASCII STL we parse the facet vertices.
// For formats we don't fully parse here (OBJ/3MF/STEP) we fall back to a
// bounding-box heuristic so the customer still gets an immediate estimate;
// these are flagged for operator confirmation.

export interface MeshAnalysis {
  volumeCm3: number;
  bbox: { x: number; y: number; z: number }; // mm
  triangles: number;
  // true when volume is exact (parsed mesh) vs. estimated (heuristic)
  exact: boolean;
}

type Vec3 = [number, number, number];

function signedTetraVolume(a: Vec3, b: Vec3, c: Vec3): number {
  // (a · (b × c)) / 6
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  ) / 6.0;
}

function isBinarySTL(buf: Buffer): boolean {
  // ASCII STL begins with "solid"; but some binary files also do, so verify
  // the file size matches the binary triangle count layout.
  if (buf.length < 84) return false;
  const triangles = buf.readUInt32LE(80);
  const expected = 84 + triangles * 50;
  if (expected === buf.length) return true;
  const header = buf.toString("ascii", 0, 5).toLowerCase();
  return header !== "solid";
}

function analyzeBinarySTL(buf: Buffer): MeshAnalysis {
  const triangles = buf.readUInt32LE(80);
  let volume = 0; // mm^3
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let offset = 84;
  for (let i = 0; i < triangles; i++) {
    // skip 12 bytes normal
    const vBase = offset + 12;
    const verts: Vec3[] = [];
    for (let v = 0; v < 3; v++) {
      const p = vBase + v * 12;
      const x = buf.readFloatLE(p);
      const y = buf.readFloatLE(p + 4);
      const z = buf.readFloatLE(p + 8);
      verts.push([x, y, z]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    volume += signedTetraVolume(verts[0], verts[1], verts[2]);
    offset += 50; // 12 normal + 36 verts + 2 attr
  }

  return {
    volumeCm3: Math.abs(volume) / 1000.0, // mm^3 -> cm^3
    bbox: {
      x: round2(maxX - minX),
      y: round2(maxY - minY),
      z: round2(maxZ - minZ)
    },
    triangles,
    exact: true
  };
}

function analyzeAsciiSTL(text: string): MeshAnalysis {
  const nums = text.match(/vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g) || [];
  let volume = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const verts: Vec3[] = [];
  for (const line of nums) {
    const m = line.match(/vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/)!;
    const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
    verts.push([x, y, z]);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  for (let i = 0; i + 2 < verts.length; i += 3) {
    volume += signedTetraVolume(verts[i], verts[i + 1], verts[i + 2]);
  }
  return {
    volumeCm3: Math.abs(volume) / 1000.0,
    bbox: {
      x: round2(maxX - minX),
      y: round2(maxY - minY),
      z: round2(maxZ - minZ)
    },
    triangles: Math.floor(verts.length / 3),
    exact: true
  };
}

// OBJ: parse v lines + f faces (triangulate fans) for an exact volume.
function analyzeOBJ(text: string): MeshAnalysis {
  const positions: Vec3[] = [];
  let volume = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("v ")) {
      const p = line.split(/\s+/);
      const x = parseFloat(p[1]), y = parseFloat(p[2]), z = parseFloat(p[3]);
      positions.push([x, y, z]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    } else if (line.startsWith("f ")) {
      const idx = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((tok) => parseInt(tok.split("/")[0], 10))
        .map((i) => (i < 0 ? positions.length + i : i - 1));
      // triangulate polygon fan
      for (let i = 1; i + 1 < idx.length; i++) {
        const a = positions[idx[0]];
        const b = positions[idx[i]];
        const c = positions[idx[i + 1]];
        if (a && b && c) volume += signedTetraVolume(a, b, c);
      }
    }
  }
  return {
    volumeCm3: Math.abs(volume) / 1000.0,
    bbox: {
      x: round2(maxX - minX),
      y: round2(maxY - minY),
      z: round2(maxZ - minZ)
    },
    triangles: positions.length,
    exact: positions.length > 0
  };
}

function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Analyse a model file buffer. `filename` is used to pick the parser.
 * Falls back to a conservative bounding-box-based estimate when the format
 * isn't parseable here (STEP, 3MF zip), still returning a usable volume.
 */
export function analyzeModel(filename: string, buf: Buffer): MeshAnalysis {
  const ext = filename.toLowerCase().split(".").pop() || "";
  try {
    if (ext === "stl") {
      if (isBinarySTL(buf)) return analyzeBinarySTL(buf);
      return analyzeAsciiSTL(buf.toString("utf8"));
    }
    if (ext === "obj") {
      return analyzeOBJ(buf.toString("utf8"));
    }
  } catch {
    // fall through to heuristic
  }

  // STEP / 3MF / unknown: estimate from byte size as a stand-in until an
  // operator confirms with proper CAD tooling (OpenSCAD/MeshLab/Blender).
  // ~1 cm^3 of typical mesh ≈ a few KB; clamp to a reasonable range.
  const estCm3 = Math.min(500, Math.max(2, buf.length / 4000));
  const side = Math.cbrt(estCm3) * 10; // mm
  return {
    volumeCm3: round2(estCm3),
    bbox: { x: round2(side), y: round2(side), z: round2(side) },
    triangles: 0,
    exact: false
  };
}
