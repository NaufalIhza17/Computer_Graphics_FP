import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { math } from './math.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/FBXLoader.js';

export const world = (() => {
  const START_POS = 100;
  const SEPARATION_DISTANCE = 20;

  class WorldObject {
    constructor(params) {
      this.position = new THREE.Vector3();
      this.quaternion = new THREE.Quaternion();
      this.scale = 1.0;
      this.collider = new THREE.Box3();

      this.params_ = params;
      this.mesh = null;
      this.LoadModel_();
    }

    LoadModel_() {
      const texLoader = new THREE.TextureLoader();
      const texture = texLoader.load('./resources/DesertPack/Blend/Textures/Ground.png');
      texture.encoding = THREE.sRGBEncoding;

      const loader = new FBXLoader();
      loader.setPath('./resources/DesertPack/FBX/');
      loader.load('car' + math.rand_int(1, 7) + '.fbx', (fbx) => {
        fbx.scale.setScalar(5);
        this.mesh = fbx;
        this.params_.scene.add(this.mesh);
        this.mesh.traverse(c => {
          if (c.geometry) {
            c.geometry.computeBoundingBox();
          }
          let materials = c.material;
          if (!(c.material instanceof Array)) {
            materials = [c.material];
          }
          for (let m of materials) {
            if (m) {
              if (texture) {
                m.map = texture;
              }
              m.specular = new THREE.Color(0x000000);
            }
          }
          c.castShadow = true;
          c.receiveShadow = true;
        });
      });
    }

    UpdateCollider_() {
      this.collider.setFromObject(this.mesh);
    }

    Update(timeElapsed) {
      if (!this.mesh) {
        return;
      }
      this.mesh.position.copy(this.position);
      this.mesh.quaternion.copy(this.quaternion);
      this.mesh.scale.setScalar(this.scale);
      this.UpdateCollider_();
    }
  }

  class WorldManager {
    constructor(params) {
      this.objects_ = [];
      this.unused_ = [];
      this.speed_ = 12; // Initial speed
      this.params_ = params;
      this.score_ = 0.0;
      this.scoreText_ = '00000';
      this.separationDistance_ = SEPARATION_DISTANCE;
      this.speedIncreaseRate_ = 1; // Speed increase rate
      this.speedIncreaseInterval_ = 2; // Speed increase interval (in seconds)
      this.elapsedTime_ = 0; // Elapsed time
      this.clock = new THREE.Clock();
    }

    GetColliders() {
      return this.objects_;
    }

    SpawnObj_(scale, offset) {
      let obj = null;

      if (this.unused_.length > 0) {
        obj = this.unused_.pop();
        obj.mesh.visible = true;
      } else {
        obj = new WorldObject(this.params_);
      }

      obj.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      obj.position.x = START_POS + offset;
      obj.position.y = 0.01; // Adjust the height of the car above the ground
      obj.scale = scale * 0.01;
      this.objects_.push(obj);
    }

    SpawnCluster_() {
      const scaleIndex = math.rand_int(0, 1);
      const scales = [1, 0.5];
      const ranges = [2, 3];
      const scale = scales[scaleIndex];
      const numObjects = math.rand_int(1, ranges[scaleIndex]);

      for (let i = 0; i < numObjects; ++i) {
        const offset = i * 1 * scale;
        this.SpawnObj_(scale, offset);
      }
    }

    MaybeSpawn_() {
      const closest = this.objects_.length > 0 ? this.objects_[this.objects_.length - 1].position.x : SEPARATION_DISTANCE;

      if (Math.abs(START_POS - closest) > this.separationDistance_) {
        this.SpawnCluster_();
        this.separationDistance_ = math.rand_range(SEPARATION_DISTANCE, SEPARATION_DISTANCE * 1.5);
      }
    }

    Update() {
      const delta = this.clock.getDelta();
      this.MaybeSpawn_();
      this.UpdateColliders_(delta);
      this.UpdateScore_(delta);
      this.UpdateSpeed_(delta);
    }

    UpdateScore_(delta) {
      this.score_ += delta * 10.0;
      const scoreText = Math.round(this.score_).toLocaleString('en-US', { minimumIntegerDigits: 5, useGrouping: false });

      if (scoreText === this.scoreText_) {
        return;
      }

      document.getElementById('score-text').innerText = scoreText;
      localStorage.setItem('score', scoreText);

      var event = new CustomEvent('scoreUpdated', { detail: scoreText });
      window.dispatchEvent(event);
    }

    UpdateColliders_(delta) {
      const invisible = [];
      const visible = [];

      for (let obj of this.objects_) {
        obj.position.x -= delta * this.speed_;

        if (obj.position.x < -20) {
          invisible.push(obj);
          obj.mesh.visible = false;
        } else {
          visible.push(obj);
        }
      }

      this.objects_ = visible;
      this.unused_.push(...invisible);

      // Update collider after updating object positions
      for (let obj of visible) {
        obj.Update(delta);
      }
    }

    UpdateSpeed_(delta) {
      this.elapsedTime_ += delta;
      if (this.elapsedTime_ >= this.speedIncreaseInterval_) {
        this.speed_ += this.speedIncreaseRate_;
        this.elapsedTime_ = 0;
      }
    }
  }

  return {
    WorldManager: WorldManager,
  };
})();
