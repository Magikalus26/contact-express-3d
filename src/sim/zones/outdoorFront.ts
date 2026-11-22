import * as THREE from 'three';
import {
  MaterialLibrary,
  addBoxCollider,
  buildInstancedMesh,
  InstanceEntry,
  registerInteractableBox,
} from '../materials';
import { ProceduralTextureBank } from '../textures';
import { WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';
import { Atm1990Controller, buildAtm1990 } from './atm1990';
import { buildMonnayeur1990 } from './monnayeur1990';
import { soundSynth } from '../audio';

export function buildArchitectureAndOutdoorFront(
  ctx: WorldBuildContext,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  getPlayerPos: () => THREE.Vector3,
  wallet: PlayerWallet,
  onWalletChanged: () => void,
  onStoreLightsChanged?: (on: boolean) => void
): { toggleStoreLights: (on: boolean) => void; atmController: Atm1990Controller } {
  const group = new THREE.Group();
  ctx.scene.add(group);

  // ============================================================================
  // 1. NATURAL HORIZON & GROUND SURFACES (No floating void walls!)
  // ============================================================================
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x4b6b3e,
    roughness: 0.95,
    metalness: 0.0,
  });
  ctx.disposables.push(grassMat);

  // Wide surrounding countryside/suburban ground plane at Y = -1.05 (below loading dock yard)
  const terrainGeo = new THREE.PlaneGeometry(180, 180);
  ctx.disposables.push(terrainGeo);
  const terrain = new THREE.Mesh(terrainGeo, grassMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.02;
  terrain.receiveShadow = true;
  group.add(terrain);

  // Raised plinth under building + front parking (Z = -14.8 to +18.0, X = -14 to +14) up to Y = 0
  const plinthGeo = new THREE.BoxGeometry(28, 1.02, 32.8);
  ctx.disposables.push(plinthGeo);
  const plinth = new THREE.Mesh(plinthGeo, mats.concreteDark);
  plinth.position.set(0, -0.51, 1.6);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Front Parking Asphalt Surface (X = -13 to +13, Z = +7.0 to +17.5)
  const parkingGeo = new THREE.PlaneGeometry(26, 10.5);
  ctx.disposables.push(parkingGeo);
  const parking = new THREE.Mesh(parkingGeo, mats.asphalt);
  parking.rotation.x = -Math.PI / 2;
  parking.position.set(0, 0.008, 12.25);
  parking.receiveShadow = true;
  group.add(parking);

  // Pedestrian Concrete Sidewalk Apron (Z = +7.0 to +9.2, X = -10.5 to +10.5)
  const sidewalkGeo = new THREE.BoxGeometry(21.0, 0.03, 2.2);
  ctx.disposables.push(sidewalkGeo);
  const sidewalk = new THREE.Mesh(sidewalkGeo, mats.concrete);
  sidewalk.position.set(0, 0.015, 8.1);
  sidewalk.receiveShadow = true;
  group.add(sidewalk);

  // Sales Floor Porcelain Tiles (20m x 14m = 280 m², X = -10 to +10, Z = -7 to +7)
  const salesFloorGeo = new THREE.PlaneGeometry(20.0, 14.0);
  ctx.disposables.push(salesFloorGeo);
  const salesFloor = new THREE.Mesh(salesFloorGeo, mats.salesTile);
  salesFloor.rotation.x = -Math.PI / 2;
  salesFloor.position.set(0, 0.006, 0);
  salesFloor.receiveShadow = true;
  group.add(salesFloor);

  // Recessed Dark-Grey Ribbed Entrance Doormat ("Tapis-Brosse Encastré" — Exterior Apron & Interior Threshold)
  {
    const matDarkMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.96,
      metalness: 0.02,
    });
    const matRibMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.92,
      metalness: 0.04,
    });
    const matTrimGeoFB = new THREE.BoxGeometry(2.58, 0.018, 0.055);
    const matTrimGeoLR = new THREE.BoxGeometry(0.055, 0.018, 1.18);
    const matBodyGeo = new THREE.BoxGeometry(2.48, 0.014, 1.08);
    const matRibGeo = new THREE.BoxGeometry(2.42, 0.005, 0.048);
    ctx.disposables.push(matDarkMat, matRibMat, matTrimGeoFB, matTrimGeoLR, matBodyGeo, matRibGeo);

    const buildRecessedMat = (zCenter: number, yBase: number) => {
      const mGrp = new THREE.Group();
      mGrp.position.set(0, yBase, zCenter);
      const body = new THREE.Mesh(matBodyGeo, matDarkMat);
      body.position.y = 0.007;
      body.receiveShadow = true;
      const trimN = new THREE.Mesh(matTrimGeoFB, mats.galvanized);
      trimN.position.set(0, 0.009, -0.56);
      const trimS = new THREE.Mesh(matTrimGeoFB, mats.galvanized);
      trimS.position.set(0, 0.009, 0.56);
      const trimL = new THREE.Mesh(matTrimGeoLR, mats.galvanized);
      trimL.position.set(-1.265, 0.009, 0);
      const trimR = new THREE.Mesh(matTrimGeoLR, mats.galvanized);
      trimR.position.set(1.265, 0.009, 0);
      mGrp.add(body, trimN, trimS, trimL, trimR);
      for (let rz = -0.42; rz <= 0.43; rz += 0.14) {
        const rib = new THREE.Mesh(matRibGeo, matRibMat);
        rib.position.set(0, 0.0155, rz);
        mGrp.add(rib);
      }
      group.add(mGrp);
    };

    // Interior recessed mat (just inside threshold) + Exterior recessed mat (on concrete sidewalk apron)
    buildRecessedMat(6.22, 0.006);
    buildRecessedMat(7.72, 0.03);
  }

  // Low perimeter concrete curbs around front parking (keeps player inside playable 160m² front zone naturally)
  const curbH = 0.24;
  const curbGeoFB = new THREE.BoxGeometry(22.4, curbH, 0.35);
  const curbGeoSide = new THREE.BoxGeometry(0.35, curbH, 10.6);
  ctx.disposables.push(curbGeoFB, curbGeoSide);

  const frontCurb = new THREE.Mesh(curbGeoFB, mats.concrete);
  frontCurb.position.set(0, curbH / 2, 16.8);
  group.add(frontCurb);
  addBoxCollider(ctx, 'parking_front_curb', -11.2, 11.2, 16.55, 17.2);

  const leftCurb = new THREE.Mesh(curbGeoSide, mats.concrete);
  leftCurb.position.set(-11.1, curbH / 2, 11.7);
  group.add(leftCurb);
  addBoxCollider(ctx, 'parking_left_curb', -11.4, -10.85, 6.8, 16.9);

  const rightCurb = new THREE.Mesh(curbGeoSide, mats.concrete);
  rightCurb.position.set(11.1, curbH / 2, 11.7);
  group.add(rightCurb);
  addBoxCollider(ctx, 'parking_right_curb', 10.85, 11.4, 6.8, 16.9);

  // Distant decorative suburban trees outside perimeter (InstancedMesh composite trunks + canopies)
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8);
  const canopyGeo = new THREE.DodecahedronGeometry(1.45, 1);
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  ctx.disposables.push(trunkGeo, canopyGeo, barkMat, leafMat);

  const treeCoords: Array<[number, number, number]> = [
    [-14.5, 18.5, 1.0],
    [-8.5, 20.5, 1.15],
    [-1.5, 21.2, 0.95],
    [6.0, 20.8, 1.1],
    [13.8, 18.8, 1.05],
    [-15.5, 8.0, 1.12],
    [-16.0, -3.0, 0.92],
    [15.5, 9.0, 1.08],
    [16.2, -4.0, 1.15],
    [-15.0, -16.0, 1.0],
    [15.2, -16.5, 1.1],
  ];
  const trunkEntries: InstanceEntry[] = [];
  const canopyEntries: InstanceEntry[] = [];
  const leafPalette = [0x3f6a34, 0x4d7c3f, 0x365b2d];
  treeCoords.forEach(([tx, tz, sc], idx) => {
    trunkEntries.push({ pos: [tx, -1.02 + 1.1 * sc, tz], scale: [sc, sc, sc] });
    canopyEntries.push({
      pos: [tx, -1.02 + 2.75 * sc, tz],
      rotY: idx * 1.1,
      scale: [sc, sc * 0.92, sc],
      color: leafPalette[idx % leafPalette.length],
    });
  });
  buildInstancedMesh(ctx, group, trunkGeo, barkMat, trunkEntries, false);
  const canopyInstanced = buildInstancedMesh(ctx, group, canopyGeo, leafMat, canopyEntries, false);

  // Subtle ambient wind-sway animation on parking-lot trees (1 InstancedMesh draw call, zero per-frame allocations)
  const treeSwayDummy = new THREE.Object3D();
  ctx.updaters.push({
    update: (_dt, elapsed) => {
      for (let idx = 0; idx < treeCoords.length; idx++) {
        const [tx, tz, sc] = treeCoords[idx];
        const phase = idx * 1.37;
        const swayX = Math.sin(elapsed * 1.15 + phase) * 0.065 + Math.sin(elapsed * 2.3 + phase * 0.7) * 0.022;
        const swayZ = Math.cos(elapsed * 0.95 + phase * 1.1) * 0.048;
        treeSwayDummy.position.set(tx + swayX * sc, -1.02 + 2.75 * sc, tz + swayZ * sc);
        treeSwayDummy.rotation.set(
          swayZ * 0.42,
          idx * 1.1 + swayX * 0.25,
          -swayX * 0.45
        );
        treeSwayDummy.scale.set(sc, sc * 0.92, sc);
        treeSwayDummy.updateMatrix();
        canopyInstanced.setMatrixAt(idx, treeSwayDummy.matrix);
      }
      canopyInstanced.instanceMatrix.needsUpdate = true;
    },
  });

  // ============================================================================
  // 2. PARKING MARKINGS, SPEED BUMPS, STREETLAMPS, BOLLARDS & ABRI CADDIES
  // ============================================================================
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  ctx.disposables.push(lineMat);

  const bayLineGeo = new THREE.PlaneGeometry(0.12, 4.4);
  ctx.disposables.push(bayLineGeo);
  // Right parking bays
  for (let bx = 1.8; bx <= 9.3; bx += 2.5) {
    const line = new THREE.Mesh(bayLineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(bx, 0.014, 14.3);
    group.add(line);
  }
  // Left parking bays (beside cart shelter)
  for (let bx = -4.2; bx <= -1.7; bx += 2.5) {
    const line = new THREE.Mesh(bayLineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(bx, 0.014, 14.3);
    group.add(line);
  }
  // Pedestrian zebra crossing from parking to entrance
  const zebraGeo = new THREE.PlaneGeometry(1.8, 0.34);
  ctx.disposables.push(zebraGeo);
  for (let zz = 9.6; zz <= 12.6; zz += 0.68) {
    const zStripe = new THREE.Mesh(zebraGeo, lineMat);
    zStripe.rotation.x = -Math.PI / 2;
    zStripe.position.set(0, 0.014, zz);
    group.add(zStripe);
  }

  // Yellow & Black Rubber Speed Bumps (Ralentisseurs)
  const bumpGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.6, 12, 1, false, 0, Math.PI);
  ctx.disposables.push(bumpGeo);
  [-3.2, 4.2].forEach((bx) => {
    const bump = new THREE.Mesh(bumpGeo, mats.hazardStripe);
    bump.rotation.z = Math.PI / 2;
    bump.rotation.y = 0;
    bump.scale.set(0.32, 1, 1);
    bump.position.set(bx, 0.008, 11.4);
    bump.receiveShadow = true;
    group.add(bump);
  });

  // Heavy Reinforced Concrete Anti-Ram Bollards ("Plots en béton anti-bélier")
  const bollardXs = [-8.4, -6.1, -3.8, -1.85, 1.85, 3.8, 6.1, 8.4];
  const bolBaseGeo = new THREE.CylinderGeometry(0.24, 0.27, 0.14, 16);
  const bolBodyGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.78, 16);
  const bolBandGeo = new THREE.CylinderGeometry(0.206, 0.209, 0.22, 16);
  const bolCapGeo = new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  ctx.disposables.push(bolBaseGeo, bolBodyGeo, bolBandGeo, bolCapGeo);

  bollardXs.forEach((bx, i) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.02, 8.85);

    const base = new THREE.Mesh(bolBaseGeo, mats.concreteDark);
    base.position.y = 0.07;
    const body = new THREE.Mesh(bolBodyGeo, mats.concrete);
    body.position.y = 0.52;
    body.castShadow = true;
    body.receiveShadow = true;
    const band = new THREE.Mesh(bolBandGeo, mats.hazardStripe);
    band.position.y = 0.7;
    const cap = new THREE.Mesh(bolCapGeo, mats.concrete);
    cap.position.y = 0.91;

    bGroup.add(base, body, band, cap);
    group.add(bGroup);

    addBoxCollider(ctx, `bollard_${i}`, bx - 0.24, bx + 0.24, 8.61, 9.09);
  });
  registerInteractableBox(ctx, group, {
    id: 'inspect_bollards',
    title: 'Plots en Béton Anti-Bélier',
    subtitle: 'Sécurité Façade · Zone Parking',
    kind: 'inspect',
    inspectText:
      'Rangée de 8 plots cylindriques en béton armé haute densité équipés de bandes rétroréfléchissantes jaune/noir protégeant la façade vitrée et le DAB.',
    specs: 'Ø 400 mm · Hauteur 950 mm · Béton C40/50',
    size: [0.65, 1.1, 0.65],
    position: [-1.85, 0.55, 8.85],
  });

  // Streetlamps (Lampadaires de parking) with toggleable luminaires
  const streetLampLights: THREE.PointLight[] = [];
  const streetLampBulbs: THREE.MeshStandardMaterial[] = [];
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, 5.2, 10);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.1);
  const headGeo = new THREE.BoxGeometry(0.36, 0.1, 0.58);
  ctx.disposables.push(poleGeo, armGeo, headGeo);

  [-9.6, 9.6].forEach((lx, idx) => {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(lx, 0, 15.6);

    const pole = new THREE.Mesh(poleGeo, mats.galvanized);
    pole.position.y = 2.6;
    pole.castShadow = true;
    const arm = new THREE.Mesh(armGeo, mats.galvanized);
    arm.position.set(0, 5.15, -0.45);
    const head = new THREE.Mesh(headGeo, mats.anthracite);
    head.position.set(0, 5.12, -0.85);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.6,
    });
    ctx.disposables.push(bulbMat);
    streetLampBulbs.push(bulbMat);

    const lensGeo = new THREE.PlaneGeometry(0.28, 0.46);
    ctx.disposables.push(lensGeo);
    const lens = new THREE.Mesh(lensGeo, bulbMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 5.06, -0.85);

    const pLight = new THREE.PointLight(0xfde68a, 4.5, 14, 1.8);
    pLight.position.set(0, 4.85, -0.85);
    streetLampLights.push(pLight);

    lampGroup.add(pole, arm, head, lens, pLight);
    group.add(lampGroup);
    addBoxCollider(ctx, `streetlamp_${idx}`, lx - 0.22, lx + 0.22, 15.38, 15.82);

    registerInteractableBox(ctx, lampGroup, {
      id: `streetlamp_toggle_${idx}`,
      title: `Lampadaire Parking #${idx + 1}`,
      subtitle: 'Éclairage Extérieur LED',
      kind: 'power_toggle',
      initialState: true,
      inspectText: 'Mât en acier galvanisé avec luminaire LED blanc chaud basse consommation.',
      size: [0.55, 2.4, 0.55],
      position: [0, 1.2, 0],
      onToggle: (on) => {
        pLight.intensity = on ? 4.5 : 0;
        bulbMat.emissiveIntensity = on ? 1.6 : 0;
      },
    });
  });

  // Galvanized Steel Shopping Cart Shelter ("Abri Caddies") + Nested 3D Metal Carts
  buildCartShelter(ctx, group, mats, texBank, -7.4, 13.4);

  // ============================================================================
  // 3. MAIN BUILDING ENVELOPE & STOREFRONT FACADE (X = -10..+10, Z = -13..+7)
  // ============================================================================
  const wallH = 4.2;
  const wallThick = 0.26;

  // Roof ceiling slab over Sales Floor & Warehouse (X = -10.2 to +10.2, Z = -13.2 to +7.2)
  const roofGeo = new THREE.BoxGeometry(20.4, 0.28, 20.4);
  ctx.disposables.push(roofGeo);
  const roofSlab = new THREE.Mesh(roofGeo, mats.wallPlaster);
  roofSlab.position.set(0, wallH + 0.14, -3.0);
  roofSlab.castShadow = true;
  roofSlab.receiveShadow = true;
  group.add(roofSlab);

  // Exterior Roof Coping Fascia Band
  const fasciaGeo = new THREE.BoxGeometry(20.6, 0.75, 20.6);
  ctx.disposables.push(fasciaGeo);
  const fascia = new THREE.Mesh(fasciaGeo, mats.facadeCladding);
  fascia.position.set(0, wallH + 0.36, -3.0);
  group.add(fascia);

  // Left Exterior Wall (X = -10.0, Z = -13.0 to +7.0)
  const sideWallGeo = new THREE.BoxGeometry(wallThick, wallH, 20.0);
  ctx.disposables.push(sideWallGeo);
  const leftWall = new THREE.Mesh(sideWallGeo, mats.wallPlaster);
  leftWall.position.set(-10.0, wallH / 2, -3.0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);
  addBoxCollider(ctx, 'wall_west', -10.2, -9.84, -13.1, 7.1);

  // Right Exterior Wall (X = +10.0, Z = -13.0 to +7.0)
  const rightWall = new THREE.Mesh(sideWallGeo, mats.wallPlaster);
  rightWall.position.set(10.0, wallH / 2, -3.0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);
  addBoxCollider(ctx, 'wall_east', 9.84, 10.2, -13.1, 7.1);

  // Storefront Wall at Z = +7.0:
  // Segments:
  // - Left corner pier: X = -10.0 to -6.3
  // - Left double-glazed window bay: X = -6.3 to -1.45 (low sill 0..0.55, glass 0.55..3.1, lintel 3.1..4.2)
  // - Entrance portal: X = -1.45 to +1.45 (clear opening 0..2.55, lintel 2.55..4.2)
  // - Right double-glazed window bay: X = +1.45 to +6.0
  // - Recessed DAB & Monnayeur Alcove: X = +6.0 to +10.0 (recessed back to Z = +6.35)

  const addWallBlock = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    colliderId?: string
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    ctx.disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (colliderId) {
      addBoxCollider(ctx, colliderId, x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
    return m;
  };

  // Left corner solid pier
  addWallBlock(3.7, wallH, wallThick, -8.15, wallH / 2, 7.0, mats.facadeCladding, 'front_pier_left');
  // Left window sill & lintel + glass
  addWallBlock(4.85, 0.55, wallThick, -3.875, 0.275, 7.0, mats.facadeCladding, 'front_win_left_col');
  addWallBlock(4.85, 1.1, wallThick, -3.875, 3.65, 7.0, mats.facadeCladding);
  addWallBlock(4.75, 2.55, 0.06, -3.875, 1.825, 7.0, mats.clearGlass);
  // Mullions left window
  [-5.1, -3.875, -2.65].forEach((mx) => {
    addWallBlock(0.06, 2.55, 0.1, mx, 1.825, 7.0, mats.anthracite);
  });

  // Entrance header lintel & frame posts
  addWallBlock(2.9, 1.65, wallThick, 0, 3.375, 7.0, mats.facadeCladding);
  addWallBlock(0.14, 2.55, 0.28, -1.38, 1.275, 7.0, mats.anthracite, 'entrance_post_l');
  addWallBlock(0.14, 2.55, 0.28, 1.38, 1.275, 7.0, mats.anthracite, 'entrance_post_r');

  // Right window sill & lintel + glass
  addWallBlock(4.55, 0.55, wallThick, 3.725, 0.275, 7.0, mats.facadeCladding, 'front_win_right_col');
  addWallBlock(4.55, 1.1, wallThick, 3.725, 3.65, 7.0, mats.facadeCladding);
  addWallBlock(4.45, 2.55, 0.06, 3.725, 1.825, 7.0, mats.clearGlass);
  [2.6, 3.725, 4.85].forEach((mx) => {
    addWallBlock(0.06, 2.55, 0.1, mx, 1.825, 7.0, mats.anthracite);
  });

  // Recessed DAB & Monnayeur Architectural Alcove (X = +6.0 to +10.0)
  // Side cheeks + recessed back wall at Z = +6.42 (separating exterior alcove from Manager's Office inside)
  addWallBlock(0.24, wallH, 0.72, 6.12, wallH / 2, 6.76, mats.facadeCladding, 'alcove_cheek_l');
  addWallBlock(3.8, wallH, 0.24, 8.0, wallH / 2, 6.42, mats.facadeCladding, 'alcove_back_wall');
  addWallBlock(3.8, 1.15, 0.72, 8.0, 3.625, 6.76, mats.facadeCladding);

  // Build Detailed Recessed 1990 French ATM (NCR/Bull CB 1990) & Monnayeur Automatique inside alcove (facing +Z at Z = 6.66)
  const atmController = buildExteriorAtmAndMonnayeur(ctx, group, mats, wallet, onWalletChanged);

  // ============================================================================
  // 3B. V26 COMPLETE 360° EXTERIOR BUILDING ENVELOPE & 1990 RETAIL ARCHITECTURE
  //     (Front Facade, Left & Right Side Walls, Rear Warehouse Wall)
  //     - Textured cast-concrete lower foundation plinth (soubassement béton)
  //     - Vertical ribbed 1990 corrugated steel cladding (bardage nervuré)
  //     - Wrap-around horizontal navy / crimson / cream 1990 retail stripe
  //     - Roofline cornice trim & 6 vertical galvanized rainwater downspouts
  //     - 2 Red-trimmed Emergency Exit Doors ("Sortie de Secours") + panic bars
  //     - 4 External industrial ventilation grilles & 6 wall-mounted floodlights
  // ============================================================================
  {
    const extGroup = new THREE.Group();
    group.add(extGroup);

    const addExtCladPlane = (
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      rotY: number,
      mat: THREE.Material
    ) => {
      const g = new THREE.PlaneGeometry(w, h);
      ctx.disposables.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.receiveShadow = true;
      extGroup.add(m);
      return m;
    };

    // --- 1) Textured Cast-Concrete Lower Foundation Plinth (Y = 0..0.78m) ---
    const plinthH = 0.78;
    // West & East full side walls (X = ±10.142, Z = -13.14..+7.14)
    addExtCladPlane(20.28, plinthH, -10.142, plinthH / 2, -3.0, -Math.PI / 2, mats.concretePlinth);
    addExtCladPlane(20.28, plinthH, 10.142, plinthH / 2, -3.0, Math.PI / 2, mats.concretePlinth);
    // Front solid left pier + low sills under display windows
    addExtCladPlane(3.84, plinthH, -8.22, plinthH / 2, 7.142, 0, mats.concretePlinth);
    addExtCladPlane(4.85, 0.55, -3.875, 0.275, 7.142, 0, mats.concretePlinth);
    addExtCladPlane(4.55, 0.55, 3.725, 0.275, 7.142, 0, mats.concretePlinth);
    // Rear wall plinth left & right of dock portal (Z = -13.142, facing -Z)
    addExtCladPlane(6.74, plinthH, -6.77, plinthH / 2, -13.142, Math.PI, mats.concretePlinth);
    addExtCladPlane(9.14, plinthH, 5.57, plinthH / 2, -13.142, Math.PI, mats.concretePlinth);
    // Lower concrete foundation skirt down to yard grade (Y = -0.95..0) outside the dock & stairs
    addExtCladPlane(4.94, 0.96, -7.67, -0.47, -13.142, Math.PI, mats.concreteDark);
    addExtCladPlane(5.24, 0.96, 7.52, -0.47, -13.142, Math.PI, mats.concreteDark);
    // Crisp concrete plinth top drip-cap ledge wrapping the building at Y = 0.79m
    const addPlinthCap = (w: number, d: number, x: number, z: number) => {
      const g = new THREE.BoxGeometry(w, 0.055, d);
      ctx.disposables.push(g);
      const m = new THREE.Mesh(g, mats.concrete);
      m.position.set(x, plinthH + 0.015, z);
      m.castShadow = true;
      m.receiveShadow = true;
      extGroup.add(m);
    };
    addPlinthCap(0.08, 20.34, -10.16, -3.0);
    addPlinthCap(0.08, 20.34, 10.16, -3.0);
    addPlinthCap(3.88, 0.08, -8.22, 7.16);
    addPlinthCap(6.76, 0.08, -6.76, -13.16);
    addPlinthCap(9.16, 0.08, 5.56, -13.16);

    // --- 2) Vertical Ribbed 1990 Corrugated Steel Cladding (Y = 0.78..4.22m) ---
    const cladH = wallH - plinthH + 0.02;
    const cladMidY = plinthH + cladH / 2;
    // West & East full side facades
    addExtCladPlane(20.28, cladH, -10.142, cladMidY, -3.0, -Math.PI / 2, mats.corrugatedCladding);
    addExtCladPlane(20.28, cladH, 10.142, cladMidY, -3.0, Math.PI / 2, mats.corrugatedCladding);
    // Front solid left pier + upper transom fascia above display windows & DAB alcove
    addExtCladPlane(3.84, cladH, -8.22, cladMidY, 7.142, 0, mats.corrugatedCladding);
    addExtCladPlane(12.3, 1.12, -0.15, 3.66, 7.142, 0, mats.corrugatedCladding);
    addExtCladPlane(4.14, 1.16, 8.07, 3.64, 7.142, 0, mats.corrugatedCladding);
    // Rear warehouse wall (left, right, and lintel above dock portal X = -3.4..+1.0)
    addExtCladPlane(6.74, cladH, -6.77, cladMidY, -13.142, Math.PI, mats.corrugatedCladding);
    addExtCladPlane(9.14, cladH, 5.57, cladMidY, -13.142, Math.PI, mats.corrugatedCladding);
    addExtCladPlane(4.4, 1.16, -1.2, 3.64, -13.142, Math.PI, mats.corrugatedCladding);

    // --- 3) Decorative 1990 Horizontal Navy / Crimson / Cream Retail Stripe Wrapping All 4 Sides ---
    // Sits cleanly at Y = 3.58..3.94m on West, East, Rear, and Front flanks framing the V22 lightbox sign!
    const addStripeRun = (w: number, d: number, x: number, z: number) => {
      const gNavy = new THREE.BoxGeometry(w, 0.2, d);
      const gRed = new THREE.BoxGeometry(w, 0.1, d);
      const gCream = new THREE.BoxGeometry(w, 0.04, d);
      ctx.disposables.push(gNavy, gRed, gCream);
      const mNavy = new THREE.Mesh(gNavy, mats.retailStripeNavy);
      mNavy.position.set(x, 3.84, z);
      const mRed = new THREE.Mesh(gRed, mats.retailStripeRed);
      mRed.position.set(x, 3.69, z);
      const mCream = new THREE.Mesh(gCream, mats.retailStripeCream);
      mCream.position.set(x, 3.62, z);
      extGroup.add(mNavy, mRed, mCream);
    };
    // West & East full runs
    addStripeRun(0.055, 20.36, -10.17, -3.0);
    addStripeRun(0.055, 20.36, 10.17, -3.0);
    // Rear full run
    addStripeRun(20.36, 0.055, 0, -13.17);
    // Front symmetrical flanking runs outside the V22 lightbox sign (X = -5.75..+5.75)
    addStripeRun(4.44, 0.055, -7.96, 7.17);
    addStripeRun(4.44, 0.055, 7.96, 7.17);

    // --- 4) Roofline Cornice Trim Molding (Corniche Toiture) ---
    const addCorniceBar = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const g = new THREE.BoxGeometry(w, h, d);
      ctx.disposables.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      extGroup.add(m);
    };
    // Upper stainless coping cap all around roof perimeter at Y = 4.95m (clear of V22 lightbox top)
    addCorniceBar(20.78, 0.09, 0.14, 0, 4.95, 7.31, mats.stainless);
    addCorniceBar(20.78, 0.09, 0.14, 0, 4.95, -13.31, mats.stainless);
    addCorniceBar(0.14, 0.09, 20.78, -10.31, 4.95, -3.0, mats.stainless);
    addCorniceBar(0.14, 0.09, 20.78, 10.31, 4.95, -3.0, mats.stainless);
    // Lower dark anthracite cornice drip-edge molding at Y = 4.19m (stopping cleanly at V22 sign flanks on Front)
    addCorniceBar(0.16, 0.11, 20.72, -10.28, 4.19, -3.0, mats.anthracite);
    addCorniceBar(0.16, 0.11, 20.72, 10.28, 4.19, -3.0, mats.anthracite);
    addCorniceBar(20.72, 0.11, 0.16, 0, 4.19, -13.28, mats.anthracite);
    addCorniceBar(4.56, 0.11, 0.16, -8.04, 4.19, 7.28, mats.anthracite);
    addCorniceBar(4.56, 0.11, 0.16, 8.04, 4.19, 7.28, mats.anthracite);

    // --- 5) 6 Vertical Galvanized Rainwater Downspouts ("Gouttières") with Wall Clamps & Elbows ---
    const pipeGeo = new THREE.CylinderGeometry(0.048, 0.048, 4.08, 10);
    const hopperGeo = new THREE.BoxGeometry(0.2, 0.22, 0.2);
    const clampGeo = new THREE.BoxGeometry(0.13, 0.045, 0.13);
    const shoeGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.22, 10);
    ctx.disposables.push(pipeGeo, hopperGeo, clampGeo, shoeGeo);

    const downspoutCoords: Array<{ x: number; z: number; outwardX: number }> = [
      { x: -10.22, z: 6.55, outwardX: -1 },
      { x: -10.22, z: -3.0, outwardX: -1 },
      { x: -10.22, z: -12.6, outwardX: -1 },
      { x: 10.22, z: 6.55, outwardX: 1 },
      { x: 10.22, z: -3.0, outwardX: 1 },
      { x: 10.22, z: -12.6, outwardX: 1 },
    ];
    downspoutCoords.forEach((ds) => {
      const dsGrp = new THREE.Group();
      dsGrp.position.set(ds.x, 0, ds.z);
      extGroup.add(dsGrp);

      const pipe = new THREE.Mesh(pipeGeo, mats.galvanized);
      pipe.position.y = 2.18;
      pipe.castShadow = true;
      const hopper = new THREE.Mesh(hopperGeo, mats.galvanized);
      hopper.position.y = 4.12;
      const shoe = new THREE.Mesh(shoeGeo, mats.galvanized);
      shoe.position.set(ds.outwardX * 0.055, 0.14, 0);
      shoe.rotation.z = ds.outwardX * 0.65;
      dsGrp.add(pipe, hopper, shoe);

      [0.85, 2.1, 3.35].forEach((cy) => {
        const cl = new THREE.Mesh(clampGeo, mats.anthracite);
        cl.position.set(-ds.outwardX * 0.02, cy, 0);
        dsGrp.add(cl);
      });
    });

    // --- 6) 2 Red-Trimmed Emergency Exit Doors ("Sortie de Secours") with Stainless Panic Push-Bars ---
    const exitFrameVGeo = new THREE.BoxGeometry(0.1, 2.26, 0.12);
    const exitFrameHGeo = new THREE.BoxGeometry(1.24, 0.1, 0.12);
    const exitLeafGeo = new THREE.BoxGeometry(1.04, 2.14, 0.06);
    const exitKickGeo = new THREE.BoxGeometry(1.0, 0.34, 0.015);
    const exitPushBarGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.86, 10);
    exitPushBarGeo.rotateZ(Math.PI / 2);
    const exitBracketGeo = new THREE.BoxGeometry(0.05, 0.08, 0.08);
    const exitSignBoxGeo = new THREE.BoxGeometry(0.62, 0.24, 0.06);
    const exitSignFaceGeo = new THREE.PlaneGeometry(0.58, 0.2);
    const exitStepGeo = new THREE.BoxGeometry(1.42, 0.12, 0.56);
    ctx.disposables.push(
      exitFrameVGeo,
      exitFrameHGeo,
      exitLeafGeo,
      exitKickGeo,
      exitPushBarGeo,
      exitBracketGeo,
      exitSignBoxGeo,
      exitSignFaceGeo,
      exitStepGeo
    );

    const buildEmergencyExitDoor = (
      id: string,
      label: string,
      x: number,
      z: number,
      rotY: number
    ) => {
      const doorGrp = new THREE.Group();
      doorGrp.position.set(x, 0, z);
      doorGrp.rotation.y = rotY;
      extGroup.add(doorGrp);

      // Crimson red steel perimeter frame
      const fL = new THREE.Mesh(exitFrameVGeo, mats.retailStripeRed);
      fL.position.set(-0.57, 1.13, 0.02);
      const fR = new THREE.Mesh(exitFrameVGeo, mats.retailStripeRed);
      fR.position.set(0.57, 1.13, 0.02);
      const fT = new THREE.Mesh(exitFrameHGeo, mats.retailStripeRed);
      fT.position.set(0, 2.21, 0.02);

      // Heavy off-white painted steel door leaf + stainless lower kick-plate
      const leaf = new THREE.Mesh(exitLeafGeo, mats.whiteMetal);
      leaf.position.set(0, 1.09, 0.01);
      leaf.castShadow = true;
      const kick = new THREE.Mesh(exitKickGeo, mats.stainless);
      kick.position.set(0, 0.2, 0.044);

      // Horizontal stainless steel panic push-bar ("Barre Anti-Panique") + end mounts
      const bar = new THREE.Mesh(exitPushBarGeo, mats.stainless);
      bar.position.set(0, 1.02, 0.095);
      const brL = new THREE.Mesh(exitBracketGeo, mats.anthracite);
      brL.position.set(-0.42, 1.02, 0.06);
      const brR = new THREE.Mesh(exitBracketGeo, mats.anthracite);
      brR.position.set(0.42, 1.02, 0.06);

      // Illuminated green "SORTIE DE SECOURS" wall plaque above the frame
      const signBox = new THREE.Mesh(exitSignBoxGeo, mats.anthracite);
      signBox.position.set(0, 2.48, 0.03);
      const signFace = new THREE.Mesh(exitSignFaceGeo, mats.emergencyExitSign);
      signFace.position.set(0, 2.48, 0.064);

      // Concrete landing step
      const step = new THREE.Mesh(exitStepGeo, mats.concrete);
      step.position.set(0, 0.04, 0.28);
      step.receiveShadow = true;

      doorGrp.add(fL, fR, fT, leaf, kick, bar, brL, brR, signBox, signFace, step);

      registerInteractableBox(ctx, doorGrp, {
        id,
        title: label,
        subtitle: 'Issue de Secours — Barre Anti-Panique',
        kind: 'inspect',
        inspectText:
          'Porte coupe-feu métallique de sortie de secours (ouverture vers l’extérieur par barre anti-panique inox, alarme incendie 1990). Doit rester dégagée en permanence.',
        size: [1.3, 2.35, 0.35],
        position: [0, 1.2, 0.14],
      });
    };

    buildEmergencyExitDoor('ext_emergency_exit_west', 'Sortie de Secours — Façade Ouest', -10.15, -2.2, -Math.PI / 2);
    buildEmergencyExitDoor('ext_emergency_exit_east', 'Sortie de Secours — Façade Est', 10.15, -5.4, Math.PI / 2);

    // --- 7) 4 External Aluminum Industrial Ventilation Grilles ---
    const ventFrameGeo = new THREE.BoxGeometry(1.16, 0.72, 0.07);
    const ventFaceGeo = new THREE.PlaneGeometry(1.06, 0.62);
    ctx.disposables.push(ventFrameGeo, ventFaceGeo);

    const addVentGrille = (x: number, y: number, z: number, rotY: number) => {
      const vg = new THREE.Group();
      vg.position.set(x, y, z);
      vg.rotation.y = rotY;
      const frame = new THREE.Mesh(ventFrameGeo, mats.anthracite);
      const face = new THREE.Mesh(ventFaceGeo, mats.ventGrille);
      face.position.z = 0.038;
      vg.add(frame, face);
      extGroup.add(vg);
    };
    addVentGrille(-10.16, 2.55, -8.6, -Math.PI / 2);
    addVentGrille(10.16, 2.55, -9.4, Math.PI / 2);
    addVentGrille(10.16, 2.55, 0.8, Math.PI / 2);
    addVentGrille(6.4, 2.55, -13.16, Math.PI);

    // --- 8) 6 Exterior Wall-Mounted Security Floodlights (Emissive Lenses, Zero Extra PointLights for 60 FPS) ---
    const floodArmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.28);
    const floodHeadGeo = new THREE.BoxGeometry(0.32, 0.2, 0.14);
    const floodLensGeo = new THREE.PlaneGeometry(0.26, 0.14);
    const floodLensMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef3c7,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    ctx.disposables.push(floodArmGeo, floodHeadGeo, floodLensGeo, floodLensMat);

    const addWallFloodlight = (x: number, y: number, z: number, rotY: number) => {
      const fl = new THREE.Group();
      fl.position.set(x, y, z);
      fl.rotation.y = rotY;
      const arm = new THREE.Mesh(floodArmGeo, mats.anthracite);
      arm.position.set(0, 0, 0.14);
      const head = new THREE.Mesh(floodHeadGeo, mats.anthracite);
      head.position.set(0, -0.04, 0.28);
      head.rotation.x = 0.52;
      const lens = new THREE.Mesh(floodLensGeo, floodLensMat);
      lens.position.set(0, 0, 0.073);
      head.add(lens);
      fl.add(arm, head);
      extGroup.add(fl);
    };
    addWallFloodlight(-10.15, 3.42, 2.5, -Math.PI / 2);
    addWallFloodlight(-10.15, 3.42, -7.8, -Math.PI / 2);
    addWallFloodlight(10.15, 3.42, 1.5, Math.PI / 2);
    addWallFloodlight(10.15, 3.42, -8.5, Math.PI / 2);
    addWallFloodlight(-6.8, 3.42, -13.15, Math.PI);
    addWallFloodlight(5.8, 3.42, -13.15, Math.PI);
  }

  // ============================================================================
  // 4. AUTOMATIC SLIDING GLASS ENTRANCE DOORS, DUAL RADAR SENSORS (EXT + INT),
  //    REBUILT 1990 ILLUMINATED SIGNBOARD & FORECOURT 3D PROPS
  // ============================================================================
  const doorLeafGeo = new THREE.BoxGeometry(1.24, 2.36, 0.042);
  const doorHorizBarGeo = new THREE.BoxGeometry(1.32, 0.085, 0.068);
  const doorStileGeo = new THREE.BoxGeometry(0.055, 2.48, 0.068);
  const doorGasketGeo = new THREE.BoxGeometry(0.022, 2.46, 0.072);
  const doorSafetyBandGeo = new THREE.BoxGeometry(1.22, 0.085, 0.048);
  const doorTrackGeo = new THREE.BoxGeometry(5.3, 0.14, 0.22);
  ctx.disposables.push(
    doorLeafGeo,
    doorHorizBarGeo,
    doorStileGeo,
    doorGasketGeo,
    doorSafetyBandGeo,
    doorTrackGeo
  );

  // Anodized overhead sliding door operator transom beam
  const operatorBeam = new THREE.Mesh(doorTrackGeo, mats.anthracite);
  operatorBeam.position.set(0, 2.55, 7.0);
  operatorBeam.castShadow = true;
  group.add(operatorBeam);

  const buildSlidingLeaf = (initialX: number, innerEdgeSign: 1 | -1) => {
    const leaf = new THREE.Group();
    leaf.position.set(initialX, 1.25, 7.0);
    const glass = new THREE.Mesh(doorLeafGeo, mats.clearGlass);
    const topBar = new THREE.Mesh(doorHorizBarGeo, mats.anthracite);
    topBar.position.y = 1.2;
    const botBar = new THREE.Mesh(doorHorizBarGeo, mats.anthracite);
    botBar.position.y = -1.2;
    const stileL = new THREE.Mesh(doorStileGeo, mats.anthracite);
    stileL.position.x = -0.635;
    const stileR = new THREE.Mesh(doorStileGeo, mats.anthracite);
    stileR.position.x = 0.635;
    const meetingGasket = new THREE.Mesh(doorGasketGeo, mats.rubberBlack);
    meetingGasket.position.x = innerEdgeSign * 0.655;
    const safetyBand = new THREE.Mesh(doorSafetyBandGeo, mats.stainless);
    safetyBand.position.y = 0.04;
    const safetySubBand = new THREE.Mesh(doorSafetyBandGeo, mats.frostedGlass);
    safetySubBand.position.y = -0.11;
    safetySubBand.scale.y = 0.42;
    leaf.add(glass, topBar, botBar, stileL, stileR, meetingGasket, safetyBand, safetySubBand);
    group.add(leaf);
    return leaf;
  };

  const leftSlideLeaf = buildSlidingLeaf(-0.65, 1);
  const rightSlideLeaf = buildSlidingLeaf(0.65, -1);
  const leftDoorCol = addBoxCollider(ctx, 'auto_door_l', -1.3, 0.0, 6.88, 7.12, true);
  const rightDoorCol = addBoxCollider(ctx, 'auto_door_r', 0.0, 1.3, 6.88, 7.12, true);

  // Dual 3D Overhead Black Automatic Door Radar Sensors (Exterior +Z & Interior -Z) with Red -> Green Status LEDs
  const radarBodyMat = new THREE.MeshStandardMaterial({
    color: 0x16191f,
    roughness: 0.42,
    metalness: 0.18,
  });
  const radarLensMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.14,
    metalness: 0.35,
  });
  const radarLedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const radarBodyGeo = new THREE.BoxGeometry(0.38, 0.092, 0.11);
  const radarMountGeo = new THREE.BoxGeometry(0.42, 0.025, 0.04);
  const radarLensGeo = new THREE.BoxGeometry(0.28, 0.042, 0.024);
  const radarLedGeo = new THREE.SphereGeometry(0.015, 10, 8);
  const radarBezelGeo = new THREE.TorusGeometry(0.017, 0.004, 8, 12);
  ctx.disposables.push(
    radarBodyMat,
    radarLensMat,
    radarLedMat,
    radarBodyGeo,
    radarMountGeo,
    radarLensGeo,
    radarLedGeo,
    radarBezelGeo
  );

  const buildRadarSensorUnit = (zPos: number, facingSign: 1 | -1, idSuffix: string) => {
    const unit = new THREE.Group();
    unit.position.set(0, 2.66, zPos);
    if (facingSign < 0) {
      unit.rotation.y = Math.PI;
    }

    const mount = new THREE.Mesh(radarMountGeo, mats.anthracite);
    mount.position.set(0, 0.02, -0.045);
    const body = new THREE.Mesh(radarBodyGeo, radarBodyMat);
    body.castShadow = true;
    // Angled downward-facing infrared/radar optic window
    const lens = new THREE.Mesh(radarLensGeo, radarLensMat);
    lens.position.set(0, -0.016, 0.052);
    lens.rotation.x = 0.36;
    // Center status LED (Red standby -> Bright Green when player within 3.2m!)
    const led = new THREE.Mesh(radarLedGeo, radarLedMat);
    led.position.set(0, 0.02, 0.056);
    const bezel = new THREE.Mesh(radarBezelGeo, mats.chrome);
    bezel.position.set(0, 0.02, 0.054);

    unit.add(mount, body, lens, led, bezel);
    group.add(unit);

    registerInteractableBox(ctx, unit, {
      id: `radar_sensor_${idSuffix}`,
      title: 'Détecteur Radar Porte Automatique',
      subtitle:
        facingSign > 0
          ? 'Capteur Hyperfréquence Extérieur · Portée 3,2 m'
          : 'Capteur Hyperfréquence Intérieur · Portée 3,2 m',
      kind: 'inspect',
      inspectText:
        'Détecteur radar hyperfréquence 24 GHz à voyant LED bicolore : rouge en veille, vert lumineux dès détection piéton à moins de 3,2 m pour ouverture automatique.',
      specs: 'Portée 3,2 m · Double face Extérieur/Intérieur · Relais 24V',
      size: [0.48, 0.24, 0.22],
      position: [0, 0, 0.02],
    });
    return unit;
  };

  buildRadarSensorUnit(7.17, 1, 'ext');
  buildRadarSensorUnit(6.83, -1, 'int');

  let autoDoorLockedClosed = false;
  let slideOpenFactor = 0;
  let radarDetected = false;
  let doorAudioInitialized = false;

  ctx.updaters.push({
    update: (dt) => {
      const p = getPlayerPos();
      const distToDoor = Math.hypot(p.x, p.z - 7.0);
      // 3.2m activation threshold with tiny 0.15m release hysteresis so relay never chatters at edge
      const nextDetected =
        !autoDoorLockedClosed && (radarDetected ? distToDoor <= 3.35 : distToDoor <= 3.2);

      if (nextDetected !== radarDetected) {
        radarDetected = nextDetected;
        if (doorAudioInitialized) {
          soundSynth.playAutomaticDoorSlide(radarDetected);
        }
      }
      doorAudioInitialized = true;

      // Switch dual radar status LEDs instantaneously: Red (standby) -> Bright Green (active detection)
      if (radarDetected) {
        radarLedMat.color.setHex(0x22c55e);
        radarLedMat.emissive.setHex(0x22c55e);
        radarLedMat.emissiveIntensity = 2.4;
      } else {
        radarLedMat.color.setHex(0xef4444);
        radarLedMat.emissive.setHex(0xef4444);
        radarLedMat.emissiveIntensity = 1.45;
      }

      const target = radarDetected ? 1 : 0;
      slideOpenFactor = THREE.MathUtils.damp(slideOpenFactor, target, 6.8, dt);

      const lx = THREE.MathUtils.lerp(-0.65, -1.88, slideOpenFactor);
      const rx = THREE.MathUtils.lerp(0.65, 1.88, slideOpenFactor);
      leftSlideLeaf.position.x = lx;
      rightSlideLeaf.position.x = rx;

      leftDoorCol.minX = lx - 0.65;
      leftDoorCol.maxX = lx + 0.65;
      rightDoorCol.minX = rx - 0.65;
      rightDoorCol.maxX = rx + 0.65;
    },
  });

  // --- Entrance Canopy Awning ("Auvent d'Entrée") with 3 Warm Recessed Downlights ---
  {
    const awning = new THREE.Group();
    awning.position.set(0, 3.06, 7.82);
    group.add(awning);

    const awW = 4.45;
    const awD = 1.48;
    const awH = 0.17;

    // Main brushed anthracite canopy fascia + bright white reflective soffit underside
    const canopyDeck = new THREE.Mesh(new THREE.BoxGeometry(awW, awH, awD), mats.anthracite);
    canopyDeck.castShadow = true;
    canopyDeck.receiveShadow = true;
    const soffit = new THREE.Mesh(new THREE.BoxGeometry(awW - 0.16, 0.02, awD - 0.16), mats.whiteMetal);
    soffit.position.y = -awH / 2 - 0.004;
    // Crisp 1990 French retail blue-red front accent trim band on awning edge
    const trimBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 });
    const trimRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const frontBandB = new THREE.Mesh(new THREE.BoxGeometry(awW + 0.02, 0.036, 0.02), trimBlueMat);
    frontBandB.position.set(0, 0.035, awD / 2 + 0.008);
    const frontBandR = new THREE.Mesh(new THREE.BoxGeometry(awW + 0.02, 0.026, 0.02), trimRedMat);
    frontBandR.position.set(0, -0.02, awD / 2 + 0.008);

    // Diagonal galvanized steel tension tie-rods anchoring awning into facade wall below lightbox trim
    const tieRodGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.05, 8);
    [-1.78, 1.78].forEach((rx) => {
      const rod = new THREE.Mesh(tieRodGeo, mats.galvanized);
      rod.position.set(rx, 0.17, -0.2);
      rod.rotation.x = 1.28;
      awning.add(rod);
    });

    // 3 Warm Recessed Downlight Canisters under canopy + 1 shared warm PointLight
    const downlightHousingGeo = new THREE.CylinderGeometry(0.075, 0.082, 0.022, 12);
    const downlightLensGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.012, 12);
    const downlightLensMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      emissive: 0xfde68a,
      emissiveIntensity: 1.85,
      roughness: 0.2,
    });
    [-1.32, 0, 1.32].forEach((dx) => {
      const can = new THREE.Mesh(downlightHousingGeo, mats.stainless);
      can.position.set(dx, -awH / 2 - 0.014, 0.05);
      const lens = new THREE.Mesh(downlightLensGeo, downlightLensMat);
      lens.position.set(dx, -awH / 2 - 0.022, 0.05);
      awning.add(can, lens);
    });
    const canopyLight = new THREE.PointLight(0xffe8c2, 5.2, 8.5, 1.6);
    canopyLight.position.set(0, -0.25, 0.12);

    awning.add(canopyDeck, soffit, frontBandB, frontBandR, canopyLight);
    ctx.disposables.push(
      canopyDeck.geometry,
      soffit.geometry,
      trimBlueMat,
      trimRedMat,
      frontBandB.geometry,
      frontBandR.geometry,
      tieRodGeo,
      downlightHousingGeo,
      downlightLensGeo,
      downlightLensMat
    );
  }

  // --- Rebuilt 1990 Framed Metallic-Trimmed Illuminated Storefront Lightbox Sign ("CONTACT EXPRESS") ---
  //     Centered symmetrically over the main entrance (X = 0, width 11.4m => -5.7..+5.7, clear of DAB alcove!)
  const signTex = texBank.createStorefrontSignTexture();
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissiveMap: signTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.78,
    roughness: 0.22,
  });
  ctx.disposables.push(signFaceMat);

  const signW = 11.4;
  const signH = 1.48;
  const signD = 0.26;
  const signCabinet = addWallBlock(signW, signH, signD, 0, 4.18, 7.22, mats.anthracite);

  // Brushed aluminum/stainless 3D perimeter frame trim moldings around backlit acrylic face
  const trimHorizGeo = new THREE.BoxGeometry(signW + 0.12, 0.075, signD + 0.06);
  const trimVertGeo = new THREE.BoxGeometry(0.08, signH + 0.12, signD + 0.06);
  const signFaceGeo = new THREE.PlaneGeometry(signW - 0.18, signH - 0.18);
  ctx.disposables.push(trimHorizGeo, trimVertGeo, signFaceGeo);

  const trimTop = new THREE.Mesh(trimHorizGeo, mats.stainless);
  trimTop.position.set(0, signH / 2 + 0.01, 0.01);
  const trimBot = new THREE.Mesh(trimHorizGeo, mats.stainless);
  trimBot.position.set(0, -signH / 2 - 0.01, 0.01);
  const trimLeft = new THREE.Mesh(trimVertGeo, mats.stainless);
  trimLeft.position.set(-signW / 2 - 0.01, 0, 0.01);
  const trimRight = new THREE.Mesh(trimVertGeo, mats.stainless);
  trimRight.position.set(signW / 2 + 0.01, 0, 0.01);

  const signFace = new THREE.Mesh(signFaceGeo, signFaceMat);
  signFace.position.set(0, 0, signD / 2 + 0.008);
  signCabinet.add(trimTop, trimBot, trimLeft, trimRight, signFace);

  // Exterior lightbox power switch box mounted cleanly on right entrance frame post (never blocks radar sensor!)
  const signSwitchBox = addWallBlock(0.14, 0.2, 0.05, 1.62, 1.38, 7.15, mats.anthracite);
  const signSwitchLedMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
  });
  const signSwitchLedGeo = new THREE.BoxGeometry(0.05, 0.07, 0.02);
  const signSwitchLed = new THREE.Mesh(signSwitchLedGeo, signSwitchLedMat);
  signSwitchLed.position.z = 0.025;
  signSwitchBox.add(signSwitchLed);
  ctx.disposables.push(signSwitchLedMat, signSwitchLedGeo);

  let totemFaceMatRef: THREE.MeshStandardMaterial | null = null;
  registerInteractableBox(ctx, group, {
    id: 'facade_sign_toggle',
    title: 'Enseigne Lumineuse CONTACT EXPRESS',
    subtitle: 'Caisson Façade & Totem Parking · Rétroéclairage 1990',
    kind: 'power_toggle',
    initialState: true,
    inspectText:
      'Caisson lumineux 1990 à cadre aluminium brossé (CONTACT EXPRESS — Supermarché de Proximité · Boulangerie · Boucherie · Frais) et totem d’entrée.',
    size: [0.36, 0.42, 0.24],
    position: [1.62, 1.38, 7.18],
    onToggle: (on) => {
      signFaceMat.emissiveIntensity = on ? 0.78 : 0.0;
      if (totemFaceMatRef) {
        totemFaceMatRef.emissiveIntensity = on ? 0.72 : 0.0;
      }
      signSwitchLedMat.color.setHex(on ? 0x38bdf8 : 0x64748b);
      signSwitchLedMat.emissive.setHex(on ? 0x38bdf8 : 0x000000);
    },
  });

  // --- Classic 1990 Stainless-Steel Exterior Trash Bin ("Corbeille Extérieure Inox") at X = +2.35, Z = 7.55 ---
  {
    const bin = new THREE.Group();
    bin.position.set(2.35, 0.03, 7.55);
    group.add(bin);

    const binBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.1, 14), mats.concreteDark);
    binBase.position.y = 0.05;
    const binBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.21, 0.74, 16), mats.stainless);
    binBody.position.y = 0.46;
    binBody.castShadow = true;
    const binBandMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 });
    const binBand = new THREE.Mesh(new THREE.CylinderGeometry(0.224, 0.223, 0.07, 16), binBandMat);
    binBand.position.y = 0.62;
    const binHood = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mats.stainless
    );
    binHood.position.y = 0.83;
    const binCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.226, 0.226, 0.14, 16), mats.anthracite);
    binCollar.position.y = 0.78;
    const binSlot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.08), mats.rubberBlack);
    binSlot.position.set(0, 0.81, 0.19);
    const ashTray = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.03, 12), mats.anthracite);
    ashTray.position.y = 1.055;

    bin.add(binBase, binBody, binBand, binCollar, binHood, binSlot, ashTray);
    ctx.disposables.push(
      binBase.geometry,
      binBody.geometry,
      binBandMat,
      binBand.geometry,
      binHood.geometry,
      binCollar.geometry,
      binSlot.geometry,
      ashTray.geometry
    );
    addBoxCollider(ctx, 'exterior_trash_bin_col', 2.06, 2.64, 7.26, 7.84);
    registerInteractableBox(ctx, bin, {
      id: 'inspect_exterior_bin',
      title: 'Corbeille Extérieure Inox 1990',
      subtitle: 'Parvis Entrée · Acier Inoxydable & Cendrier Supérieur',
      kind: 'inspect',
      inspectText:
        'Corbeille de propreté extérieure cylindrique en acier inoxydable brossé avec socle béton lesté, dôme pare-pluie et cendrier intégré.',
      specs: 'Capacité 65 L · Inox 304 · Hauteur 107 cm',
      size: [0.58, 1.12, 0.58],
      position: [0, 0.56, 0],
    });
  }

  // --- Wooden/Metal 1990 Newspaper & Magazine Rack ("Présentoir Presse & Journaux 1990") at X = -2.85, Z = 7.46 ---
  {
    const rack = new THREE.Group();
    rack.position.set(-2.85, 0.03, 7.46);
    group.add(rack);

    const rW = 1.18;
    const rH = 1.48;
    const rD = 0.44;

    // Black welded steel side A-frames + solid warm oak backboard
    const sideLegGeo = new THREE.BoxGeometry(0.04, rH, 0.04);
    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(rW - 0.06, 1.24, 0.035), mats.oakWood);
    backBoard.position.set(0, 0.72, -rD / 2 + 0.04);
    backBoard.castShadow = true;
    const baseSkirt = new THREE.Mesh(new THREE.BoxGeometry(rW, 0.14, rD), mats.anthracite);
    baseSkirt.position.set(0, 0.07, 0);
    rack.add(backBoard, baseSkirt);

    [
      [-rW / 2 + 0.025, -rD / 2 + 0.03],
      [rW / 2 - 0.025, -rD / 2 + 0.03],
      [-rW / 2 + 0.025, rD / 2 - 0.03],
      [rW / 2 - 0.025, rD / 2 - 0.03],
    ].forEach(([lx, lz], idx) => {
      const leg = new THREE.Mesh(sideLegGeo, mats.anthracite);
      leg.position.set(lx, idx < 2 ? rH / 2 : 0.42, lz);
      if (idx >= 2) leg.scale.y = 0.56;
      rack.add(leg);
    });

    // Overhead 1990 "PRESSE · JOURNAUX" header sign
    const pressSignTex = texBank.createDepartmentSignTexture(
      'PRESSE · JOURNAUX 1990',
      'QUOTIDIENS · TÉLÉ · SPORTS · MAGAZINES',
      '#7f1d1d',
      '#facc15'
    );
    const pressSignMat = new THREE.MeshStandardMaterial({ map: pressSignTex, roughness: 0.4 });
    const pressHeader = new THREE.Mesh(new THREE.BoxGeometry(rW + 0.04, 0.24, 0.05), pressSignMat);
    pressHeader.position.set(0, rH + 0.04, -rD / 2 + 0.05);
    rack.add(pressHeader);

    // 3 Sloped oak display tiers + chrome retaining wire rails + colorful 1990 French newspapers/magazines
    const tierShelfGeo = new THREE.BoxGeometry(rW - 0.08, 0.025, 0.28);
    const retainBarGeo = new THREE.CylinderGeometry(0.008, 0.008, rW - 0.08, 8);
    const magGeo = new THREE.BoxGeometry(0.22, 0.28, 0.024);
    const magColors = [
      0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a,
      0xf8fafc, 0xf97316, 0x7c3aed, 0x0284c7,
      0xe5e7eb, 0xbe123c, 0x0d9488, 0xeab308,
    ];
    const magMats = magColors.map((col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
    const mastheadGeo = new THREE.BoxGeometry(0.19, 0.055, 0.004);
    const mastheadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

    const tierPositions: Array<[number, number]> = [
      [0.34, 0.08],
      [0.72, 0.02],
      [1.1, -0.04],
    ];
    let magIdx = 0;
    tierPositions.forEach(([ty, tz]) => {
      const shelf = new THREE.Mesh(tierShelfGeo, mats.oakWood);
      shelf.position.set(0, ty, tz);
      shelf.rotation.x = 0.22;
      const bar = new THREE.Mesh(retainBarGeo, mats.chrome);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, ty + 0.08, tz + 0.13);
      rack.add(shelf, bar);

      [-0.4, -0.14, 0.14, 0.4].forEach((mx) => {
        const mMat = magMats[magIdx % magMats.length];
        magIdx += 1;
        const mag = new THREE.Mesh(magGeo, mMat);
        mag.position.set(mx, ty + 0.14, tz + 0.04);
        mag.rotation.x = -0.26;
        const mast = new THREE.Mesh(mastheadGeo, mastheadMat);
        mast.position.set(0, 0.095, 0.014);
        mag.add(mast);
        rack.add(mag);
      });
    });

    ctx.disposables.push(
      sideLegGeo,
      backBoard.geometry,
      baseSkirt.geometry,
      pressSignMat,
      pressHeader.geometry,
      tierShelfGeo,
      retainBarGeo,
      magGeo,
      mastheadGeo,
      mastheadMat,
      ...magMats
    );
    addBoxCollider(ctx, 'newspaper_rack_col', -3.52, -2.18, 7.16, 7.78);
    registerInteractableBox(ctx, rack, {
      id: 'inspect_newspaper_rack',
      title: 'Présentoir Presse & Journaux 1990',
      subtitle: 'Parvis Vitrine Gauche · Bois Chêne & Acier',
      kind: 'inspect',
      inspectText:
        'Kiosque extérieur en bois de chêne et armature métallique présentant la presse quotidienne régionale, programmes TV et magazines de 1990.',
      specs: '3 niveaux inclinés · Barres de maintien inox',
      size: [1.26, 1.65, 0.56],
      position: [0, 0.82, 0],
    });
  }

  // --- Tall Illuminated Roadside Totem Sign ("Totem Lumineux CONTACT EXPRESS") at Parking Entrance ---
  //     Positioned prominently at east forecourt edge (X = +10.15, Z = 10.65), angled cleanly toward parking & spawn!
  {
    const totem = new THREE.Group();
    totem.position.set(10.15, 0, 10.65);
    totem.rotation.y = -0.42; // Angled gracefully toward arriving shoppers & parking lot
    group.add(totem);

    // Concrete foundation plinth
    const plinthBase = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.42, 0.68), mats.concreteDark);
    plinthBase.position.y = 0.21;
    plinthBase.castShadow = true;
    plinthBase.receiveShadow = true;

    // Twin heavy brushed-steel side structural pylons (5.1m tall)
    const pylonH = 5.1;
    const pylonGeo = new THREE.CylinderGeometry(0.085, 0.105, pylonH, 12);
    const pylonL = new THREE.Mesh(pylonGeo, mats.anthracite);
    pylonL.position.set(-0.74, 0.4 + pylonH / 2, 0);
    pylonL.castShadow = true;
    const pylonR = new THREE.Mesh(pylonGeo, mats.anthracite);
    pylonR.position.set(0.74, 0.4 + pylonH / 2, 0);
    pylonR.castShadow = true;

    // Top brushed stainless rounded cap beam
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.16, 0.42), mats.stainless);
    topCap.position.set(0, 5.52, 0);

    // Tall double-sided backlit acrylic totem lightbox cabinet (1.38m x 3.85m x 0.34m)
    const cabBody = new THREE.Mesh(new THREE.BoxGeometry(1.42, 3.92, 0.34), mats.anthracite);
    cabBody.position.set(0, 3.44, 0);
    cabBody.castShadow = true;

    const totemTex = texBank.createTotemSignTexture();
    const totemFaceMat = new THREE.MeshStandardMaterial({
      map: totemTex,
      emissiveMap: totemTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.24,
    });
    totemFaceMatRef = totemFaceMat;

    const totemFaceGeo = new THREE.PlaneGeometry(1.32, 3.78);
    const faceFront = new THREE.Mesh(totemFaceGeo, totemFaceMat);
    faceFront.position.set(0, 3.44, 0.176);
    const faceBack = new THREE.Mesh(totemFaceGeo, totemFaceMat);
    faceBack.position.set(0, 3.44, -0.176);
    faceBack.rotation.y = Math.PI;

    totem.add(plinthBase, pylonL, pylonR, topCap, cabBody, faceFront, faceBack);
    ctx.disposables.push(
      plinthBase.geometry,
      pylonGeo,
      topCap.geometry,
      cabBody.geometry,
      totemFaceMat,
      totemFaceGeo
    );

    addBoxCollider(ctx, 'roadside_totem_col', 9.25, 11.0, 10.12, 11.18);
    registerInteractableBox(ctx, totem, {
      id: 'inspect_roadside_totem',
      title: 'Totem Lumineux CONTACT EXPRESS (5,5 m)',
      subtitle: 'Entrée Parking · Caisson Double Face Rétroéclairé',
      kind: 'inspect',
      inspectText:
        'Totem publicitaire double face de 5,50 m signalant l’entrée du parking Contact Express, ses rayons frais et ses horaires d’ouverture 7j/7.',
      specs: 'Hauteur 5,50 m · Double face acrylique rétroéclairé · Pylônes acier',
      size: [1.76, 3.4, 0.78],
      position: [0, 1.7, 0],
    });
  }

  // ============================================================================
  // 5. V23 3D SUSPENDED ACOUSTIC CEILING GRID, INSTANCED 1990 FLUORESCENT TUBE
  //    FIXTURES ("RÉGLETTES NÉON 1990"), WALL TRIM BANDS, BUMPER RAILS & PILLARS
  // ============================================================================
  // 5A. 60x60cm Acoustic Ceiling Tile Underside Plane (X = -10..+10, Z = -13..+7, Y = 4.19)
  const acousticCeilingGeo = new THREE.PlaneGeometry(20.0, 20.0);
  ctx.disposables.push(acousticCeilingGeo);
  const acousticCeilingMesh = new THREE.Mesh(acousticCeilingGeo, mats.acousticCeiling);
  acousticCeilingMesh.rotation.x = Math.PI / 2; // Facing downward (-Y) into store & warehouse
  acousticCeilingMesh.position.set(0, wallH - 0.01, -3.0);
  acousticCeilingMesh.receiveShadow = true;
  group.add(acousticCeilingMesh);

  // Subtle 3D Brushed-Aluminum Suspended Ceiling Main T-Bar Support Beams (2 InstancedMeshes = 2 draw calls!)
  const beamRunZGeo = new THREE.BoxGeometry(0.055, 0.045, 19.9);
  const beamRunXGeo = new THREE.BoxGeometry(19.9, 0.045, 0.055);
  ctx.disposables.push(beamRunZGeo, beamRunXGeo);

  const beamZEntries: InstanceEntry[] = [-7.5, -5.0, -2.5, 0, 2.5, 5.0, 7.5].map((bx) => ({
    pos: [bx, wallH - 0.032, -3.0],
  }));
  const beamXEntries: InstanceEntry[] = [-10.0, -7.0, -4.0, -1.0, 2.0, 5.0].map((bz) => ({
    pos: [0, wallH - 0.032, bz],
  }));
  buildInstancedMesh(ctx, group, beamRunZGeo, mats.galvanized, beamZEntries, false);
  buildInstancedMesh(ctx, group, beamRunXGeo, mats.galvanized, beamXEntries, false);

  // 5B. Detailed 3D Suspended 1990 Fluorescent Tube Luminaires ("Réglettes Néon 1990")
  //     Batched into 5 InstancedMeshes across Sales Floor (15) + Warehouse (3) = 18 fixtures!
  const fixLen = 2.08;
  const fixW = 0.34;
  const fixY = wallH - 0.17; // Suspended 16cm cleanly below acoustic tile ceiling

  const housingGeo = new THREE.BoxGeometry(fixLen, 0.062, fixW);
  const endCapGeo = new THREE.BoxGeometry(0.036, 0.082, fixW + 0.02);
  const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
  const tubeGeo = new THREE.CylinderGeometry(0.018, 0.018, fixLen - 0.08, 8);
  tubeGeo.rotateZ(Math.PI / 2);
  const louverGeo = new THREE.BoxGeometry(0.012, 0.052, fixW - 0.03);

  const fluorescentTubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xf4fbff,
    emissiveIntensity: 1.65,
    roughness: 0.18,
    metalness: 0.05,
  });
  ctx.disposables.push(housingGeo, endCapGeo, rodGeo, tubeGeo, louverGeo, fluorescentTubeMat);

  const fixturePositions: Array<[number, number]> = [];
  // Sales Floor 4x4 grid (skip SE corner (7.2, 4.6) directly over Manager's Office dropped ceiling)
  for (const fx of [-7.2, -2.4, 2.4, 7.2]) {
    for (const fz of [-5.0, -1.8, 1.4, 4.6]) {
      if (fx > 5.5 && fz > 3.0) continue;
      fixturePositions.push([fx, fz]);
    }
  }
  // Rear Warehouse 3 industrial fluorescent bays along Z = -10.0
  for (const fx of [-6.0, 0.0, 6.0]) {
    fixturePositions.push([fx, -10.0]);
  }

  const housingEntries: InstanceEntry[] = [];
  const endCapEntries: InstanceEntry[] = [];
  const rodEntries: InstanceEntry[] = [];
  const tubeEntries: InstanceEntry[] = [];
  const louverEntries: InstanceEntry[] = [];

  for (const [fx, fz] of fixturePositions) {
    // White enameled steel reflector trough housing
    housingEntries.push({ pos: [fx, fixY + 0.02, fz] });
    // Brushed stainless steel end-caps
    endCapEntries.push(
      { pos: [fx - fixLen / 2 - 0.01, fixY + 0.01, fz] },
      { pos: [fx + fixLen / 2 + 0.01, fixY + 0.01, fz] }
    );
    // Twin vertical suspension rods anchored to acoustic ceiling grid
    rodEntries.push(
      { pos: [fx - fixLen * 0.36, fixY + 0.11, fz] },
      { pos: [fx + fixLen * 0.36, fixY + 0.11, fz] }
    );
    // Dual parallel glowing 4000K fluorescent tubes (pre-rotated along X)
    tubeEntries.push(
      { pos: [fx, fixY - 0.02, fz - 0.082] },
      { pos: [fx, fixY - 0.02, fz + 0.082] }
    );
    // Transverse brushed aluminum anti-glare parabolic louver fins (9 per luminaire)
    for (let li = -4; li <= 4; li++) {
      louverEntries.push({ pos: [fx + li * 0.215, fixY - 0.032, fz] });
    }
  }

  buildInstancedMesh(ctx, group, housingGeo, mats.whiteMetal, housingEntries, false);
  buildInstancedMesh(ctx, group, endCapGeo, mats.stainless, endCapEntries, false);
  buildInstancedMesh(ctx, group, rodGeo, mats.galvanized, rodEntries, false);
  buildInstancedMesh(ctx, group, tubeGeo, fluorescentTubeMat, tubeEntries, false);
  buildInstancedMesh(ctx, group, louverGeo, mats.stainless, louverEntries, false);

  // 5C. Sales-Floor 1990 Wall Details: Lower Shopping-Cart Bumper Rails ("Plinthes Pare-Chocs")
  //     & Classic 1990 French Retail Horizontal Trim Bands (Navy / Red / Warm Cream)
  const addWallLinearTrim = (
    x: number,
    z: number,
    len: number,
    axis: 'x' | 'z',
    facingSign: 1 | -1
  ) => {
    const off = facingSign * 0.022;
    const makeStrip = (h: number, y: number, depth: number, mat: THREE.Material) => {
      const w = axis === 'x' ? len : depth;
      const d = axis === 'z' ? len : depth;
      const g = new THREE.BoxGeometry(w, h, d);
      ctx.disposables.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(axis === 'z' ? x + off : x, y, axis === 'x' ? z + off : z);
      m.receiveShadow = true;
      group.add(m);
    };

    // Dark floor baseboard plinth + heavy rubber shopping-cart bumper rail + brushed stainless rail cap
    makeStrip(0.1, 0.05, 0.032, mats.anthracite);
    makeStrip(0.11, 0.22, 0.048, mats.rubberBlack);
    makeStrip(0.036, 0.292, 0.042, mats.stainless);

    // Classic 1990 French retail horizontal wall stripe (placed cleanly at Y = 3.24..3.52 above wall signage)
    makeStrip(0.145, 3.45, 0.026, mats.retailStripeNavy);
    makeStrip(0.052, 3.345, 0.028, mats.retailStripeRed);
    makeStrip(0.085, 3.27, 0.024, mats.retailStripeCream);
  };

  // West Interior Sales-Floor Wall (X = -9.87, Z = -6.86..+6.86)
  addWallLinearTrim(-9.87, 0.0, 13.72, 'z', 1);
  // East Interior Sales-Floor Wall (X = +9.87, Z = -6.86..+3.08, stopping cleanly at Office north partition)
  addWallLinearTrim(9.87, -1.89, 9.94, 'z', -1);
  // Partition Wall South Face (Z = -6.88), left & right of warehouse double swinging doors (X = -2.8..-0.4)
  addWallLinearTrim(-6.36, -6.88, 6.96, 'x', 1);
  addWallLinearTrim(4.78, -6.88, 10.16, 'x', 1);
  // Front-Left Solid Pier Interior Face (Z = +6.87, X = -9.86..-6.32)
  addWallLinearTrim(-8.09, 6.87, 3.54, 'x', -1);

  // 5D. Architectural Structural Perimeter Columns with Yellow-and-Black Corner Guards
  //     Positioned flush at unobstructed wall junctions/corners (zero aisle or shelf collision!)
  const pillarShaftGeo = new THREE.BoxGeometry(0.28, wallH, 0.28);
  const pillarBaseGeo = new THREE.BoxGeometry(0.32, 0.14, 0.32);
  const pillarCapGeo = new THREE.BoxGeometry(0.33, 0.12, 0.33);
  const cornerGuardGeo = new THREE.BoxGeometry(0.305, 1.28, 0.305);
  ctx.disposables.push(pillarShaftGeo, pillarBaseGeo, pillarCapGeo, cornerGuardGeo);

  const structuralPillarCoords: Array<[number, number]> = [
    [-9.76, 6.76], // Front-West corner
    [-6.34, 6.76], // Front-Left window pier junction
    [-9.76, -6.76], // Rear-West corner (clear of Dairy ending at Z = -5.65)
    [-2.96, -6.78], // Warehouse swinging door West structural pier
    [-0.24, -6.78], // Warehouse swinging door East structural pier
    [9.76, -6.76], // Rear-East corner (clear of Butcher & Hot Snacking)
    [9.76, 2.94], // East wall Bakery / Manager's Office transition pier
  ];

  const shaftEntries: InstanceEntry[] = [];
  const baseEntries: InstanceEntry[] = [];
  const capEntries: InstanceEntry[] = [];
  const guardEntries: InstanceEntry[] = [];

  for (const [px, pz] of structuralPillarCoords) {
    shaftEntries.push({ pos: [px, wallH / 2, pz] });
    baseEntries.push({ pos: [px, 0.07, pz] });
    capEntries.push({ pos: [px, wallH - 0.06, pz] });
    guardEntries.push({ pos: [px, 0.78, pz] });
  }

  buildInstancedMesh(ctx, group, pillarShaftGeo, mats.concrete, shaftEntries, false);
  buildInstancedMesh(ctx, group, pillarBaseGeo, mats.concreteDark, baseEntries, false);
  buildInstancedMesh(ctx, group, pillarCapGeo, mats.concreteDark, capEntries, false);
  buildInstancedMesh(ctx, group, cornerGuardGeo, mats.hazardStripe, guardEntries, false);

  // Master Interior Light Switch next to Entrance inside Foyer (X = 1.65, Z = 6.82)
  const switchPlate = addWallBlock(0.16, 0.22, 0.04, 1.68, 1.35, 6.85, mats.whiteMetal);
  const rockerMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.6,
  });
  ctx.disposables.push(rockerMat);
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), rockerMat);
  ctx.disposables.push(rocker.geometry);
  rocker.position.z = -0.02;
  switchPlate.add(rocker);

  const toggleStoreLights = (on: boolean) => {
    fluorescentTubeMat.emissiveIntensity = on ? 1.65 : 0.05;
    rockerMat.color.setHex(on ? 0x10b981 : 0xef4444);
    rockerMat.emissive.setHex(on ? 0x10b981 : 0xef4444);
    onStoreLightsChanged?.(on);
  };

  registerInteractableBox(ctx, group, {
    id: 'master_store_lights',
    title: 'Tableau Éclairage Surface de Vente',
    subtitle: 'Interrupteur Général · Réglettes Néon 1990',
    kind: 'power_toggle',
    initialState: true,
    inspectText:
      'Commande générale des réglettes fluorescentes suspendues 4000K à grilles paralumes de la surface de vente et de la réserve.',
    size: [0.38, 0.42, 0.25],
    position: [1.68, 1.35, 6.82],
    onToggle: toggleStoreLights,
  });

  // Manual override switch for automatic entrance doors (left entrance post)
  const doorSwitch = addWallBlock(0.12, 0.18, 0.04, -1.62, 1.35, 6.85, mats.anthracite);
  void doorSwitch;
  registerInteractableBox(ctx, group, {
    id: 'auto_door_lock_toggle',
    title: 'Sélecteur Portes Automatiques',
    subtitle: 'Entrée Principale · Radar Piéton',
    kind: 'door_toggle',
    initialState: true,
    inspectText: 'Sélecteur d’ouverture automatique par radar hyperfréquence des portes coulissantes.',
    size: [0.35, 0.4, 0.25],
    position: [-1.62, 1.35, 6.82],
    onToggle: (openAllowed) => {
      autoDoorLockedClosed = !openAllowed;
    },
  });

  return { toggleStoreLights, atmController };
}

function buildCartShelter(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  cx: number,
  cz: number
): void {
  const shelter = new THREE.Group();
  shelter.position.set(cx, 0, cz);
  parent.add(shelter);

  const w = 2.4;
  const d = 4.2;
  const h = 2.25;

  // 6 Galvanized tubular posts
  const postGeo = new THREE.CylinderGeometry(0.045, 0.045, h, 10);
  ctx.disposables.push(postGeo);
  const postCoords: Array<[number, number]> = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, 0],
    [w / 2, 0],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ];
  postCoords.forEach(([px, pz]) => {
    const p = new THREE.Mesh(postGeo, mats.galvanized);
    p.position.set(px, h / 2, pz);
    p.castShadow = true;
    shelter.add(p);
  });

  // Side polycarbonate glazing panels + steel rails
  const sideGlassGeo = new THREE.BoxGeometry(0.03, 1.35, d - 0.15);
  const backGlassGeo = new THREE.BoxGeometry(w - 0.15, 1.35, 0.03);
  ctx.disposables.push(sideGlassGeo, backGlassGeo);

  const leftGlass = new THREE.Mesh(sideGlassGeo, mats.frostedGlass);
  leftGlass.position.set(-w / 2, 1.15, 0);
  const rightGlass = new THREE.Mesh(sideGlassGeo, mats.frostedGlass);
  rightGlass.position.set(w / 2, 1.15, 0);
  const backGlass = new THREE.Mesh(backGlassGeo, mats.frostedGlass);
  backGlass.position.set(0, 1.15, d / 2);
  shelter.add(leftGlass, rightGlass, backGlass);

  // Curved polycarbonate barrel vault roof
  const roofGeo = new THREE.CylinderGeometry(
    w / 2 + 0.15,
    w / 2 + 0.15,
    d + 0.3,
    16,
    1,
    true,
    -Math.PI / 2,
    Math.PI
  );
  ctx.disposables.push(roofGeo);
  const barrelRoof = new THREE.Mesh(roofGeo, mats.frostedGlass);
  barrelRoof.rotation.x = Math.PI / 2;
  barrelRoof.scale.set(1, 1, 0.42);
  barrelRoof.position.set(0, h - 0.05, 0);
  shelter.add(barrelRoof);

  // Header sign facing storefront (-Z)
  const signTex = texBank.createDepartmentSignTexture(
    'ABRI CADDIES',
    'JETON OU PIÈCE 10 F · MERCI DE RANGER VOTRE CHARIOT',
    '#0f2942',
    '#10b981'
  );
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 });
  const signGeo = new THREE.BoxGeometry(w, 0.38, 0.06);
  ctx.disposables.push(signMat, signGeo);
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(0, h + 0.1, -d / 2);
  shelter.add(signMesh);

  // 2 rows x 4 Nested 3D Metal Shopping Carts (composite multi-part carts!)
  const redPlasticMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.05,
  });
  const wireBasketMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
    wireframe: false,
  });
  ctx.disposables.push(redPlasticMat, wireBasketMat);

  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10);
  const chassisBarGeo = new THREE.BoxGeometry(0.52, 0.035, 0.78);
  const basketSideGeo = new THREE.BoxGeometry(0.54, 0.42, 0.74);
  const handleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8);
  const flapGeo = new THREE.BoxGeometry(0.42, 0.26, 0.025);
  ctx.disposables.push(wheelGeo, chassisBarGeo, basketSideGeo, handleGeo, flapGeo);

  [-0.56, 0.56].forEach((rowX) => {
    for (let c = 0; c < 4; c++) {
      const cart = new THREE.Group();
      cart.position.set(rowX, 0, 1.15 - c * 0.46);

      // 4 wheels
      [
        [-0.22, -0.32],
        [0.22, -0.32],
        [-0.22, 0.32],
        [0.22, 0.32],
      ].forEach(([wx, wz]) => {
        const wh = new THREE.Mesh(wheelGeo, mats.rubberBlack);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wx, 0.055, wz);
        cart.add(wh);
      });

      const chassis = new THREE.Mesh(chassisBarGeo, mats.chrome);
      chassis.position.y = 0.14;

      // Tapered wire-look basket frame (slotted metallic walls + open top rim)
      const basketBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.72), mats.chrome);
      ctx.disposables.push(basketBottom.geometry);
      basketBottom.position.y = 0.46;

      const leftCage = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.38, 0.72), mats.chainLink);
      const rightCage = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.38, 0.72), mats.chainLink);
      const frontCage = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.025), mats.chainLink);
      ctx.disposables.push(leftCage.geometry, rightCage.geometry, frontCage.geometry);
      leftCage.position.set(-0.24, 0.66, 0);
      rightCage.position.set(0.24, 0.66, 0);
      frontCage.position.set(0, 0.65, -0.35);

      const childSeat = new THREE.Mesh(flapGeo, redPlasticMat);
      childSeat.position.set(0, 0.68, 0.26);
      childSeat.rotation.x = -0.22;

      const handle = new THREE.Mesh(handleGeo, redPlasticMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 0.94, 0.42);

      const coinLock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.06), redPlasticMat);
      ctx.disposables.push(coinLock.geometry);
      coinLock.position.set(0.14, 0.95, 0.42);

      cart.add(chassis, basketBottom, leftCage, rightCage, frontCage, childSeat, handle, coinLock);
      shelter.add(cart);
    }
  });

  // Accurate shelter collider
  addBoxCollider(ctx, 'cart_shelter', cx - w / 2 - 0.1, cx + w / 2 + 0.1, cz - d / 2, cz + d / 2);

  registerInteractableBox(ctx, shelter, {
    id: 'inspect_cart_shelter',
    title: 'Abri Caddies & Chariots Emboîtés',
    subtitle: 'Zone Parking · Structure Acier Galvanisé',
    kind: 'inspect',
    inspectText:
      'Abri voûté en polycarbonate alvéolaire et acier galvanisé abritant 8 chariots métalliques 130 L emboîtés avec siège enfant rabattable et monnayeur à chaîne.',
    specs: 'Capacité 16 chariots · Acier galvanisé à chaud',
    size: [w + 0.2, 2.1, d + 0.2],
    position: [0, 1.05, 0],
  });
}

function buildExteriorAtmAndMonnayeur(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  wallet: PlayerWallet,
  onWalletChanged: () => void
): Atm1990Controller {
  // Alcove span: X = +6.25 to +9.85, back wall at Z = +6.54, facing +Z (outward toward sidewalk)
  // 1. Authentic 1990 French Bank ATM ("DAB CB 1990" — Banque Nationale) at X = +7.30, Z = +6.66
  const atmController = buildAtm1990(ctx, parent, mats, 7.3, 6.66, wallet, onWalletChanged);

  // 2. Authentic 100% Diegetic 1990 French Bill-to-Coin Change Machine ("MONNAYEUR AUTOMATIQUE FRANCS 1990") at X = +9.02, Z = +6.66
  buildMonnayeur1990(ctx, parent, mats, 9.02, 6.66, wallet, onWalletChanged);

  // Subtle recessed warm-white halogen alcove downlight
  const alcoveLight = new THREE.PointLight(0xfff3de, 2.4, 4.8, 2.0);
  alcoveLight.position.set(8.15, 2.85, 7.05);
  parent.add(alcoveLight);

  addBoxCollider(ctx, 'atm_monnayeur_col', 6.48, 9.6, 6.42, 6.95);

  return atmController;
}
