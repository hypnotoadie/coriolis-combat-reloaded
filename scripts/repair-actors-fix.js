// Run this in the Foundry console (F12 in browser)
// This will repair actors with corrupted data from your module
async function repairActors() {
  for (const actor of game.actors) {
    let needsUpdate = false;
    let updateData = {};
    
    // Check for undefined/null values in attributes related to AP/DR
    if (actor.type === "character" || actor.type === "npc") {
      if (actor.system.attributes && actor.system.attributes.manualDROverride === null) {
        updateData["system.attributes.manualDROverride"] = undefined;
        needsUpdate = true;
      }
    }
    
    // Check for corrupted armor items
    if (actor.items) {
      for (const item of actor.items.filter(i => i.type === "armor")) {
        if (item.system.damageReduction === null) {
          await item.update({"system.damageReduction": item.system.armorRating || 0});
        }
      }
      
      // Check for corrupted weapon items
      for (const item of actor.items.filter(i => i.type === "weapon")) {
        if (item.system.armorPenetration === null) {
          await item.update({"system.armorPenetration": 0});
        }
      }
    }
    
    // Apply updates if needed
    if (needsUpdate) {
      console.log(`Repairing actor: ${actor.name}`);
      await actor.update(updateData);
    }
  }
  console.log("Actor repair complete");
}

// Run the repair function
repairActors();