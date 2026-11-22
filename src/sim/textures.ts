import * as THREE from 'three';

export const INTERACT_LAYER = 1;

export class ProceduralTextureBank {
  private maxAnisotropy: number;
  private textures: THREE.Texture[] = [];

  constructor(maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy;
  }

  private registerCanvas(
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1,
    isColor = true
  ): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.anisotropy = this.maxAnisotropy;
    if (repeatX !== 1 || repeatY !== 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  createAsphaltTexture(repeatX = 12, repeatY = 10): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#24272c';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle aggregate speckle
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 4500; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const v = Math.floor(28 + rand() * 32);
      ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      ctx.fillRect(x, y, 2, 2);
    }
    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createSupermarketTileTexture(repeatX = 20, repeatY = 14): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e7e5df';
    ctx.fillRect(0, 0, 256, 256);

    // 2x2 porcelain tiles per 256px
    const tile = 128;
    for (let gx = 0; gx < 2; gx++) {
      for (let gy = 0; gy < 2; gy++) {
        const shade = (gx + gy) % 2 === 0 ? '#eceae4' : '#e4e1da';
        ctx.fillStyle = shade;
        ctx.fillRect(gx * tile + 2, gy * tile + 2, tile - 4, tile - 4);
      }
    }

    // Subtle stone fleck
    ctx.fillStyle = 'rgba(120, 115, 108, 0.08)';
    for (let i = 0; i < 320; i++) {
      const x = ((i * 73) % 250) + 3;
      const y = ((i * 139) % 250) + 3;
      ctx.fillRect(x, y, 3, 2);
    }

    // Grout lines
    ctx.strokeStyle = '#c6c2b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createWarehouseEpoxyTexture(repeatX = 10, repeatY = 6): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5f666e';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 500; i++) {
      ctx.fillRect((i * 53) % 256, (i * 97) % 256, 4, 3);
    }
    ctx.strokeStyle = '#4b5158';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createWoodPlankTexture(baseHex = '#b98552', darkHex = '#8d5f34', repeatX = 2, repeatY = 2): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = darkHex;
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < 256; y += 6) {
      ctx.lineWidth = 1 + (y % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(85, y + ((y % 12) - 6), 170, y - ((y % 10) - 5), 256, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    for (let p = 64; p < 256; p += 64) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(256, p);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createHazardStripeTexture(repeatX = 4, repeatY = 1): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#171717';
    for (let x = -128; x < 384; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x - 32, 128);
      ctx.lineTo(x - 64, 128);
      ctx.closePath();
      ctx.fill();
    }
    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createChainLinkTexture(repeatX = 14, repeatY = 5): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 7;
    ctx.lineCap = 'square';

    // Crisp diamond wire mesh
    const step = 64;
    for (let x = -64; x <= 192; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 128, 128);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 128, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }

    // Metallic highlight wire core
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    for (let x = -64; x <= 192; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 128, 128);
      ctx.stroke();
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createConveyorBeltTexture(repeatX = 1, repeatY = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1f2328';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#292e35';
    for (let y = 0; y < 128; y += 8) {
      ctx.fillRect(0, y, 128, 3);
    }
    ctx.fillStyle = '#eab308';
    ctx.fillRect(6, 0, 4, 128);
    ctx.fillRect(118, 0, 4, 128);
    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  createStorefrontSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Authentic 1990 French neighborhood supermarket backlit lightbox gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#0b223d');
    bgGrad.addColorStop(0.5, '#123359');
    bgGrad.addColorStop(1, '#091c33');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle inner backlit perimeter framing line (keeps wide visual margin inside metallic bezel)
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.24)';
    ctx.lineWidth = 4;
    ctx.strokeRect(22, 18, canvas.width - 44, canvas.height - 58);

    // Classic 1990 French retail tricolore express ribbon along bottom edge
    const ribbonY = canvas.height - 30;
    const ribbonH = 30;
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, ribbonY, 682, ribbonH);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(682, ribbonY, 684, ribbonH);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(1366, ribbonY, 682, ribbonH);

    // Top subtle red-and-blue accent pinstripe
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, canvas.width, 8);

    // Generous horizontal padding (>= 64px each side — 128px on 2048px canvas)
    const horizontalPadding = 128;
    const maxTextWidth = canvas.width - horizontalPadding * 2;
    const centerX = canvas.width / 2;

    const fitFont = (text: string, weight: string, startPx: number, minPx: number): number => {
      let sz = startPx;
      ctx.font = `${weight} ${sz}px "Plus Jakarta Sans", sans-serif`;
      while (sz > minPx && ctx.measureText(text).width > maxTextWidth) {
        sz -= 2;
        ctx.font = `${weight} ${sz}px "Plus Jakarta Sans", sans-serif`;
      }
      return sz;
    };

    const mainTitle = 'CONTACT EXPRESS';
    const subTitle = 'SUPERMARCHÉ DE PROXIMITÉ · BOULANGERIE · BOUCHERIE · FRAIS';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main title with crisp 1990 illuminated signage contrast & symmetric side accent emblems
    const titlePx = fitFont(mainTitle, '900', 118, 56);
    ctx.font = `900 ${titlePx}px "Plus Jakarta Sans", sans-serif`;
    const measuredTitleW = ctx.measureText(mainTitle).width;

    // Symmetric 1990 French retail diamond badges left & right if ample margin exists
    const badgeOffset = measuredTitleW / 2 + 78;
    if (centerX - badgeOffset > 76) {
      [-1, 1].forEach((side) => {
        const bx = centerX + side * badgeOffset;
        const by = 124;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(bx, by - 36);
        ctx.lineTo(bx + 36, by);
        ctx.lineTo(bx, by + 36);
        ctx.lineTo(bx - 36, by);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('CE', bx, by + 1);
      });
    }

    ctx.font = `900 ${titlePx}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.fillText(mainTitle, centerX + 3, 127);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mainTitle, centerX, 124);

    // Thin white/red divider bar between title and subtitle
    const divW = Math.min(measuredTitleW * 0.92, maxTextWidth * 0.72);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(centerX - divW / 2, 188, divW * 0.28, 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(centerX - divW / 2 + divW * 0.28, 188, divW * 0.44, 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(centerX - divW / 2 + divW * 0.72, 188, divW * 0.28, 4);

    // Subtitle — 100% auto-fitted inside wide margins, zero clipping
    const subPx = fitFont(subTitle, '700', 38, 20);
    ctx.font = `700 ${subPx}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#dbeafe';
    ctx.fillText(subTitle, centerX, 234);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createTotemSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d')!;

    // Deep 1990 French retail navy illuminated pylon face
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0c2440');
    grad.addColorStop(0.5, '#13365e');
    grad.addColorStop(1, '#091b31');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // White border frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    // Top 1990 tricolore chevron header
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(18, 18, 158, 32);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(176, 18, 160, 32);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(336, 18, 158, 32);

    const cx = canvas.width / 2;
    const maxW = canvas.width - 76;

    const fitLine = (text: string, weight: string, startPx: number, minPx: number) => {
      let sz = startPx;
      ctx.font = `${weight} ${sz}px "Plus Jakarta Sans", sans-serif`;
      while (sz > minPx && ctx.measureText(text).width > maxW) {
        sz -= 2;
        ctx.font = `${weight} ${sz}px "Plus Jakarta Sans", sans-serif`;
      }
      return sz;
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Red diamond CE emblem
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(cx, 110);
    ctx.lineTo(cx + 68, 178);
    ctx.lineTo(cx, 246);
    ctx.lineTo(cx - 68, 178);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CE', cx, 182);

    // Stacked bold brand title
    fitLine('CONTACT', '900', 84, 42);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CONTACT', cx, 326);

    fitLine('EXPRESS', '900', 84, 42);
    ctx.fillStyle = '#f87171';
    ctx.fillText('EXPRESS', cx, 412);

    // Divider pill
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(54, 474, canvas.width - 108, 6);

    // 1990 Supermarket departments list
    const depts = ['SUPERMARCHÉ', 'BOULANGERIE', 'BOUCHERIE', 'PRIMEUR & FRAIS', 'CAVE & SURGELÉS'];
    depts.forEach((line, idx) => {
      const y = 556 + idx * 78;
      fitLine(line, idx === 0 ? '800' : '700', idx === 0 ? 44 : 34, 22);
      ctx.fillStyle = idx === 0 ? '#fde68a' : '#e2e8f0';
      ctx.fillText(line, cx, y);
    });

    // Bottom illuminated status box ("OUVERT 7J/7 · PARKING GRATUIT")
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(46, 976, canvas.width - 92, 92);
    fitLine('OUVERT 7J/7', '900', 48, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('OUVERT 7J/7', cx, 1024);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(46, 1090, canvas.width - 92, 82);
    fitLine('PARKING GRATUIT', '800', 36, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PARKING GRATUIT', cx, 1132);

    // Bottom tricolore trim
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(18, canvas.height - 50, 158, 32);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(176, canvas.height - 50, 160, 32);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(336, canvas.height - 50, 158, 32);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createDepartmentSignTexture(
    title: string,
    subtitle: string,
    bgHex: string,
    accentHex: string,
    textHex = '#ffffff'
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Symmetric top hairline, bottom accent ribbon, and balanced side accent strips
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, canvas.width, 8);
    ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
    ctx.fillRect(0, 0, 14, canvas.height);
    ctx.fillRect(canvas.width - 14, 0, 14, canvas.height);

    const horizontalPadding = 52; // Generous margin (>= 36px) beyond the 14px side trim
    const maxTextWidth = canvas.width - horizontalPadding * 2;
    const centerX = canvas.width / 2;

    const fitFontSize = (
      text: string,
      weight: string,
      initialPx: number,
      minPx: number
    ): number => {
      let fontSize = initialPx;
      ctx.font = `${weight} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      while (fontSize > minPx && ctx.measureText(text).width > maxTextWidth) {
        fontSize -= 1;
        ctx.font = `${weight} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      }
      return fontSize;
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textHex;

    const titlePx = fitFontSize(title, '800', 72, 26);
    ctx.font = `800 ${titlePx}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(title, centerX, 94, maxTextWidth);

    if (subtitle.trim().length > 0) {
      ctx.globalAlpha = 0.88;
      const subPx = fitFontSize(subtitle, '600', 36, 16);
      ctx.font = `600 ${subPx}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(subtitle, centerX, 168, maxTextWidth);
      ctx.globalAlpha = 1;
    }

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createAtmScreenTexture(active = true): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = active ? '#0c4a6e' : '#091520';
    ctx.fillRect(0, 0, 256, 192);

    if (active) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 256, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('DAB EXPRESS 24/7', 16, 27);

      ctx.fillStyle = '#bae6fd';
      ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('INSÉREZ VOTRE CARTE', 40, 82);

      const labels = ['20 €', '50 €', '80 €', 'AUTRE'];
      labels.forEach((lbl, idx) => {
        const x = idx % 2 === 0 ? 14 : 142;
        const y = idx < 2 ? 104 : 144;
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(x, y, 100, 28);
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(x, y, 100, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 14px "JetBrains Mono", monospace';
        ctx.fillText(lbl, x + 26, y + 19);
      });
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillText('MODE VEILLE ÉCO', 54, 100);
    }

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createMonnayeurFrontTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 384);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(16, 18, 224, 58);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('MONNAYEUR', 54, 46);
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('BILLETS → PIÈCES 1€ / 2€', 44, 66);

    // 7-segment style LED window
    ctx.fillStyle = '#090d16';
    ctx.fillRect(36, 98, 184, 44);
    ctx.fillStyle = '#ef4444';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText('PRET  5/10/20E', 45, 127);

    // Instructions
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('1. Insérer billet à plat', 36, 182);
    ctx.fillText('2. Récupérer vos pièces', 36, 206);
    ctx.fillText('   dans l’auget inox', 36, 226);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createMangaShelfTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, 0, 512, 256);

    const series = [
      { name: 'MIANIMAL', bg: '#f97316', fg: '#ffffff' },
      { name: 'VOXELITOS', bg: '#06b6d4', fg: '#082f49' },
      { name: 'LES YIMAI', bg: '#ec4899', fg: '#ffffff' },
      { name: 'CLARA GODWAIE', bg: '#8b5cf6', fg: '#ffffff' },
      { name: 'MIANIMAL', bg: '#eab308', fg: '#1c1917' },
      { name: 'VOXELITOS', bg: '#10b981', fg: '#052e16' },
    ];

    let x = 6;
    let vol = 1;
    while (x < 504) {
      const s = series[vol % series.length];
      const w = 22 + (vol % 3) * 4;
      ctx.fillStyle = s.bg;
      ctx.fillRect(x, 14, w - 2, 236);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, 20, w - 6, 22);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(String((vol % 12) + 1), x + 5, 35);

      ctx.save();
      ctx.translate(x + w / 2 + 3, 145);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = s.fg;
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, 0, 0);
      ctx.restore();

      x += w;
      vol++;
    }

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createGameKioskScreenTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    // Sky & pixel landscape for Voxelitos DX Demo
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#312e81';
    ctx.fillRect(0, 110, 320, 50);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 150, 320, 50);

    // Pixel blocks & character
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(72, 118, 32, 32);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(148, 98, 28, 52);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(216, 126, 24, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VOXELITOS DX', 160, 48);

    ctx.fillStyle = '#fde047';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('DÉMO JOUABLE · APPUYEZ START', 160, 76);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createOfficeMonitorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    // Classic calm blue-teal ERP desktop wallpaper
    const grad = ctx.createLinearGradient(0, 0, 320, 200);
    grad.addColorStop(0, '#0f3d5e');
    grad.addColorStop(1, '#164e63');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 200);

    // Window frame
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(34, 22, 252, 144);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(34, 22, 252, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('ContactERP v1.4 — Bureau Gérant', 44, 38);

    // Mock spreadsheet rows
    ctx.fillStyle = '#334155';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('Rayon Primeur      Stock OK', 48, 68);
    ctx.fillText('Boulangerie        Cuit 07h00', 48, 90);
    ctx.fillText('Frais & Crèmerie   +3.2 °C', 48, 112);
    ctx.fillText('Surgelés           -18.5 °C', 48, 134);
    ctx.fillText('Quai Livraison     Camion #04', 48, 154);

    // Taskbar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 182, 320, 18);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(4, 185, 42, 12);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  createPriceRailTexture(repeatX = 6): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 256, 32);
    for (let x = 8; x < 250; x += 48) {
      ctx.fillStyle = x % 96 === 8 ? '#fef08a' : '#ffffff';
      ctx.fillRect(x, 4, 38, 24);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 4, 8, 22, 5);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 14, 17, 20, 7);
    }
    return this.registerCanvas(canvas, repeatX, 1, true);
  }

  // ==========================================================================
  // V23 ARCHITECTURAL & PBR PROCEDURAL CANVAS TEXTURES (ZERO EXTERNAL ASSETS)
  // ==========================================================================

  /**
   * 1990 French Supermarket 40x40cm speckled terrazzo / ceramic floor tiles
   * Returns paired sRGB albedo map + linear roughnessMap (matte grout vs satin tiles).
   */
  createSupermarketTerrazzoTextures(
    repeatX = 25,
    repeatY = 17.5
  ): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Warm grey-beige recessed grout base
    ctx.fillStyle = '#b9b2a4';
    ctx.fillRect(0, 0, size, size);
    // Grout is high-roughness matte (~0.92 => 235)
    rCtx.fillStyle = 'rgb(236, 236, 236)';
    rCtx.fillRect(0, 0, size, size);

    let seed = 90421;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const tile = size / 2; // 2x2 40cm tiles per 512px (= 80cm physical repeat)
    const grout = 5;
    const baseShades = ['#ede8dd', '#e7e2d5', '#eae5da', '#e5dfd2'];

    for (let gx = 0; gx < 2; gx++) {
      for (let gy = 0; gy < 2; gy++) {
        const tx = gx * tile + grout / 2;
        const ty = gy * tile + grout / 2;
        const tw = tile - grout;
        const th = tile - grout;

        // Ceramic tile warm ivory/cream mineral body
        ctx.fillStyle = baseShades[(gx * 2 + gy) % baseShades.length];
        ctx.fillRect(tx, ty, tw, th);

        // Satin-polished tile face in roughness map (~0.29-0.34 => 74-86)
        const rBase = 76 + ((gx + gy) % 2) * 8;
        rCtx.fillStyle = `rgb(${rBase},${rBase},${rBase})`;
        rCtx.fillRect(tx, ty, tw, th);

        // Subtle satin edge bevel catch-light inside each tile
        ctx.strokeStyle = 'rgba(255, 253, 248, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 1.5, ty + 1.5, tw - 3, th - 3);
        ctx.strokeStyle = 'rgba(130, 122, 108, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

        // Terrazzo mineral aggregate chips (warm ochre, limestone, slate-grey, cream quartz)
        const chipPalette = [
          'rgba(148, 138, 122, 0.36)',
          'rgba(182, 162, 132, 0.34)',
          'rgba(108, 114, 120, 0.28)',
          'rgba(252, 250, 244, 0.58)',
          'rgba(164, 125, 92, 0.22)',
          'rgba(78, 82, 88, 0.24)',
        ];
        for (let i = 0; i < 420; i++) {
          const cx = tx + 4 + rand() * (tw - 8);
          const cy = ty + 4 + rand() * (th - 8);
          const cw = 1.5 + rand() * 4.2;
          const ch = 1.2 + rand() * 3.4;
          const angle = rand() * Math.PI;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.fillStyle = chipPalette[Math.floor(rand() * chipPalette.length)];
          ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
          ctx.restore();

          // Subtle micro-roughness variation on quartz vs limestone chips
          const rChip = rand() > 0.5 ? 60 : 106;
          rCtx.fillStyle = `rgb(${rChip},${rChip},${rChip})`;
          rCtx.fillRect(cx - 1, cy - 1, 2.5, 2.5);
        }
      }
    }

    // Crisp recessed tile grout grid lines
    ctx.strokeStyle = '#a8a092';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tile, 0);
    ctx.lineTo(tile, size);
    ctx.moveTo(0, tile);
    ctx.lineTo(size, tile);
    ctx.stroke();
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    const map = this.registerCanvas(colorCanvas, repeatX, repeatY, true);
    const roughnessMap = this.registerCanvas(roughCanvas, repeatX, repeatY, false);
    return { map, roughnessMap };
  }

  /**
   * Smooth sealed industrial warehouse concrete slab texture with expansion joints
   * Returns paired sRGB albedo map + linear roughnessMap.
   */
  createWarehouseConcreteTextures(
    repeatX = 10,
    repeatY = 3
  ): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    ctx.fillStyle = '#8b929a';
    ctx.fillRect(0, 0, size, size);
    // Sealed industrial concrete base roughness (~0.52 => 132)
    rCtx.fillStyle = 'rgb(134, 134, 134)';
    rCtx.fillRect(0, 0, size, size);

    let seed = 44109;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Soft concrete power-trowel tonal clouding
    for (let i = 0; i < 90; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rad = 28 + rand() * 68;
      const light = rand() > 0.45;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, rad);
      grad.addColorStop(0, light ? 'rgba(218, 224, 232, 0.08)' : 'rgba(54, 60, 68, 0.08)');
      grad.addColorStop(1, 'rgba(139, 146, 154, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);

      const rVal = light ? 114 : 156;
      rCtx.fillStyle = `rgba(${rVal},${rVal},${rVal},0.16)`;
      rCtx.beginPath();
      rCtx.arc(x, y, rad * 0.75, 0, Math.PI * 2);
      rCtx.fill();
    }

    // Fine concrete aggregate speckle
    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const v = Math.floor(108 + rand() * 58);
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.22)`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Control / expansion joint seams around slab edges
    ctx.strokeStyle = '#5e656d';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.strokeStyle = 'rgba(220, 226, 234, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5, 5, size - 10, size - 10);

    rCtx.strokeStyle = 'rgb(228, 228, 228)';
    rCtx.lineWidth = 5;
    rCtx.strokeRect(2, 2, size - 4, size - 4);

    const map = this.registerCanvas(colorCanvas, repeatX, repeatY, true);
    const roughnessMap = this.registerCanvas(roughCanvas, repeatX, repeatY, false);
    return { map, roughnessMap };
  }

  /**
   * 1990 Supermarket 60x60cm micro-perforated suspended acoustic ceiling tile grid
   * with brushed metallic T-bar runners.
   */
  createAcousticCeilingTextures(
    repeatX = 17,
    repeatY = 17
  ): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Off-white acoustic mineral-fiber ceiling panel background
    ctx.fillStyle = '#edf0f2';
    ctx.fillRect(0, 0, size, size);
    // Matte porous mineral fiber (~0.90 => 230)
    rCtx.fillStyle = 'rgb(230, 230, 230)';
    rCtx.fillRect(0, 0, size, size);

    let seed = 77312;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const tile = size / 2; // 2x2 60cm acoustic tiles per 512px
    for (let gx = 0; gx < 2; gx++) {
      for (let gy = 0; gy < 2; gy++) {
        const tx = gx * tile;
        const ty = gy * tile;
        ctx.fillStyle = (gx + gy) % 2 === 0 ? '#f1f3f5' : '#eceff2';
        ctx.fillRect(tx + 7, ty + 7, tile - 14, tile - 14);

        // Subtle recessed reveal shadow next to the metallic T-bar lip
        ctx.strokeStyle = 'rgba(100, 112, 126, 0.24)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tx + 8, ty + 8, tile - 16, tile - 16);

        // Micro-perforated acoustic pinholes & mineral fissures
        for (let i = 0; i < 480; i++) {
          const px = tx + 14 + rand() * (tile - 28);
          const py = ty + 14 + rand() * (tile - 28);
          const isFissure = rand() > 0.84;
          ctx.fillStyle = isFissure ? 'rgba(130, 138, 148, 0.34)' : 'rgba(148, 156, 166, 0.26)';
          ctx.fillRect(px, py, isFissure ? 4.5 : 1.8, isFissure ? 1.6 : 1.8);
        }
      }
    }

    // Metallic brushed T-bar suspension grid (crisp architectural framing)
    const drawTBar = (x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = '#c8d0da';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#e2e8f0';
      if (w > h) {
        ctx.fillRect(x, y + Math.floor(h / 2) - 1, w, 2);
      } else {
        ctx.fillRect(x + Math.floor(w / 2) - 1, y, 2, h);
      }
      // Satin metallic T-bar roughness (~0.32 => 82)
      rCtx.fillStyle = 'rgb(82, 82, 82)';
      rCtx.fillRect(x, y, w, h);
    };

    const barW = 12;
    drawTBar(0, 0, size, barW / 2);
    drawTBar(0, size - barW / 2, size, barW / 2);
    drawTBar(0, 0, barW / 2, size);
    drawTBar(size - barW / 2, 0, barW / 2, size);
    drawTBar(tile - barW / 2, 0, barW, size);
    drawTBar(0, tile - barW / 2, size, barW);

    const map = this.registerCanvas(colorCanvas, repeatX, repeatY, true);
    const roughnessMap = this.registerCanvas(roughCanvas, repeatX, repeatY, false);
    return { map, roughnessMap };
  }

  /**
   * Subtle 1990 warm ivory roller-painted plaster wall texture for sales floor walls.
   */
  createPaintedPlasterTexture(repeatX = 6, repeatY = 2): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f3f1ea';
    ctx.fillRect(0, 0, size, size);

    let seed = 31901;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Gentle roller plaster mottling
    for (let i = 0; i < 70; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 24 + rand() * 54;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 254, 250, 0.14)' : 'rgba(196, 189, 176, 0.08)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine painted roller stipple grain
    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const shade = rand() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(165,158,146,0.12)';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 2, 2);
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  /**
   * Painted industrial concrete cinder-block (parpaing peint) wall texture for the Rear Warehouse.
   */
  createWarehouseCinderBlockTexture(repeatX = 8, repeatY = 3): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Recessed mortar bed base
    ctx.fillStyle = '#9ca5b0';
    ctx.fillRect(0, 0, size, size);

    let seed = 55219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const rows = 8;
    const cols = 4;
    const bh = size / rows;
    const bw = size / cols;
    const mortar = 4;

    for (let r = 0; r < rows; r++) {
      const offsetX = r % 2 === 1 ? bw / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const bx = c * bw + offsetX;
        const by = r * bh;
        const v = Math.floor(214 + (rand() - 0.5) * 14);
        ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 6})`;
        ctx.fillRect(bx + mortar / 2, by + mortar / 2, bw - mortar, bh - mortar);

        // Top subtle highlight lip & bottom shadow inside each painted concrete block
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(bx + mortar / 2, by + mortar / 2, bw - mortar, 2.5);
        ctx.fillStyle = 'rgba(71, 85, 105, 0.16)';
        ctx.fillRect(bx + mortar / 2, by + bh - mortar / 2 - 2.5, bw - mortar, 2.5);
      }
    }

    // Porous cinder-block surface pits under paint
    for (let i = 0; i < 3600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle = rand() > 0.3 ? 'rgba(100, 112, 126, 0.14)' : 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(x, y, 2, 1.8);
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  /**
   * Warm 1990 French office commercial low-pile speckled carpet tile texture.
   */
  createOfficeCarpetTexture(repeatX = 4, repeatY = 3.5): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Warm 1990 slate-taupe commercial low-pile carpet base
    ctx.fillStyle = '#6f7882';
    ctx.fillRect(0, 0, size, size);

    let seed = 88213;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // 2x2 alternating ribbed carpet tiles (subtle directional pile difference)
    const tile = size / 2;
    for (let gx = 0; gx < 2; gx++) {
      for (let gy = 0; gy < 2; gy++) {
        const tx = gx * tile;
        const ty = gy * tile;
        const horiz = (gx + gy) % 2 === 0;
        ctx.fillStyle = horiz ? '#6d7783' : '#737d88';
        ctx.fillRect(tx, ty, tile, tile);

        ctx.fillStyle = 'rgba(42, 48, 56, 0.14)';
        if (horiz) {
          for (let y = ty; y < ty + tile; y += 4) {
            ctx.fillRect(tx, y, tile, 1.5);
          }
        } else {
          for (let x = tx; x < tx + tile; x += 4) {
            ctx.fillRect(x, ty, 1.5, tile);
          }
        }

        // Subtle carpet tile border seam
        ctx.strokeStyle = 'rgba(48, 54, 62, 0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 1, ty + 1, tile - 2, tile - 2);
      }
    }

    // Warm speckled textile tweed flecks (beige, navy, charcoal, light wool)
    const flecks = [
      'rgba(218, 206, 186, 0.34)',
      'rgba(48, 58, 72, 0.34)',
      'rgba(180, 174, 162, 0.28)',
      'rgba(92, 108, 126, 0.32)',
    ];
    for (let i = 0; i < 4600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle = flecks[Math.floor(rand() * flecks.length)];
      ctx.fillRect(x, y, 2, 2);
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  /**
   * Transparent-background industrial yellow 45-degree hatched safety marking
   * for warehouse pallet loading zones and loading dock apron.
   */
  createHatchedLoadingZoneTexture(repeatX = 3, repeatY = 2): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.78)';
    for (let x = -size; x < size * 2; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 20 - size, size);
      ctx.lineTo(x - size, size);
      ctx.closePath();
      ctx.fill();
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  // ==========================================================================
  // V26 360° EXTERIOR CLADDING, OFFICE CORK BOARD & ARCHITECTURAL DETAILS
  // ==========================================================================

  /**
   * 1990 French retail vertical ribbed corrugated steel cladding ("Bardage Métallique Nervuré")
   * in light grey-blue / cool silver-cream with paired linear roughnessMap.
   */
  createCorrugatedCladdingTextures(
    repeatX = 14,
    repeatY = 1
  ): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const w = 512;
    const h = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = w;
    colorCanvas.height = h;
    const ctx = colorCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = w;
    roughCanvas.height = h;
    const rCtx = roughCanvas.getContext('2d')!;

    // 8 vertical trapezoidal corrugation ribs across 512px
    const ribW = 64;
    for (let rx = 0; rx < w; rx += ribW) {
      // Base trough (cool grey-blue)
      const grad = ctx.createLinearGradient(rx, 0, rx + ribW, 0);
      grad.addColorStop(0.0, '#aeb9c7');
      grad.addColorStop(0.14, '#dfe5ec'); // Highlight bevel
      grad.addColorStop(0.46, '#d3dce6'); // Raised rib crown
      grad.addColorStop(0.58, '#8d9aab'); // Deep cast flute shadow
      grad.addColorStop(0.74, '#bcc6d2'); // Recessed trough
      grad.addColorStop(0.92, '#c5cfd9');
      grad.addColorStop(1.0, '#aeb9c7');
      ctx.fillStyle = grad;
      ctx.fillRect(rx, 0, ribW, h);

      // Brushed metal roughness variation across flutes vs crowns (~0.36..0.52)
      const rGrad = rCtx.createLinearGradient(rx, 0, rx + ribW, 0);
      rGrad.addColorStop(0.0, 'rgb(122,122,122)');
      rGrad.addColorStop(0.25, 'rgb(92,92,92)');
      rGrad.addColorStop(0.55, 'rgb(142,142,142)');
      rGrad.addColorStop(0.85, 'rgb(108,108,108)');
      rGrad.addColorStop(1.0, 'rgb(122,122,122)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(rx, 0, ribW, h);
    }

    // Subtle horizontal panel seam & factory fastener rivets
    ctx.fillStyle = 'rgba(71, 85, 105, 0.24)';
    ctx.fillRect(0, 255, w, 2);
    for (let rx = 18; rx < w; rx += ribW) {
      ctx.fillStyle = 'rgba(51, 65, 85, 0.45)';
      ctx.fillRect(rx, 248, 3, 3);
      ctx.fillRect(rx, 260, 3, 3);
    }

    // Gentle vertical weathering gradient (subtle rain patina near top/bottom)
    const vShade = ctx.createLinearGradient(0, 0, 0, h);
    vShade.addColorStop(0, 'rgba(30, 41, 59, 0.12)');
    vShade.addColorStop(0.15, 'rgba(255, 255, 255, 0.03)');
    vShade.addColorStop(0.85, 'rgba(0, 0, 0, 0.0)');
    vShade.addColorStop(1, 'rgba(30, 41, 59, 0.14)');
    ctx.fillStyle = vShade;
    ctx.fillRect(0, 0, w, h);

    const map = this.registerCanvas(colorCanvas, repeatX, repeatY, true);
    const roughnessMap = this.registerCanvas(roughCanvas, repeatX, repeatY, false);
    return { map, roughnessMap };
  }

  /**
   * Exterior cast-concrete lower foundation plinth ("Soubassement Béton") texture.
   */
  createExteriorConcretePlinthTexture(repeatX = 12, repeatY = 1): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#9aa1aa';
    ctx.fillRect(0, 0, size, size);

    let seed = 61209;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const v = Math.floor(124 + rand() * 52);
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.28)`;
      ctx.fillRect(x, y, 2.5, 2);
    }

    // Formwork panel vertical joint + tie-rod holes + bottom splash darkening
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, size);
    ctx.stroke();

    ctx.fillStyle = 'rgba(55, 65, 81, 0.42)';
    [42, 214].forEach((tx) => {
      ctx.beginPath();
      ctx.arc(tx, 92, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(0.08, 'rgba(255,255,255,0)');
    grad.addColorStop(0.78, 'rgba(30,41,59,0)');
    grad.addColorStop(1, 'rgba(30,41,59,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  /**
   * Horizontal ribbed galvanized metal roll-up shutter door slats ("Rideau Métallique Quai").
   */
  createRollUpShutterTexture(repeatX = 2, repeatY = 5): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const slatH = 32;
    for (let y = 0; y < size; y += slatH) {
      const grad = ctx.createLinearGradient(0, y, 0, y + slatH);
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(0.14, '#cbd5e1');
      grad.addColorStop(0.45, '#b6c2cf');
      grad.addColorStop(0.75, '#94a3b8');
      grad.addColorStop(0.92, '#475569');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, size, slatH);
    }

    // Subtle vertical scuff streaks from rolling drum
    ctx.fillStyle = 'rgba(30, 41, 59, 0.08)';
    for (let x = 22; x < size; x += 54) {
      ctx.fillRect(x, 0, 8, size);
    }

    return this.registerCanvas(canvas, repeatX, repeatY, true);
  }

  /**
   * Exterior industrial aluminum louver ventilation grille texture.
   */
  createVentGrilleTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    for (let y = 12; y < size - 12; y += 18) {
      const g = ctx.createLinearGradient(0, y, 0, y + 12);
      g.addColorStop(0, '#e2e8f0');
      g.addColorStop(0.55, '#94a3b8');
      g.addColorStop(1, '#334155');
      ctx.fillStyle = g;
      ctx.fillRect(10, y, size - 20, 11);
    }

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, size - 10, size - 10);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  /**
   * 1990 French "SORTIE DE SECOURS" green & white safety plaque above exterior emergency exits.
   */
  createEmergencyExitSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 512, 144);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 128);

    // Simple white doorway + arrow pictogram on left
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(30, 32, 46, 80);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(42, 46, 18, 66);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(92, 72);
    ctx.lineTo(118, 52);
    ctx.lineTo(118, 64);
    ctx.lineTo(142, 64);
    ctx.lineTo(142, 80);
    ctx.lineTo(118, 80);
    ctx.lineTo(118, 92);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SORTIE DE', 162, 54);
    ctx.fillText('SECOURS', 162, 98);

    return this.registerCanvas(canvas, 1, 1, true);
  }

  /**
   * 1990 Manager's Office Cork Bulletin Board ("Tableau d'Affichage & Planning")
   */
  createOfficeCorkBoardTexture(): THREE.CanvasTexture {
    const w = 512;
    const h = 320;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Textured warm cork background
    ctx.fillStyle = '#b9834f';
    ctx.fillRect(0, 0, w, h);

    let seed = 19904;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 4200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(130, 82, 40, 0.34)' : 'rgba(232, 194, 146, 0.28)';
      ctx.fillRect(x, y, 2.5, 2);
    }

    // Sheet 1: Weekly Staff Planning Schedule (Left)
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(28, 30, 212, 248);
    ctx.fillStyle = '#fffef9';
    ctx.fillRect(24, 26, 212, 248);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(24, 26, 212, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLANNING ÉQUIPE — S42', 130, 47);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    const rows = [
      'LUN  06h30  LIVRAISON FRAIS',
      'MAR  07h00  BOULANGERIE',
      'MER  08h00  INVENTAIRE RAY.',
      'JEU  06h30  CENTRALE-ACHAT',
      'VEN  07h30  MISE EN RAYON',
      'SAM  07h00  CAISSES 1 & 2',
      'DIM  08h00  OUVERTURE 7J/7',
    ];
    rows.forEach((line, idx) => {
      const ry = 80 + idx * 26;
      ctx.fillStyle = idx % 2 === 0 ? '#f1f5f9' : '#ffffff';
      ctx.fillRect(32, ry - 12, 196, 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(line, 36, ry + 2);
    });

    // Sheet 2: Yellow Sticky Memo (Top-Right)
    ctx.save();
    ctx.translate(320, 96);
    ctx.rotate(0.04);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(-58, -56, 124, 114);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-62, -60, 124, 114);
    ctx.fillStyle = '#713f12';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('RAPPEL GÉRANT :', -52, -34);
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('• VÉRIFIER +4°C', -52, -10);
    ctx.fillText('• RÉGLETTES PRIX', -52, 10);
    ctx.fillText('• PRESSE CARTONS', -52, 30);
    ctx.restore();

    // Sheet 3: Supplier Contacts Card (Bottom-Right)
    ctx.save();
    ctx.translate(390, 224);
    ctx.rotate(-0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(-94, -56, 190, 118);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-98, -60, 190, 118);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-98, -60, 190, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('URGENCES & FOURNISSEURS', -88, -45);
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('CENTRALE-ACHAT: 36 15', -88, -18);
    ctx.fillText('FROID +4°C: 42 18 90 04', -88, 4);
    ctx.fillText('MAINTENANCE: 42 18 90 12', -88, 26);
    ctx.fillText('CAISSE BANQUE: CODE 1990', -88, 46);
    ctx.restore();

    // Colored push-pins
    const pins: Array<[number, number, string]> = [
      [130, 32, '#dc2626'],
      [322, 42, '#2563eb'],
      [392, 170, '#16a34a'],
      [446, 56, '#eab308'],
    ];
    pins.forEach(([px, py, col]) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(px + 2, py + 3, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(px - 2, py - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    return this.registerCanvas(canvas, 1, 1, true);
  }

  dispose(): void {
    for (const t of this.textures) {
      t.dispose();
    }
    this.textures = [];
  }
}
