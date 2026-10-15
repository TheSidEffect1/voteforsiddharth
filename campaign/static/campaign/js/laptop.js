import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const section = document.getElementById("next-section");
const canvas = document.getElementById("laptop-canvas");
const laptopInfo = document.getElementById("laptop-info");
const robotInfo = document.getElementById("robot-info");

if (!section || !canvas) {
  console.error("Laptop section or canvas is missing.");
} else {
  // =========================================
  // SCENE AND CAMERA
  // =========================================

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // =========================================
  // LIGHTING
  // =========================================

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555577, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(-3, 5, 6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x8ba7ff, 2);
  rimLight.position.set(4, 2, -4);
  scene.add(rimLight);

  // =========================================
  // MODEL GROUPS
  // =========================================

  const laptopGroup = new THREE.Group();
  const robotGroup = new THREE.Group();

  scene.add(laptopGroup);
  scene.add(robotGroup);

  robotGroup.visible = false;

  let laptopLoaded = false;
  let robotLoaded = false;

  // Robot blinking animation
  let robotMixer = null;
  let robotBlinkAction = null;
  let robotBlinkStarted = false;

  const clock = new THREE.Clock();

  // =========================================
  // HELPERS
  // =========================================

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function isMobile() {
    return window.innerWidth <= 700;
  }

  // =========================================
  // MODEL LOADER
  // =========================================

  function loadModel(url, group, targetSize, onLoaded) {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDimension = Math.max(size.x, size.y, size.z);

        if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
          console.error("Invalid model dimensions:", url);
          return;
        }

        model.position.sub(center);
        model.scale.multiplyScalar(targetSize / maxDimension);

        model.traverse((object) => {
          if (object.isMesh) {
            object.frustumCulled = false;

            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];

            materials.forEach((material) => {
              if (material) {
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              }
            });
          }
        });

        group.add(model);

        onLoaded(model, gltf.animations || []);

        updateFromScroll();

        console.log("Loaded model:", url);
      },
      undefined,
      (error) => {
        console.error("Could not load model:", url, error);
      },
    );
  }

  // =========================================
  // LAPTOP
  // Keep original model size for desktop.
  // =========================================

  loadModel("/static/campaign/models/laptop.glb", laptopGroup, 2, () => {
    laptopLoaded = true;
  });

  // =========================================
  // ROBOT AND BLINK ANIMATION
  // =========================================

  loadModel(
    "/static/campaign/models/robot.glb",
    robotGroup,
    2.2,
    (model, animations) => {
      robotLoaded = true;

      if (animations.length > 0) {
        robotMixer = new THREE.AnimationMixer(model);

        const blinkClip = animations.find((clip) =>
          /blink|eye/i.test(clip.name),
        );

        const selectedClip =
          blinkClip || (animations.length === 1 ? animations[0] : null);

        if (selectedClip) {
          robotBlinkAction = robotMixer.clipAction(selectedClip);
          robotBlinkAction.setLoop(THREE.LoopRepeat, Infinity);
          robotBlinkAction.clampWhenFinished = false;

          robotBlinkAction.play();
          robotBlinkAction.paused = true;

          console.log("Robot animation available:", selectedClip.name);
        } else {
          console.warn(
            "No identifiable blink animation found. Available clips:",
            animations.map((clip) => clip.name),
          );
        }
      } else {
        console.warn("robot.glb contains no animation clips.");
      }
    },
  );

  // =========================================
  // SCROLL-CONTROLLED ANIMATION
  // =========================================

  function updateFromScroll() {
    const mobile = isMobile();

    const sectionStart = section.getBoundingClientRect().top + window.scrollY;

    const scrollDistance = Math.max(
      1,
      section.offsetHeight - window.innerHeight,
    );

    const rawProgress = (window.scrollY - sectionStart) / scrollDistance;

    const progress = clamp(rawProgress, 0, 1);

    // Laptop entrance and exit
    const laptopProgress = smoothstep(clamp(progress / 0.45, 0, 1));

    const robotProgress = smoothstep(clamp((progress - 0.65) / 0.3, 0, 1));

    const laptopExitProgress = smoothstep(
      clamp((progress - 0.72) / 0.28, 0, 1),
    );

    // -----------------------------------------
    // LAPTOP POSITION
    // Desktop coordinates preserve the original.
    // Mobile laptop stays inside the viewport.
    // -----------------------------------------

    const laptopStartX = mobile ? 0 : -3.0;
    const laptopSettledX = mobile ? 0 : -0.2;
    const laptopStartY = mobile ? -1.8 : -3.0;

    if (laptopLoaded) {
      const entranceX =
        laptopStartX + (laptopSettledX - laptopStartX) * laptopProgress;

      laptopGroup.position.x =
        entranceX + (laptopStartX - entranceX) * laptopExitProgress;

      laptopGroup.position.y =
        laptopStartY * (1 - laptopProgress) + laptopStartY * laptopExitProgress;

      const entranceRotationX = 0.65 * (1 - laptopProgress);

      const entranceRotationY = -0.525 + (-1.5708 + 0.525) * laptopProgress;

      const entranceRotationZ = -0.35 * (1 - laptopProgress);

      laptopGroup.rotation.x =
        entranceRotationX + (0.65 - entranceRotationX) * laptopExitProgress;

      laptopGroup.rotation.y =
        entranceRotationY + (-0.525 - entranceRotationY) * laptopExitProgress;

      laptopGroup.rotation.z =
        entranceRotationZ + (-0.35 - entranceRotationZ) * laptopExitProgress;

      // Make the laptop smaller on mobile without
      // changing the desktop model size.
      laptopGroup.scale.setScalar(mobile ? 0.65 : 1);
    }

    // -----------------------------------------
    // PROJECT TEXT VISIBILITY
    // Mobile gets its own longer visibility range.
    // -----------------------------------------

    if (laptopInfo) {
      const showHackathon = mobile
        ? progress >= 0.1 && progress < 0.72
        : progress >= 0.45 && progress < 0.68;

      laptopInfo.classList.toggle("is-visible", showHackathon);
    }

    if (robotInfo) {
      const showRobotics = mobile ? progress >= 0.92 : progress >= 0.95;

      robotInfo.classList.toggle("is-visible", showRobotics);
    }

    // -----------------------------------------
    // ROBOT POSITION AND ROTATION
    // -----------------------------------------

    if (robotLoaded) {
      robotGroup.visible = progress >= 0.65;

      const robotStartX = mobile ? 1.5 : 4.0;
      const robotEndX = mobile ? 0.2 : 1.8;

      robotGroup.position.x =
        robotStartX + (robotEndX - robotStartX) * robotProgress;

      robotGroup.position.y = -3.0 + 3.0 * robotProgress;
      robotGroup.position.z = 0.3;

      robotGroup.rotation.y = -Math.PI / 2 + (Math.PI / 2) * robotProgress;

      robotGroup.rotation.x = 0.2 - 0.65 * (1 - robotProgress);
      robotGroup.rotation.z = 0.15 + 0.35 * (1 - robotProgress);

      const robotScale = 0.7 + 0.3 * robotProgress;
      robotGroup.scale.setScalar(mobile ? robotScale * 0.8 : robotScale);

      // Start blinking after the robot reaches its final position.
      if (robotProgress >= 1 && !robotBlinkStarted) {
        robotBlinkStarted = true;

        if (robotBlinkAction) {
          robotBlinkAction.reset();
          robotBlinkAction.paused = false;
          robotBlinkAction.play();
        }
      }

      // Stop blinking when the visitor scrolls backwards.
      if (robotProgress < 1 && robotBlinkStarted) {
        robotBlinkStarted = false;

        if (robotBlinkAction) {
          robotBlinkAction.stop();
          robotBlinkAction.paused = true;
        }
      }
    }
  }

  // =========================================
  // RESPONSIVE RENDERER
  // =========================================

  function resizeRenderer() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    updateFromScroll();
  }

  window.addEventListener("scroll", updateFromScroll, {
    passive: true,
  });

  window.addEventListener("resize", resizeRenderer);

  // =========================================
  // RENDER LOOP
  // =========================================

  function render() {
    requestAnimationFrame(render);

    const delta = Math.min(clock.getDelta(), 0.05);

    if (robotMixer && robotBlinkStarted) {
      robotMixer.update(delta);
    }

    renderer.render(scene, camera);
  }

  updateFromScroll();
  render();
}
