// Realistic HD asset preloader for gta_2 (Kowloon Noir)

const MANIFEST = {
  // 4 HD 2.5D street panoramas
  "scene_temple-nightmarket": "./assets/scenes/temple-nightmarket.png",
  "scene_kowloon-cbd": "./assets/scenes/kowloon-cbd.png",
  "scene_kwai-wharf": "./assets/scenes/kwai-wharf.png",
  "scene_tsing-viaduct": "./assets/scenes/tsing-viaduct.png",

  // 2 VN Event CGs
  "cg_prologue": "./assets/cg/prologue.png",
  "cg_finale": "./assets/cg/finale.png",

  // 5 VN Portraits
  "portrait_chen": "./assets/portraits/chen.png",
  "portrait_lin": "./assets/portraits/lin.png",
  "portrait_zhou": "./assets/portraits/zhou.png",
  "portrait_shen": "./assets/portraits/shen.png",
  "portrait_kun": "./assets/portraits/kun.png",

  // Protagonist key-pose sprites
  "sprite_chen_idle": "./assets/sprites/chen_idle.png",
  "sprite_chen_run": "./assets/sprites/chen_run.png",
  "sprite_chen_cast": "./assets/sprites/chen_cast.png",
  "sprite_lin_idle": "./assets/sprites/lin_idle.png",
  "sprite_lin_run": "./assets/sprites/lin_run.png",
  "sprite_lin_cast": "./assets/sprites/lin_cast.png",

  // Pedestrian sprites
  "sprite_ped_tourist": "./assets/sprites/ped_tourist.png",
  "sprite_ped_skater": "./assets/sprites/ped_skater.png",
  "sprite_ped_vendor": "./assets/sprites/ped_vendor.png",
  "sprite_ped_brawler": "./assets/sprites/ped_brawler.png",
  "sprite_ped_police": "./assets/sprites/ped_police.png",

  // Vehicles
  "veh_sedan": "./assets/vehicles/sedan.png",
  "veh_police": "./assets/vehicles/police.png",
  "veh_convertible": "./assets/vehicles/convertible.png",
  "veh_muscle": "./assets/vehicles/muscle.png",
  "veh_trike_mobility": "./assets/vehicles/trike_mobility.png",
  "veh_trike_cargo": "./assets/vehicles/trike_cargo.png",

  // Street Props
  "prop_hydrant": "./assets/props/hydrant.png",
  "prop_barrel": "./assets/props/barrel.png",
  "prop_umbrella": "./assets/props/umbrella.png",
  "prop_vending": "./assets/props/vending.png",
  "prop_ramp": "./assets/props/ramp.png",
};

export class AssetStore {
  constructor() {
    this.images = new Map();
    this.ready = false;
  }

  get(key) {
    return this.images.get(key) || null;
  }

  loadAll() {
    const entries = Object.entries(MANIFEST);
    return Promise.all(
      entries.map(
        ([key, src]) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(key, img);
              resolve(img);
            };
            img.onerror = () => {
              resolve(null);
            };
            img.src = src;
          })
      )
    ).then(() => {
      this.ready = true;
      return this;
    });
  }
}
