import * as THREE from 'three';
import {
  MaterialLibrary,
  addBoxCollider,
  registerInteractableBox,
} from '../materials';
import { ProceduralTextureBank } from '../textures';
import { WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';
import { OrderTerminalModel } from '../orderCatalog';
import { PlayerToolController } from '../playerTools';
import { buildCheckoutLane1990, createSharedHandheldScanner } from './checkout1990';
import { buildOfficeWorkstation1990 } from './officePc1990';
import { buildInteractiveOfficeFilingCabinets } from './filingCabinets1990';

export function buildCheckoutsAndOffice(
  ctx: WorldBuildContext,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  wallet: PlayerWallet,
  orderModel: OrderTerminalModel,
  tools: PlayerToolController,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  onWalletChanged: () => void,
  isSeatedAtDesk: () => boolean,
  setSeatedAtDesk: (seated: boolean) => void
): void {
  const root = new THREE.Group();
  ctx.scene.add(root);

  // ============================================================================
  // ZONE 3: TWO 100% DIEGETIC 3D 1990 FRENCH CHECKOUT COUNTERS ("CAISSE 1 & CAISSE 2")
  // Caisse 1 at X = -2.75, Caisse 2 at X = -4.95, Z = +4.45
  // ============================================================================
  const sharedScanner = createSharedHandheldScanner(ctx, camera, wallet, onWalletChanged);
  buildCheckoutLane1990(ctx, root, mats, texBank, 1, -2.75, wallet, sharedScanner, onWalletChanged);
  buildCheckoutLane1990(ctx, root, mats, texBank, 2, -4.95, wallet, sharedScanner, onWalletChanged);

  // ============================================================================
  // ZONE 4: V26 FULLY ENCLOSED MANAGER'S OFFICE ("BUREAU DU GÉRANT — PRIVÉ")
  // Footprint: X = +6.15..+9.90, Z = +3.15..+6.35, Full Ceiling Height = 4.20m
  // ============================================================================
  {
    const office = new THREE.Group();
    root.add(office);

    const wallH = 4.2;
    const dropCeilY = 3.18;
    const partThick = 0.14;

    const addOfficeBlock = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material
    ) => {
      const g = new THREE.BoxGeometry(w, h, d);
      ctx.disposables.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      office.add(m);
      return m;
    };

    // Helper: Build framed interior observation window with clear glass + 3D horizontal venetian blinds
    const addObservationWindow = (
      cx: number,
      cz: number,
      winLen: number,
      axis: 'x' | 'z',
      interiorSign: 1 | -1
    ) => {
      const winBot = 1.05;
      const winTop = 2.22;
      const winH = winTop - winBot;
      const winMidY = (winBot + winTop) / 2;

      // Brushed aluminum perimeter window frame (sill, head, twin side jambs, optional center mullion)
      const frameDepth = partThick + 0.025;
      const barT = 0.048;
      if (axis === 'z') {
        addOfficeBlock(frameDepth, barT, winLen + 0.04, cx, winBot + barT / 2, cz, mats.anthracite);
        addOfficeBlock(frameDepth, barT, winLen + 0.04, cx, winTop - barT / 2, cz, mats.anthracite);
        addOfficeBlock(frameDepth, winH, barT, cx, winMidY, cz - winLen / 2 + barT / 2, mats.anthracite);
        addOfficeBlock(frameDepth, winH, barT, cx, winMidY, cz + winLen / 2 - barT / 2, mats.anthracite);
        // Clear observation glass pane
        addOfficeBlock(0.024, winH - barT * 2, winLen - barT * 2, cx, winMidY, cz, mats.clearGlass);
      } else {
        addOfficeBlock(winLen + 0.04, barT, frameDepth, cx, winBot + barT / 2, cz, mats.anthracite);
        addOfficeBlock(winLen + 0.04, barT, frameDepth, cx, winTop - barT / 2, cz, mats.anthracite);
        addOfficeBlock(barT, winH, frameDepth, cx - winLen / 2 + barT / 2, winMidY, cz, mats.anthracite);
        addOfficeBlock(barT, winH, frameDepth, cx + winLen / 2 - barT / 2, winMidY, cz, mats.anthracite);
        // Central vertical mullion for wider North observation window
        if (winLen > 2.0) {
          addOfficeBlock(0.042, winH - barT * 2, 0.065, cx, winMidY, cz, mats.anthracite);
        }
        addOfficeBlock(winLen - barT * 2, winH - barT * 2, 0.024, cx, winMidY, cz, mats.clearGlass);
      }

      // 3D Horizontal Aluminum Venetian Blinds ("Stores Vénitiens") mounted on interior office side
      // Partially lowered over upper 55% of window so manager maintains clear sales-floor sightline!
      const blindMat = new THREE.MeshStandardMaterial({
        color: 0xe6e4dc,
        roughness: 0.45,
        metalness: 0.25,
      });
      ctx.disposables.push(blindMat);

      const slatLen = winLen - 0.12;
      const blindOffset = interiorSign * (partThick / 2 + 0.028);
      const valanceW = axis === 'x' ? slatLen + 0.04 : 0.04;
      const valanceD = axis === 'z' ? slatLen + 0.04 : 0.04;
      const valX = axis === 'z' ? cx + blindOffset : cx;
      const valZ = axis === 'x' ? cz + blindOffset : cz;
      addOfficeBlock(valanceW, 0.045, valanceD, valX, winTop - 0.065, valZ, mats.whiteMetal);

      const slatGeo =
        axis === 'x'
          ? new THREE.BoxGeometry(slatLen, 0.005, 0.028)
          : new THREE.BoxGeometry(0.028, 0.005, slatLen);
      ctx.disposables.push(slatGeo);

      const slatCount = 10;
      for (let i = 0; i < slatCount; i++) {
        const sy = winTop - 0.115 - i * 0.056;
        const slat = new THREE.Mesh(slatGeo, blindMat);
        slat.position.set(valX, sy, valZ);
        if (axis === 'x') {
          slat.rotation.x = 0.42;
        } else {
          slat.rotation.z = -0.42;
        }
        office.add(slat);
      }

      // Thin white pull/tilt wand on one side of venetian blinds
      const wandGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.72, 6);
      ctx.disposables.push(wandGeo);
      const wand = new THREE.Mesh(wandGeo, mats.whiteMetal);
      wand.position.set(
        axis === 'x' ? cx - slatLen * 0.44 : valX,
        winTop - 0.46,
        axis === 'z' ? cz - slatLen * 0.44 : valZ
      );
      office.add(wand);
    };

    // -------------------------------------------------------------------------
    // 1) FULL-HEIGHT WEST FRONT PARTITION WALL (X = +6.15, Z = +3.15..+6.42, Y = 0..4.20m)
    //    Zero gaps left, right, or above the door!
    // -------------------------------------------------------------------------
    // Left solid pier (Z = 3.08..3.45, full floor-to-ceiling 4.20m)
    addOfficeBlock(partThick, wallH, 0.37, 6.15, wallH / 2, 3.265, mats.wallPlaster);
    // Solid full-height header wall above doorway (Z = 3.45..4.45, Y = 2.22..4.20m)
    addOfficeBlock(partThick, wallH - 2.22, 1.0, 6.15, 2.22 + (wallH - 2.22) / 2, 3.95, mats.wallPlaster);
    // Right of door (Z = 4.45..6.42): lower solid drywall (0..1.05m), upper drywall (2.22..4.20m), window side piers
    addOfficeBlock(partThick, 1.05, 1.97, 6.15, 0.525, 5.435, mats.wallPlaster);
    addOfficeBlock(partThick, wallH - 2.22, 1.97, 6.15, 2.22 + (wallH - 2.22) / 2, 5.435, mats.wallPlaster);
    addOfficeBlock(partThick, 1.17, 0.22, 6.15, 1.635, 4.56, mats.wallPlaster);
    addOfficeBlock(partThick, 1.17, 0.26, 6.15, 1.635, 6.29, mats.wallPlaster);
    // Framed observation window with horizontal venetian blinds overlooking sales floor
    addObservationWindow(6.15, 5.415, 1.49, 'z', 1);

    // Proper 3D Wooden & Anodized Aluminum Door Jamb Frame surrounding doorway (Z = 3.45..4.45, H = 2.22m)
    addOfficeBlock(partThick + 0.036, 2.24, 0.052, 6.15, 1.12, 3.455, mats.oakWood); // North door jamb
    addOfficeBlock(partThick + 0.036, 2.24, 0.052, 6.15, 1.12, 4.445, mats.oakWood); // South door jamb
    addOfficeBlock(partThick + 0.038, 0.056, 1.045, 6.15, 2.225, 3.95, mats.oakWood); // Top door lintel jamb
    // Outer brushed aluminum casing trim around door frame (sales-floor facing)
    addOfficeBlock(0.018, 2.28, 0.036, 6.072, 1.14, 3.43, mats.anthracite);
    addOfficeBlock(0.018, 2.28, 0.036, 6.072, 1.14, 4.47, mats.anthracite);
    addOfficeBlock(0.018, 0.038, 1.08, 6.072, 2.26, 3.95, mats.anthracite);

    // Crisp "BUREAU DU GÉRANT — PRIVÉ" Plaque mounted cleanly above the office door
    const doorPlaqueTex = texBank.createDepartmentSignTexture(
      'BUREAU DU GÉRANT — PRIVÉ',
      'ACCÈS RÉSERVÉ DIRECTION · GESTION & ARCHIVES',
      '#0f2942',
      '#38bdf8'
    );
    const doorPlaqueMat = new THREE.MeshStandardMaterial({ map: doorPlaqueTex, roughness: 0.32 });
    const doorPlaqueFrame = addOfficeBlock(0.032, 0.3, 1.16, 6.065, 2.48, 3.95, mats.anthracite);
    const doorPlaqueFaceGeo = new THREE.PlaneGeometry(1.1, 0.25);
    const doorPlaqueFace = new THREE.Mesh(doorPlaqueFaceGeo, doorPlaqueMat);
    doorPlaqueFace.rotation.y = -Math.PI / 2;
    doorPlaqueFace.position.set(-0.019, 0, 0);
    doorPlaqueFrame.add(doorPlaqueFace);
    ctx.disposables.push(doorPlaqueMat, doorPlaqueFaceGeo);

    // -------------------------------------------------------------------------
    // 2) FULL-HEIGHT NORTH PARTITION WALL (Z = +3.15, X = +6.15..+9.90, Y = 0..4.20m)
    // -------------------------------------------------------------------------
    addOfficeBlock(3.78, 1.05, partThick, 8.04, 0.525, 3.15, mats.wallPlaster);
    addOfficeBlock(3.78, wallH - 2.22, partThick, 8.04, 2.22 + (wallH - 2.22) / 2, 3.15, mats.wallPlaster);
    addOfficeBlock(0.38, 1.17, partThick, 6.34, 1.635, 3.15, mats.wallPlaster);
    addOfficeBlock(0.42, 1.17, partThick, 9.72, 1.635, 3.15, mats.wallPlaster);
    // North observation window with venetian blinds overlooking Produce & Bakery
    addObservationWindow(8.02, 3.15, 2.98, 'x', 1);

    // Exterior 1990 retail horizontal trim bands wrapping the office sales-floor faces (Y = 3.24..3.52)
    addOfficeBlock(0.022, 0.145, 3.26, 6.07, 3.45, 4.78, mats.retailStripeNavy);
    addOfficeBlock(0.024, 0.052, 3.26, 6.07, 3.345, 4.78, mats.retailStripeRed);
    addOfficeBlock(0.02, 0.085, 3.26, 6.07, 3.27, 4.78, mats.retailStripeCream);

    addOfficeBlock(3.78, 0.145, 0.022, 8.02, 3.45, 3.07, mats.retailStripeNavy);
    addOfficeBlock(3.78, 0.052, 0.024, 8.02, 3.345, 3.07, mats.retailStripeRed);
    addOfficeBlock(3.78, 0.085, 0.02, 8.02, 3.27, 3.07, mats.retailStripeCream);

    // -------------------------------------------------------------------------
    // 3) FINISHED MANAGER'S OFFICE INTERIOR (4 Painted Drywall Walls, Wooden
    //    Baseboards, Cork Bulletin Board & Planning, Acoustic Ceiling & Light)
    // -------------------------------------------------------------------------
    // Clean off-white painted drywall interior liner panels on South & East inner walls
    const southDrywallGeo = new THREE.PlaneGeometry(3.72, dropCeilY);
    const southDrywall = new THREE.Mesh(southDrywallGeo, mats.wallPlaster);
    southDrywall.position.set(8.04, dropCeilY / 2, 6.292);
    southDrywall.rotation.y = Math.PI;
    southDrywall.receiveShadow = true;

    const eastDrywallGeo = new THREE.PlaneGeometry(3.16, dropCeilY);
    const eastDrywall = new THREE.Mesh(eastDrywallGeo, mats.wallPlaster);
    eastDrywall.position.set(9.862, dropCeilY / 2, 4.75);
    eastDrywall.rotation.y = -Math.PI / 2;
    eastDrywall.receiveShadow = true;
    office.add(southDrywall, eastDrywall);
    ctx.disposables.push(southDrywallGeo, eastDrywallGeo);

    // Warm Oak Wooden Baseboards ("Plinthes Bois") around all 4 interior office walls
    const bbH = 0.11;
    const bbY = bbH / 2 + 0.012;
    addOfficeBlock(3.64, bbH, 0.024, 8.04, bbY, 3.232, mats.oakWood); // North interior baseboard
    addOfficeBlock(3.64, bbH, 0.024, 8.04, bbY, 6.278, mats.oakWood); // South interior baseboard
    addOfficeBlock(0.024, bbH, 3.08, 9.848, bbY, 4.75, mats.oakWood); // East interior baseboard
    addOfficeBlock(0.024, bbH, 0.24, 6.232, bbY, 3.33, mats.oakWood); // West-North interior baseboard
    addOfficeBlock(0.024, bbH, 1.84, 6.232, bbY, 5.38, mats.oakWood); // West-South interior baseboard

    // Cork Bulletin Board ("Tableau d'Affichage & Planning 1990") mounted on South interior wall
    {
      const boardGrp = new THREE.Group();
      boardGrp.position.set(7.28, 1.62, 6.265);
      boardGrp.rotation.y = Math.PI;
      office.add(boardGrp);

      const bW = 1.24;
      const bH = 0.78;
      const corkFace = new THREE.Mesh(new THREE.PlaneGeometry(bW, bH), mats.officeCorkBoard);
      corkFace.position.z = 0.014;
      const frameBack = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.08, bH + 0.08, 0.024), mats.oakWood);
      const trayLip = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.08, 0.025, 0.065), mats.oakWood);
      trayLip.position.set(0, -bH / 2 - 0.032, 0.022);
      boardGrp.add(frameBack, corkFace, trayLip);
      ctx.disposables.push(corkFace.geometry, frameBack.geometry, trayLip.geometry);

      registerInteractableBox(ctx, boardGrp, {
        id: 'inspect_office_cork_board',
        title: "Tableau d'Affichage & Planning 1990",
        subtitle: 'Planning Équipe Semaine 42 · Consignes & Fournisseurs',
        kind: 'inspect',
        inspectText:
          'Panneau en liège encadré de chêne affichant le planning hebdomadaire du magasin, les rappels de contrôle chaîne du froid (+4 °C) et les numéros d’urgence Centrale-Achat 90.',
        specs: 'Semaine 42 · Ouverture 7j/7 · Contact Express 1990',
        size: [bW + 0.1, bH + 0.1, 0.12],
        position: [0, 0, 0.02],
      });
    }

    // Dedicated Office Dropped Acoustic Ceiling + Compact 1990 Twin-Tube Fluorescent Luminaire
    const officeCeiling = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 3.24), mats.wallPlaster);
    officeCeiling.position.set(8.04, dropCeilY + 0.06, 4.76);

    const officeAcousticUnder = new THREE.Mesh(
      new THREE.PlaneGeometry(3.68, 3.12),
      mats.acousticCeiling
    );
    officeAcousticUnder.rotation.x = Math.PI / 2;
    officeAcousticUnder.position.set(8.04, dropCeilY - 0.004, 4.76);

    const offFixGroup = new THREE.Group();
    offFixGroup.position.set(8.04, dropCeilY - 0.06, 4.76);
    const offFixHousing = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.32), mats.whiteMetal);
    const offTubeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf4fbff,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    const offTubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.34, 8);
    const offTubeL = new THREE.Mesh(offTubeGeo, offTubeMat);
    offTubeL.rotation.z = Math.PI / 2;
    offTubeL.position.set(0, -0.025, -0.075);
    const offTubeR = new THREE.Mesh(offTubeGeo, offTubeMat);
    offTubeR.rotation.z = Math.PI / 2;
    offTubeR.position.set(0, -0.025, 0.075);
    const offLouverGeo = new THREE.BoxGeometry(0.012, 0.045, 0.29);
    for (let li = -3; li <= 3; li++) {
      const fin = new THREE.Mesh(offLouverGeo, mats.stainless);
      fin.position.set(li * 0.19, -0.032, 0);
      offFixGroup.add(fin);
    }
    offFixGroup.add(offFixHousing, offTubeL, offTubeR);

    // Warm 1990 commercial low-pile office carpet tile floor + brushed stainless doorway threshold strip
    const officeCarpetFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.68, 3.1),
      mats.officeCarpet
    );
    officeCarpetFloor.rotation.x = -Math.PI / 2;
    officeCarpetFloor.position.set(8.04, 0.015, 4.75);
    officeCarpetFloor.receiveShadow = true;

    const officeThreshold = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.012, 0.96),
      mats.stainless
    );
    officeThreshold.position.set(6.15, 0.016, 3.95);

    ctx.disposables.push(
      officeCeiling.geometry,
      officeAcousticUnder.geometry,
      offFixHousing.geometry,
      offTubeMat,
      offTubeGeo,
      offLouverGeo,
      officeCarpetFloor.geometry,
      officeThreshold.geometry
    );
    office.add(
      officeCeiling,
      officeAcousticUnder,
      offFixGroup,
      officeCarpetFloor,
      officeThreshold
    );

    // Solid Wall-to-Wall Room Colliders (leaving clear 1.0m doorway at X = 6.15, Z = 3.45..4.45)
    addBoxCollider(ctx, 'office_wall_north', 6.06, 9.95, 3.05, 3.25);
    addBoxCollider(ctx, 'office_wall_west_s', 6.05, 6.25, 4.45, 6.45);
    addBoxCollider(ctx, 'office_wall_west_n', 6.05, 6.25, 3.08, 3.45);

    // Hinged Glass-and-Oak Office Door inside solid jamb frame at X = 6.15, Z = 3.45..4.45
    const doorPivot = new THREE.Group();
    doorPivot.position.set(6.15, 0, 3.48);
    office.add(doorPivot);

    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.056, 2.18, 0.94), mats.oakWood);
    doorPanel.position.set(0, 1.09, 0.47);
    const doorWindow = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.88, 0.54), mats.frostedGlass);
    doorWindow.position.set(0, 1.46, 0.47);
    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.12), mats.chrome);
    doorHandle.position.set(0, 1.04, 0.82);
    ctx.disposables.push(doorPanel.geometry, doorWindow.geometry, doorHandle.geometry);
    doorPivot.add(doorPanel, doorWindow, doorHandle);

    const officeDoorCollider = addBoxCollider(ctx, 'office_door_col', 6.05, 6.25, 3.45, 4.45, true);
    let officeDoorTarget = 0;
    ctx.updaters.push({
      update: (dt) => {
        doorPivot.rotation.y = THREE.MathUtils.damp(doorPivot.rotation.y, officeDoorTarget, 8.0, dt);
      },
    });

    registerInteractableBox(ctx, doorPivot, {
      id: 'office_door_toggle',
      title: 'Porte du Bureau du Gérant',
      subtitle: 'Cloison Vitrée Panoramique',
      kind: 'door_toggle',
      initialState: false,
      inspectText: 'Porte vitrée en chêne donnant accès au bureau administratif du gérant.',
      size: [0.22, 2.2, 0.96],
      position: [0, 1.1, 0.48],
      onToggle: (open) => {
        officeDoorTarget = open ? -Math.PI * 0.48 : 0;
        officeDoorCollider.enabled = !open;
      },
    });

    // Oak Manager's Desk at X = +8.35, Z = +5.15 (facing West/North toward sales floor)
    const desk = new THREE.Group();
    desk.position.set(8.35, 0, 5.15);
    office.add(desk);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 1.68), mats.oakWood);
    deskTop.position.y = 0.76;
    deskTop.castShadow = true;
    const pedestalL = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.74, 0.42), mats.anthracite);
    pedestalL.position.set(0, 0.37, -0.58);
    const pedestalR = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.74, 0.42), mats.anthracite);
    pedestalR.position.set(0, 0.37, 0.58);
    const modestyPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.8), mats.oakWood);
    modestyPanel.position.set(0.34, 0.48, 0);
    ctx.disposables.push(
      deskTop.geometry,
      pedestalL.geometry,
      pedestalR.geometry,
      modestyPanel.geometry
    );
    desk.add(deskTop, pedestalL, pedestalR, modestyPanel);

    // V5/V20: 100% Diegetic 1990 Manager's Office 3D PC Workstation (Tower, CRT, Mouse, Keyboard, Chair, CONTACT-OS 90 + CENTRALE-ACHAT 90)
    buildOfficeWorkstation1990(
      ctx,
      desk,
      office,
      mats,
      wallet,
      orderModel,
      renderer,
      onWalletChanged,
      isSeatedAtDesk,
      setSeatedAtDesk
    );

    // V25: 2 Tall Interactive 5-Drawer Metal Filing Cabinets ("Classeurs de Rangement Utilisables")
    //      All 10 drawers slide smoothly along Z with metallic audio & usable 3D storage slots!
    buildInteractiveOfficeFilingCabinets(ctx, office, mats, tools);

    addBoxCollider(ctx, 'office_desk_col', 7.9, 8.82, 4.3, 6.0);
  }
}
