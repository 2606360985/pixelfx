import test from "node:test";
import assert from "node:assert/strict";
import { STORY_CHARACTERS, STORY_CHAPTERS, STORY_MISSIONS, VN_SCENES, ENDINGS } from "../story-data.js";
import { SCENE_BY_ID } from "../data.js";

test("all VN scenes have valid node links, characters, and mission references", () => {
  for (const [sceneId, scene] of Object.entries(VN_SCENES)) {
    assert.ok(scene.nodes.n1, `${sceneId} missing start node n1`);
    for (const [nodeId, node] of Object.entries(scene.nodes)) {
      assert.ok(STORY_CHARACTERS[node.speaker], `${sceneId}.${nodeId} unknown speaker ${node.speaker}`);
      if (node.leftChar) assert.ok(STORY_CHARACTERS[node.leftChar], `${sceneId}.${nodeId} unknown leftChar`);
      if (node.rightChar) assert.ok(STORY_CHARACTERS[node.rightChar], `${sceneId}.${nodeId} unknown rightChar`);
      if (node.next) assert.ok(scene.nodes[node.next], `${sceneId}.${nodeId} broken next ${node.next}`);
      if (node.choices) {
        assert.ok(node.choices.length >= 2, `${sceneId}.${nodeId} should offer >= 2 choices`);
        for (const ch of node.choices) {
          assert.ok(ch.label && ch.next && scene.nodes[ch.next], `${sceneId}.${nodeId} broken choice next ${ch.next}`);
        }
      }
      if (node.endAction?.startMission) {
        assert.ok(STORY_MISSIONS[node.endAction.startMission], `${sceneId}.${nodeId} invalid mission`);
      }
      if (node.endAction?.switchScene) {
        assert.ok(SCENE_BY_ID[node.endAction.switchScene], `${sceneId}.${nodeId} invalid scene`);
      }
      if (node.endAction?.triggerEnding) {
        assert.ok(ENDINGS[node.endAction.triggerEnding], `${sceneId}.${nodeId} invalid ending`);
      }
    }
  }
});

test("all story chapters and missions form a complete chain to all 3 endings", () => {
  assert.equal(STORY_CHAPTERS.length, 5);
  assert.equal(Object.keys(ENDINGS).length, 3);
  for (const ch of STORY_CHAPTERS) {
    assert.ok(SCENE_BY_ID[ch.sceneId], `chapter ${ch.id} invalid scene`);
    assert.ok(STORY_MISSIONS[ch.missionId], `chapter ${ch.id} invalid mission`);
  }
  for (const m of Object.values(STORY_MISSIONS)) {
    assert.ok(SCENE_BY_ID[m.sceneId]);
    assert.ok(VN_SCENES[m.onCompleteSceneId], `mission ${m.id} invalid onCompleteSceneId`);
  }
});
