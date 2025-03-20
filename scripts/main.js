// Coriolis Combat Reloaded - main.js

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

  // Extend or modify core Coriolis functionality
  if (game.settings.get(MODULE_ID, "enableCombatReloaded")) {
    // Patch the core system's evaluateCoriolisRoll function if necessary
    patchCoriolisRollEvaluation();
    
    // Extend item classes for weapons to handle AP
    extendWeaponClass();
    
    // Extend item classes for armor to handle DR
    extendArmorClass();
  }
});

// Hook into the rendering of character sheets
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Modify the armor section in character sheets
  modifyArmorSection(app, html, data);
  
  // Modify the weapon section to include AP
  modifyWeaponSection(app, html, data);
});

// Hook into the item sheet rendering
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // If this is an armor sheet, modify it to show DR instead of Armor Rating
  if (app.item.type === "armor") {
    modifyArmorSheetDisplay(app, html, data);
  }
  
  // If this is a weapon sheet, add AP field
  if (app.item.type === "weapon") {
    modifyWeaponSheetDisplay(app, html, data);
  }
});

// Hook into chat message creation for modifying roll results
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Modify damage and armor calculations in the chat results
  modifyCombatRollMessage(message, html, data);
});

// Function to modify how armor works in combat rolls
function patchCoriolisRollEvaluation() {
  // Store the original function for later calling
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our modified version
  game.yzecoriolis.coriolisRoll = function(chatOptions, rollData) {
    // Add AP handling to rollData if it's a weapon roll
    if (rollData.rollType === "weapon" && !rollData.armorPenetration) {
      rollData.armorPenetration = 0;
    }
    
    // Call the original function with our modified data
    return originalCoriolisRoll(chatOptions, rollData);
  };
}

// Function to extend weapon class with AP property
function extendWeaponClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Create a preparation hook for weapon items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "weapon" && !data.system.armorPenetration) {
      document.updateSource({"system.armorPenetration": 0});
    }
  });
}

// Function to extend armor class with DR property
function extendArmorClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Create a preparation hook for armor items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "armor" && !data.system.damageReduction) {
      // Convert old armorRating to damageReduction if present
      const armorRating = data.system?.armorRating || 0;
      document.updateSource({
        "system.damageReduction": armorRating,
        "system.-=armorRating": null  // Remove the old property
      });
    }
  });
}

// Function to modify armor section to show DR instead of Armor Rating
function modifyArmorSection(app, html, data) {
    // Change the Armor Rating header to Damage Reduction
    const armorHeader = html.find('.gear-category-header:contains("Armor")');
    if (armorHeader.length) {
      const armorRatingHeader = armorHeader.find('.gear-category-name:contains("Armor Rating")');
      if (armorRatingHeader.length) {
        armorRatingHeader.text(game.i18n.localize("coriolis-combat-reloaded.labels.dr"));
      }
    }
    
    // Update each armor item to show DR instead of Armor Rating
    html.find('.gear.item').each((i, el) => {
      const itemId = el.dataset.itemId;
      if (!itemId) return;
      
      const item = app.actor.items.get(itemId);
      if (item?.type === "armor") {
        // Find where the armor rating is displayed
        const rowData = $(el).find('.gear-row-data:first');
        if (rowData.length) {
          const drValue = item.system.damageReduction || 0;
          rowData.html(`<span class="dr-value">${drValue}</span>`);
        }
      }
    });
  }

// Function to modify the weapon item sheet
function modifyWeaponSheetDisplay(app, html, data) {
    // Only proceed if this is a weapon
    if (app.item.type !== "weapon") return;
    
    // Find the damage input field
    const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
    
    // Add AP field after damage if it doesn't exist
    if (damageField.length && !html.find('.resource-label:contains("Armor Penetration")').length) {
      const apValue = app.item.system.armorPenetration || 0;
      const apField = `
        <div class="resource numeric-input flexrow ap-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}</label>
          <input type="number" min="0" name="system.armorPenetration" value="${apValue}" data-dtype="Number" />
        </div>
      `;
      $(apField).insertAfter(damageField);
    }
  }

// Function to modify the armor item sheet
function modifyArmorSheetDisplay(app, html, data) {
  // Only proceed if this is armor
  if (app.item.type !== "armor") return;
  
  // Find the armor rating field if it exists
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Replace armor rating with damage reduction
    const drValue = app.item.system.damageReduction || app.item.system.armorRating || 0;
    armorRatingField.find('.resource-label').text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
    armorRatingField.find('input').attr('name', 'system.damageReduction').val(drValue);
  } else {
    // If there's no armor rating field yet, add a damage reduction field
    const inputSection = html.find('.header-fields .flexcol').first();
    if (inputSection.length) {
      const drValue = app.item.system.damageReduction || 0;
      const drField = `
        <div class="resource numeric-input flexrow dr-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}</label>
          <input type="number" min="0" name="system.damageReduction" value="${drValue}" data-dtype="Number" />
        </div>
      `;
      inputSection.append(drField);
    }
  }
}

// Function to modify chat messages for combat rolls - simplified to just show AP values
function modifyCombatRollMessage(message, html, data) {
    // Check if this is a weapon roll
    const isWeaponRoll = html.find('h2:contains("Weapon")').length > 0 || 
                          html.find('td:contains("Damage:")').length > 0;
    
    if (!isWeaponRoll) return;
    
    // Get roll data from message flags
    const rollResults = message.getFlag("yzecoriolis", "results");
    if (!rollResults || !rollResults.rollData) return;
    
    const rollData = rollResults.rollData;
    
    // Find a good place to insert AP info
    const damageRow = html.find('td:contains("Damage:")').closest('tr');
    if (!damageRow.length) return;
    
    // Get AP value from roll data
    const apValue = rollData.armorPenetration || 0;
    
    // Insert AP row after damage
    const apRow = $(`
      <tr>
        <td colspan="2">
          ${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}: 
          <span class="ap-value">${apValue}</span>
        </td>
      </tr>
    `);
    apRow.insertAfter(damageRow);
  }