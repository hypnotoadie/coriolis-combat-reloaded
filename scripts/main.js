// STEP 1: DEBUGGING 
// These log functions are to debug the module and make sure it's loading correctly.
console.log("coriolis-combat-reloaded | Loading module...");

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

// Checks if the CSS is loaded. If it is, the module is ready.
Hooks.once('ready', () => {
  console.log("coriolis-combat-reloaded | Module ready");
  
  if (game.settings.get(MODULE_ID, "enableCombatReloaded")) {
    // Make sure existing weapons have AP property
    for (let actor of game.actors) {
      const weapons = actor.items.filter(i => i.type === "weapon");
      for (let weapon of weapons) {
        if (weapon.system.armorPenetration === undefined) {
          weapon.update({"system.armorPenetration": 0});
        }
      }
    }
    
    ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
  }
});

// Pre-update for weapons to ensure AP is saved
Hooks.on("preUpdateItem", (item, updateData, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Make sure armor penetration is properly initialized
  if (item.type === "weapon" && updateData.system && updateData.system.armorPenetration === undefined) {
    // If we're updating other system data but not AP, preserve the current AP
    if (item.system.armorPenetration !== undefined) {
      updateData.system.armorPenetration = item.system.armorPenetration;
    } else {
      updateData.system.armorPenetration = 0;
    }
  }
});

// Actor Sheet Changes for DR
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  console.log("coriolis-combat-reloaded | Actor sheet hook triggered");
  
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Clean up empty attribute blocks
  cleanEmptyAttributes(html);
  
  // Modify the armor section in character sheets
  modifyArmorSection(app, html, data);
  
  // Modify the weapon section to include AP
  modifyWeaponSection(app, html, data);
  
  // Add manual DR input to the character attributes section
  addManualDRToActorSheet(app, html, data);
  
  // Fix for skill and attribute localization
  fixLocalization(html);
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

// Combined renderChatMessage hook
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Combat Roll Messages
  modifyCombatRollMessage(message, html, data);
  
  // Item cards
  const itemId = html.find(".item-card").data("itemId");
  if (itemId) {
    const actor = game.actors.get(html.find(".item-card").data("actorId"));
    if (!actor) return;
    
    const item = actor.items.get(itemId);
    if (!item) return;
    
    // Modify weapon cards to display AP
    if (item.type === "weapon") {
      modifyWeaponChatCard(item, html);
    }
    
    // Modify armor cards to display DR
    if (item.type === "armor") {
      modifyArmorChatCard(item, html);
    }
  }
});

// Function to clean up empty attribute blocks
function cleanEmptyAttributes(html) {
  // Find and hide all empty DR attribute blocks
  html.find('.attr-block.bg-damageReduction').each(function() {
    $(this).closest('.attr-item').hide();
  });
  
  // Also hide any manualDROverride elements
  html.find('input[name="system.attributes.manualDROverride.value"]').each(function() {
    $(this).closest('.attr-item').hide();
  });
}

// Function to patch core coriolis roll evaluation
function patchCoriolisRollEvaluation() {
  // Make sure the function exists before patching
  if (!game.yzecoriolis?.coriolisRoll) {
    console.error("coriolis-combat-reloaded | Could not find coriolisRoll function to patch!");
    return;
  }
  
  // Store the original function for later calling
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our modified version
  game.yzecoriolis.coriolisRoll = function(chatOptions, rollData) {
    // Add AP handling to rollData if it's a weapon roll
    if (rollData.rollType === "weapon") {
      // Try to get the weapon from the actor
      const actor = game.actors.get(chatOptions.speaker?.actor);
      if (actor) {
        // Find the weapon by name
        const weapon = actor.items.find(i => 
          i.type === "weapon" && i.name === rollData.rollTitle
        );
        
        if (weapon && typeof weapon.system.armorPenetration !== 'undefined') {
          rollData.armorPenetration = weapon.system.armorPenetration;
        } else {
          rollData.armorPenetration = 0;
        }
      } else {
        rollData.armorPenetration = 0;
      }
    }
    
    // Call the original function with our modified data
    return originalCoriolisRoll(chatOptions, rollData);
  };
}

// Function to extend weapon class with AP property
function extendWeaponClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Add AP field to weapon items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "weapon" && !hasProperty(data, "system.armorPenetration")) {
      document.updateSource({"system.armorPenetration": 0});
    }
  });
}

// Function to extend armor class with DR property
function extendArmorClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Convert armor rating to DR for armor items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "armor" && !hasProperty(data, "system.damageReduction")) {
      const armorRating = data.system?.armorRating || 0;
      document.updateSource({
        "system.damageReduction": armorRating
      });
    }
  });
}

// Actor Prep - Handle armor equip/unequip to update DR
Hooks.on("updateItem", async (item, updateData, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Check if this is armor and equipment status changed
  if (item.type === "armor" && hasProperty(updateData, "system.equipped")) {
    const actor = item.actor;
    if (!actor) return;
    
    // Calculate new DR
    const calculatedDR = calculateActorDR(actor);
    
    // Update the actor with the new DR
    await actor.update({
      "system.attributes.damageReduction": calculatedDR
    });
  }
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
    const armorDR = armor.system.damageReduction || 0;
    totalDR += armorDR;
  }
  
  return totalDR;
}

// Fix for skill and attribute localization
function fixLocalization(html) {
  // Process all elements with YZECORIOLIS prefixes
  html.find('.stat-label, .ability-name, .skill-name').each((i, el) => {
    const element = $(el);
    const text = element.text().trim();
    
    // Check if the text starts with "YZECORIOLIS."
    if (text.startsWith("YZECORIOLIS.")) {
      // Extract the key and try to localize it
      const key = text;
      const localizedText = game.i18n.localize(key);
      
      // Only replace if localization worked
      if (localizedText !== key) {
        element.text(localizedText);
      }
    }
  });
}

// Function to modify armor section to show DR instead of Armor Rating
function modifyArmorSection(app, html, data) {
  console.log("coriolis-combat-reloaded | Modifying armor section");
  
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

// Function to modify weapon section to include AP
function modifyWeaponSection(app, html, data) {
  console.log("coriolis-combat-reloaded | Modifying weapon section");
  
  // Find the weapon header - the first one with "Weapons" text
  const weaponHeader = html.find('.gear-category-header:contains("Weapons")').first();
  if (!weaponHeader.length) return;
  
  // Properly reorder headers by finding each column we need
  const headerRow = weaponHeader.children();
  
  // Find all gear-category-name elements
  const headerNames = weaponHeader.find('.gear-category-name');
  
  // Only proceed if we can find the right columns
  if (headerNames.length < 6) return;
  
  // If AP column doesn't exist yet, we need to add it
  if (headerNames.filter(':contains("AP")').length === 0) {
    // We need to insert AP in the right place - BEFORE Range
    const rangeColumn = headerNames.filter(':contains("Range")').first();
    
    if (rangeColumn.length) {
      // Create AP column and insert before range
      const apColumn = $(`<div class="gear-category-name center">AP</div>`);
      rangeColumn.before(apColumn);
    }
  }
  
  // Now add AP values to each weapon item
  const weaponItems = weaponHeader.nextUntil('.gear-category-header').filter('.gear.item');
  weaponItems.each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (!item || item.type !== "weapon") return;
    
    // Get the item row and all data cells
    const itemRow = $(el).find('.gear-bg');
    const dataCells = itemRow.find('.gear-row-data');
    
    // Check if AP column already exists for this item
    if (!$(el).find('.ap-cell').length) {
      // The range value is typically the 5th data cell (index 4)
      const rangeCell = dataCells.filter(':contains("Short"), :contains("Medium"), :contains("Long"), :contains("Extreme")').first();
      
      if (rangeCell.length) {
        // Create AP cell with appropriate value
        const apValue = item.system.armorPenetration !== undefined ? item.system.armorPenetration : 0;
        const apCell = $(`<div class="gear-row-data ap-cell">${apValue}</div>`);
        
        // Insert before range cell
        rangeCell.before(apCell);
      }
    }
  });
}

// Function to modify the weapon item sheet
function modifyWeaponSheetDisplay(app, html, data) {
  // Only proceed if this is a weapon
  if (app.item.type !== "weapon") return;
  
  // Remove ALL existing AP fields to avoid duplicates
  // Use multiple selectors to catch all variations
  html.find('.resource-label:contains("Armor Penetration")').closest('.resource').remove();
  html.find('.ap-field').remove();
  
  // Also look for any exact text matches
  html.find('label').filter(function() {
    return $(this).text().trim() === "Armor Penetration";
  }).closest('.resource').remove();
  
  // Find the damage input field
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  
  // Add AP field after damage
  if (damageField.length) {
    // Get the current AP value safely
    let apValue = 0;
    if (app.item.system.armorPenetration !== undefined) {
      apValue = parseInt(app.item.system.armorPenetration) || 0;
    }
    
    // Create the AP field
    const apField = `
      <div class="resource numeric-input flexrow ap-field">
        <label class="resource-label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}</label>
        <input type="number" min="0" name="system.armorPenetration" value="${apValue}" data-dtype="Number" />
      </div>
    `;
    
    // Insert after the damage field
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

// Function to add manual DR input to character sheet
function addManualDRToActorSheet(app, html, data) {
  // Get current values
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  
  // Get the current DR value (may be manual or calculated)
  const currentDR = actor.system.attributes?.damageReduction || 0;
  
  // Find the always-visible-stats section
  const statsSection = html.find('.always-visible-stats .perma-stats-list');
  if (!statsSection.length) return;
  
  // First remove any existing DR entry to avoid duplicates
  statsSection.find('.stat-label:contains("Damage Reduction")').closest('.entry').remove();
  
  // Create the DR entry with proper styling
  const drEntry = `
    <li class="entry flexrow">
      <div class="stat-label">${game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")}</div>
      <div class="number">
        <input class="input-value dr-value" 
               type="number" 
               name="system.attributes.damageReduction" 
               value="${currentDR}" 
               min="0"
               data-dtype="Number"
               title="${game.i18n.localize("coriolis-combat-reloaded.tooltips.damageReduction")}" />
      </div>
    </li>
  `;
  
  // Insert the DR entry - position it after Radiation but before Experience
  const radiationEntry = statsSection.find('.stat-label:contains("Radiation")').closest('.entry');
  if (radiationEntry.length) {
    $(drEntry).insertAfter(radiationEntry);
  } else {
    // If can't find Radiation, just append to the end
    statsSection.append(drEntry);
  }
}

// Extend actor preparation to include DR calculations
Hooks.on("preCreateActor", (document, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Initialize DR property
  document.updateSource({"system.attributes.damageReduction": 0});
});

// Function to modify chat messages for combat rolls - show AP values
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

// New functions for item cards
function modifyWeaponChatCard(weapon, html) {
  // Add AP after damage
  const damageElement = html.find(".card-damage");
  if (!damageElement.length) return;
  
  // Get the AP value
  const armorPenetration = weapon.system.armorPenetration || 0;
  
  // Create AP element
  const apElement = `
    <div class="card-ap">
      <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}:</span>
      <span class="value">${armorPenetration}</span>
    </div>
  `;
  
  // Insert after damage
  damageElement.after(apElement);
}

function modifyArmorChatCard(armor, html) {
  // Find where to add the DR info - typically in the card-attributes section
  const attributesElement = html.find(".card-attributes");
  if (!attributesElement.length) return;
  
  // Get the DR value
  const damageReduction = armor.system.damageReduction || 0;
  
  // Create DR element
  const drElement = `
    <div class="card-dr">
      <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")}:</span>
      <span class="value">${damageReduction}</span>
    </div>
  `;
  
  // Insert into attributes
  attributesElement.append(drElement);
  
  // Remove the original Armor Rating if it exists
  html.find(".card-armor-rating").remove();
}