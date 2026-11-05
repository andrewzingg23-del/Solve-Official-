import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIMARY_DESTINATIONS, destinationFor } from '../../lib/product/routes';

test('one shell has four destinations; Agent and identity are contextual',()=>{
 assert.deepEqual(PRIMARY_DESTINATIONS.map(d=>d.label),['Space','Projects','Communities','Control']);
 for(const path of ['/projects/new','/projects/abc','/world/abc/room','/worlds/new']) assert.equal(destinationFor(path),'/projects');
 assert.equal(destinationFor('/'),'/');
 for(const path of ['/bot','/account','/login']) assert.equal(destinationFor(path),'/control');
 assert.equal(destinationFor('/community/abc'),'/communities');
 assert.equal(PRIMARY_DESTINATIONS.length,4);
});
