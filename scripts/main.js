// Coriolis Combat Reloaded - main.js
// simplified version to get DR working on the Actor Sheet

// Constants and Settings
const MODULE_ID = "coriolis-combat-reloaded";

// Register module settings
Hooks.once("init", () => {
  console.log("coriolis-combat-reloaded | Initializing Coriolis Combat Reloaded");
  
  // Register module settings
  game.settings.register("coriolis-combat-reloaded", "enableCombatReloaded", {
    name: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.name"),
    hint: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: _ => window.location.reload()
  });
});

// Hooks for actor sheet
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Add DR to character sheet
  addDRToActorSheet(app, html, data);
});

// Hook for when items are equipped/unequipped
Hooks.on("updateItem", (item, updateData, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Only proceed if this is an armor item and equipped status is changing
  if (item.type === "armor" && hasProperty(updateData, "system.equipped")) {
    const actor = item.parent;
    if (!actor) return;
    
    // Calculate new DR and update actor
    const calculatedDR = calculateActorDR(actor);
    actor.update({
      "system.attributes.damageReduction": calculatedDR
    });
  }
});

// Initialize actors with DR property
Hooks.on("preCreateActor", (document, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Initialize DR property
  document.updateSource({
    "system.attributes.damageReduction": 0
  });
});

// Function to calculate DR from equipped armor
function calculateActorDR(actor) {
  let totalDR = 0;
  
  // Find all equipped armor items
  const equippedArmor = actor.items.filter(item => 
    item.type === "armor" && 
    item.system.equipped === true
  );
  
  // Sum up all DR values from equipped armor
  for (const armor of equippedArmor) {
    // Check for both damageReduction and armorRating (for compatibility)
    let armorDR = 0;
    if (armor.system.damageReduction !== undefined) {
      armorDR = Number(armor.system.damageReduction);
    } else if (armor.system.armorRating !== undefined) {
      armorDR = Number(armor.system.armorRating);
    }
      
    totalDR += armorDR;
  }
  
  return totalDR;
}

// Function to add DR display to actor sheet
function addDRToActorSheet(app, html, data) {
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  
  // Create the DR bar segments
  let segments = '';
  const maxSegments = 10;
  
  for (let i = 0; i < maxSegments; i++) {
    const isActive = i < calculatedDR;
    segments += `<div class="bar-segment bar-rounded ${isActive ? 'on' : 'off'}"></div>`;
  }
  
  // Create the DR entry
  const drEntry = `
    <li class="entry flexrow">
      <div class="stat-label">DR</div>
      <div class="bar dr-bar fr-basic">
        ${segments}
        <span class="bar-value">${calculatedDR}</span>
      </div>
    </li>
  `;
  
  // Find where to insert it
  const statsSection = html.find('.always-visible-stats .perma-stats-list');
  if (!statsSection.length) return;
  
  // Insert after Radiation if possible
  const radiationEntry = statsSection.find('.stat-label:contains("Radiation")').closest('.entry');
  if (radiationEntry.length) {
    $(drEntry).insertAfter(radiationEntry);
  } else {
    statsSection.append(drEntry);
  }
}