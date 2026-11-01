import { pageContent, site } from '../content.jsx';

const EN = pageContent('landing', 'en'), ID = pageContent('landing', 'id');

export var MODEL_URL = '/models/arolyzer.glb'; // meshopt-compressed GLB

export var PART_RULES = [
  ['gauge', /^Pressure[ _]Gauge/], ['bolts', /^Baut/], ['lid', /^Tutup[ _]Reaktor/], ['handle', /^Pemutar[ _]Reaktor/],
  ['fan', /^(Normal[ _]fan|Tutup[ _]Fan|Fan[ _]Blower)/], ['fuelDoor', /^Tutup[ _]Bahan/], ['ash', /^Laci[ _]Abu/],
  ['valve', /^Globe[ _]Valve/], ['nozzle', /^(Nuzzle|Pipa[ _]Nuzzle|Pipa[ _]L:?3$)/], ['pipes', /^Pipa/],
  ['insulator', /^Insulator/], ['reactor', /^Reaktor/], ['stove', /^Rocket[ _]Stove/], ['legs', /^Kaki/]
];

export var GAS_PATH = [[0.107, 0.479, 0.15], [0.083, 0.49, 0.15], [0.03, 0.475, 0.15], [-0.031, 0.468, 0.15], [-0.0385, 0.44, 0.15], [-0.0385, 0.02, 0.15], [-0.039, 0.005, 0.16], [-0.039, -0.002, 0.18], [-0.032, -0.002, 0.203], [-0.017, -0.002, 0.21]];

// Which parts light up and how the fire, fan and gas animate in each "How it works" step.
// The words for each step live in content/<lang>/landing.json under "steps" (same order).
var STEP_RIGS = [{"parts":["reactor","lid","bolts"],"closeLid":true,"fan":0,"fire":0,"gas":0},{"parts":["stove","fuelDoor"],"fan":0,"fire":0.6,"gas":0},{"parts":["insulator","reactor","stove"],"xray":true,"glow":"#E8762C","fan":0,"fire":1.2,"gas":0},{"parts":["valve","pipes","nozzle"],"xray":true,"fan":0.2,"fire":1,"gas":1},{"parts":["fan"],"fan":1,"fire":1,"gas":1},{"parts":["stove","fan"],"glow":"#E8762C","fan":1.4,"fire":1.8,"gas":0.6},{"parts":["handle","lid","reactor","insulator","bolts"],"tip":true,"fan":0.15,"fire":0.1,"gas":0},{"parts":["ash","stove"],"drawer":true,"fan":0,"fire":0,"gas":0}];
export var STEPS = STEP_RIGS.map(function (rig, i) {
  var en = EN.steps[i] || {}, id = (ID.steps && ID.steps[i]) || {};
  return Object.assign({}, rig, { title: en.title, body: en.body, tags: en.tags, titleId: id.title || en.title, bodyId: id.body || en.body, tagsId: id.tags || en.tags });
});

// Camera framing for each "Up close" part. The names and descriptions live under "upclose.parts".
var FEAT_RIGS = [{"zoom":0.92,"parts":["reactor","lid","bolts"]},{"zoom":0.64,"parts":["gauge","valve"]},{"zoom":0.82,"parts":["stove","fuelDoor","ash"]},{"zoom":0.72,"parts":["fan"]},{"parts":["pipes","nozzle"]},{"parts":["legs","handle"]}];
export var FEATS = FEAT_RIGS.map(function (rig, i) { return Object.assign({}, rig, EN.upclose.parts[i]); });
export function featStep(i) { var f = FEATS[i]; return { parts: f.parts, zoom: f.zoom || 1, fan: 0.8, fire: f.parts.indexOf('stove') >= 0 ? 0.7 : 0, gas: 0 }; }

export var PART_NAMES = EN.part_names;
export var LOGOS = site.logos.map(function (l) { return [l.src, l.alt]; });
