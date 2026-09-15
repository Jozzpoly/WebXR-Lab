import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { snapWorkspacePoint } from '../src/input/desktop-spatial-drag.js';

test('desktop spatial grid snaps all three workspace axes instead of forcing one build height', () => {
  const snapped = snapWorkspacePoint(new THREE.Vector3(0.37, 0.61, -0.38), 0.25);
  assert.deepEqual(snapped.toArray(), [0.25, 0.5, -0.5]);
});

test('desktop spatial snapping can be bypassed by passing a non-positive size', () => {
  const source = new THREE.Vector3(0.37, 0.61, -0.38);
  const snapped = snapWorkspacePoint(source, 0);
  assert.deepEqual(snapped.toArray(), source.toArray());
  assert.notEqual(snapped, source);
});
