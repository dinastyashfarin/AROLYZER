// three.js r147, the same build the design used, loaded from npm instead of global scripts.
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// The viewer code reads loaders off the same namespace object (T.GLTFLoader, T.RoomEnvironment).
export const THREE = { ...THREE_NS, GLTFLoader, RoomEnvironment };
export { MeshoptDecoder };
