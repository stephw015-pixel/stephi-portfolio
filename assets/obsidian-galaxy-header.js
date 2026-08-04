import * as THREE from 'https://unpkg.com/three@0.181.1/build/three.module.js';

const canvas = document.querySelector('.hero-galaxy-canvas');
const hero = document.querySelector('.hero');

if (canvas && hero) {
  const graph = await fetch('assets/obsidian-graph.json').then((response) => response.json());
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.35 : 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
  camera.position.set(-3, 2.5, 31);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e2ff, 2.15));
  const accentLight = new THREE.PointLight(0xff65c8, 20, 100);
  accentLight.position.set(-14, 12, 16);
  scene.add(accentLight);

  const galaxyGroup = new THREE.Group();
  const galaxyBasePosition = new THREE.Vector3(8, 1.6, -3);
  galaxyGroup.position.copy(galaxyBasePosition);
  galaxyGroup.scale.setScalar(isCoarsePointer ? 2.05 : 2.62);
  scene.add(galaxyGroup);

  const palette = [
    new THREE.Color('#ff2f92'),
    new THREE.Color('#00b7ff'),
    new THREE.Color('#ffcc00'),
    new THREE.Color('#00d084'),
    new THREE.Color('#8d38ff'),
    new THREE.Color('#ff6a00'),
    new THREE.Color('#2df7ff'),
    new THREE.Color('#ff4fd8'),
    new THREE.Color('#006dff'),
    new THREE.Color('#b8ff2d')
  ];

  function makeDotTexture() {
    const size = 96;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.16, 'rgba(255,255,255,0.36)');
    gradient.addColorStop(0.48, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const dotTexture = makeDotTexture();
  const nodeCount = graph.nodes.length;
  const nodePositions = [];
  const nodeById = new Map();
  const curveRadius = isCoarsePointer ? 16 : 20;

  graph.nodes.forEach((node, index) => {
    const ring = index / Math.max(1, nodeCount);
    const angle = ring * Math.PI * 10.8;
    const radius = 5 + Math.sqrt(index + 1) * 1.8 + Math.sin(index * 1.71) * 2.8;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(index * 0.83) * 8.5 + (node.degree || 1) * 0.18,
      Math.sin(angle) * radius - curveRadius + 2
    );
    nodePositions.push(position);
    nodeById.set(node.id, { node, index, position });
  });

  const starPositions = new Float32Array(nodeCount * 3);
  const starColors = new Float32Array(nodeCount * 3);
  nodePositions.forEach((position, index) => {
    starPositions.set([position.x, position.y, position.z], index * 3);
    const color = palette[index % palette.length].clone().lerp(new THREE.Color('#fff8ff'), Math.min(0.04, graph.nodes[index].degree / 120));
    starColors.set([color.r, color.g, color.b], index * 3);
  });

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: isCoarsePointer ? 3.25 : 4.25,
    sizeAttenuation: true,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  galaxyGroup.add(stars);

  const bgCount = isCoarsePointer ? 220 : 430;
  const bgPositions = new Float32Array(bgCount * 3);
  const bgColors = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount; i += 1) {
    const radius = 70 + Math.random() * 210;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.cos(phi) * radius * 0.65;
    const z = Math.sin(phi) * Math.sin(theta) * radius - 60;
    bgPositions.set([x, y, z], i * 3);
    const color = palette[i % palette.length].clone().lerp(new THREE.Color('#fff8ff'), 0.04);
    bgColors.set([color.r, color.g, color.b], i * 3);
  }

  const bgGeometry = new THREE.BufferGeometry();
  bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
  bgGeometry.setAttribute('color', new THREE.BufferAttribute(bgColors, 3));
  const bgStars = new THREE.Points(bgGeometry, new THREE.PointsMaterial({
    size: isCoarsePointer ? 0.78 : 1.0,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    map: dotTexture
  }));
  scene.add(bgStars);

  const linkVertices = [];
  const linkColors = [];
  graph.links.slice(0, isCoarsePointer ? 70 : 118).forEach((link, index) => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) return;
    linkVertices.push(source.position.x, source.position.y, source.position.z);
    linkVertices.push(target.position.x, target.position.y, target.position.z);
    const color = palette[index % palette.length].clone().lerp(new THREE.Color('#fff4fb'), 0.02);
    linkColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  });

  const linkGeometry = new THREE.BufferGeometry();
  linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linkVertices, 3));
  linkGeometry.setAttribute('color', new THREE.Float32BufferAttribute(linkColors, 3));
  const links = new THREE.LineSegments(linkGeometry, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    linewidth: 1.8,
    fog: false,
    blending: THREE.NormalBlending
  }));
  galaxyGroup.add(links);

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(hero);
  resize();

  const clock = new THREE.Clock();

  function animate() {
    const elapsed = clock.getElapsedTime();
    const motion = prefersReducedMotion ? 0.12 : 1;

    starMaterial.size = (isCoarsePointer ? 3.25 : 4.25) + Math.sin(elapsed * 2.65) * 0.22 * motion;
    galaxyGroup.position.x = galaxyBasePosition.x + Math.sin(elapsed * 0.72) * 2.8 * motion;
    galaxyGroup.position.y = galaxyBasePosition.y + Math.cos(elapsed * 0.58) * 1.45 * motion;
    galaxyGroup.position.z = galaxyBasePosition.z + Math.sin(elapsed * 0.46) * 1.2 * motion;
    galaxyGroup.rotation.y = elapsed * 0.105 * motion + Math.sin(elapsed * 0.62) * 0.34 * motion;
    galaxyGroup.rotation.x = Math.sin(elapsed * 0.74) * 0.16 * motion;
    galaxyGroup.rotation.z = Math.sin(elapsed * 0.48) * 0.07 * motion;
    bgStars.rotation.y = elapsed * 0.04 * motion;
    bgStars.rotation.x = -elapsed * 0.018 * motion;

    const breathe = Math.sin(elapsed * 0.92) * 2.3 * motion;
    camera.position.x = -3 + Math.sin(elapsed * 0.4) * 2.4 * motion;
    camera.position.y = 2.5 + Math.cos(elapsed * 0.36) * 1.2 * motion;
    camera.position.z = 31 + breathe;
    camera.lookAt(3 + Math.sin(elapsed * 0.28) * 1.2 * motion, 0.6, -14);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}
