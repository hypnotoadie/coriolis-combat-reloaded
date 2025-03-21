// STEP 1: DEBUGGING 
// These log functions are to debug the module and make sure it's loading correctly.
// First: Loading Module
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
    
    // Register the DR attributes properly - this is important to fix the display issues
    // This is a simple way to handle it assuming the system allows this approach
    // If this doesn't work well, we would need to investigate the system's attribute registration methods
    if (game.system.id === "yzecoriolis") {
      try {
        // Define damageReduction as a numeric attribute, not an object with value property
        CONFIG.YZECORIOLIS = CONFIG.YZECORIOLIS || {};
        CONFIG.YZECORIOLIS.attributes = CONFIG.YZECORIOLIS.attributes || {};
        CONFIG.YZECORIOLIS.attributes.damageReduction = {
          label: "Damage Reduction",
          abbr: "DR"
        };
      } catch (e) {
        console.error("coriolis-combat-reloaded | Error registering DR attribute:", e);
      }
    }
  }
});

// Checks if the CSS is loaded. If it is, the module is ready.
Hooks.once('ready', () => {
  console.log("coriolis-combat-reloaded | Module ready - initializing flags");
  
  if (game.settings.get(MODULE_ID, "enableCombatReloaded")) {
    // Initialize flags for all actors
    game.actors.forEach(actor => {
      if (!actor.flags["coriolis-combat-reloaded"]) {
        const calculatedDR = calculateActorDR(actor);
        actor.update({
          "flags.coriolis-combat-reloaded.calculatedDR": calculatedDR,
          "flags.coriolis-combat-reloaded.manualDRValue": null
        }).catch(error => {
          console.error("coriolis-combat-reloaded | Error initializing flags for actor:", actor.name, error);
        });
      }
    });
    
    ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
  }
});

// Actor Sheet Changes for DR
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  console.log("coriolis-combat-reloaded | Actor sheet hook triggered");
  
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Modify the armor section in character sheets
  modifyArmorSection(app, html, data);
  
  // Modify the weapon section to include AP
  modifyWeaponSection(app, html, data);
  
  // Add manual DR input to the character attributes section
  addManualDRToActorSheet(app, html, data);
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
  
  // New code for item cards
  // Check if this is an item card
  const itemId = html.find(".item-card").data("itemId");
  if (itemId) {
    // Find the related actor and item
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

// Actor Prep
// Update how we set the damageReduction property to avoid the "in" operator error
Hooks.on("preUpdateActor", (actor, updateData, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Prevent system-level updates to our DR attributes to avoid issues
  if (updateData.system?.attributes?.damageReduction !== undefined) {
    delete updateData.system.attributes.damageReduction;
  }
  
  if (updateData.system?.attributes?.manualDROverride !== undefined) {
    delete updateData.system.attributes.manualDROverride;
  }
  
  // If actor's items are being updated (like equipping armor), recalculate DR
  if (updateData.items) {
    calculateAndApplyDR(actor).catch(error => {
      console.error("coriolis-combat-reloaded | Error in preUpdateActor:", error);
    });
  }
});

function patchCoriolisRollEvaluation() {
  // Store the original function for later calling
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our modified version
  game.yzecoriolis.coriolisRoll = function(chatOptions, rollData) {
    // Add AP handling to rollData if it's a weapon roll
    if (rollData.rollType === "weapon" && !rollData.armorPenetration) {
      rollData.armorPenetration = 0;
    }
    
    // If this is a weapon roll against a target with DR, handle it
    if (rollData.rollType === "weapon" && rollData.targetActor) {
      // Get the DR from our flag instead of from attributes
      let targetDR = 0;
      try {
        const targetActor = game.actors.get(rollData.targetActor);
        if (targetActor) {
          targetDR = targetActor.flags["coriolis-combat-reloaded"]?.calculatedDR || 0;
          console.log("coriolis-combat-reloaded | Target DR:", targetDR);
          
          // Add the DR to rollData for the roll template
          rollData.targetDR = targetDR;
        }
      } catch (error) {
        console.error("coriolis-combat-reloaded | Error getting target DR:", error);
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
  
  // Create a preparation hook for weapon items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    // Only update if the document exists and it's a weapon
    if (!document || data.type !== "weapon") return;
    
    // Check if this item is being added to an actor
    // Only proceed if the actor exists to prevent null reference errors
    const actor = document.parent;
    if (!actor) {
      // For items not directly linked to an actor, still add the AP property
      if (!data.system?.armorPenetration) {
        document.updateSource({"system.armorPenetration": 0});
      }
      return;
    }
    
    // For items linked to an actor, safely update
    if (!data.system?.armorPenetration) {
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
    // Only update if the document exists and it's armor
    if (!document || data.type !== "armor") return;
    
    // Check if this item is being added to an actor
    // Only proceed if the actor exists to prevent null reference errors
    const actor = document.parent;
    if (!actor) {
      // For items not directly linked to an actor, still convert AR to DR
      if (!data.system?.damageReduction) {
        const armorRating = data.system?.armorRating || 0;
        document.updateSource({
          "system.damageReduction": armorRating,
          "system.-=armorRating": null  // Remove the old property
        });
      }
      return;
    }
    
    // For items linked to an actor, safely update
    if (!data.system?.damageReduction) {
      const armorRating = data.system?.armorRating || 0;
      document.updateSource({
        "system.damageReduction": armorRating,
        "system.-=armorRating": null  // Remove the old property
      });
    }
  });
  
  // Add a hook for when armor is equipped or unequipped
  Hooks.on("updateItem", (item, updateData, options, userId) => {
    if (item.type !== "armor") return;
    
    // If equipped status is changing, recalculate DR
    if (updateData.system?.equipped !== undefined) {
      const actor = item.parent;
      if (actor) {
        calculateAndApplyDR(actor).catch(error => {
          console.error("coriolis-combat-reloaded | Error updating DR after armor change:", error);
        });
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

// Function to modify weapon section to show AP
function modifyWeaponSection(app, html, data) {
  console.log("coriolis-combat-reloaded | Modifying weapon section");
  
  // Change the Weapon header to include AP if needed
  const weaponHeader = html.find('.gear-category-header:contains("Weapons")');
  if (weaponHeader.length) {
    // Add a column for AP in the header if it doesn't exist
    if (!weaponHeader.find('.gear-category-name:contains("AP")').length) {
      // First find where to insert AP - after damage column
      const damageColumn = weaponHeader.find('.gear-category-name:contains("Damage")');
      if (damageColumn.length) {
        const apColumn = $(`<div class="gear-category-name center">${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}</div>`);
        damageColumn.after(apColumn);
      }
    }
  }
  
  // Update each weapon item to show AP
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon") {
      // Find the damage row to insert AP after it
      const damageElement = $(el).find('.gear-row-data:contains("' + item.system.damage + '")');
      if (damageElement.length) {
        // Check if AP column already exists
        if (!$(el).find('.ap-column').length) {
          const apValue = item.system.armorPenetration || 0;
          const apElement = $(`<div class="gear-row-data ap-column"><span class="ap-value">${apValue}</span></div>`);
          damageElement.after(apElement);
        }
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

// Function to add manual DR input to character sheet
// updated the data structure a bit
function addManualDRToActorSheet(app, html, data) {
  console.log("coriolis-combat-reloaded | Adding manual DR to actor sheet");
  
  // Get current values
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  
  // Get the manual DR value - need to check both forms since we're not sure how it's stored
  let manualDR = undefined;
  if (typeof actor.system.attributes?.manualDROverride === 'object') {
    manualDR = actor.system.attributes.manualDROverride?.value;
  } else {
    manualDR = actor.system.attributes?.manualDROverride;
  }
  
  // Find the always-visible-stats section
  const statsSection = html.find('.always-visible-stats .perma-stats-list');
  if (!statsSection.length) return;
  
  // Create the DR entry with a different approach - using a custom data attribute
  // rather than system.attributes.manualDROverride
  const drEntry = `
    <li class="entry flexrow">
      <div class="stat-label">${game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")}</div>
      <div class="number">
        <input class="input-value dr-value" 
               type="number" 
               data-dr-custom="true"
               value="${manualDR !== undefined ? manualDR : ''}" 
               placeholder="${calculatedDR}" 
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
  
  // Remove any existing attribute boxes for DR
  html.find('.attr-block.bg-damageReduction').closest('li').remove();
  html.find('.attr-block.bg-manualDROverride').closest('li').remove();
  
  // Add an event listener for DR changes
  html.find('input[data-dr-custom="true"]').on('change', async (event) => {
    const newValue = event.target.value ? parseInt(event.target.value) : null;
    
    // Use direct update methods to avoid triggering the normal attribute update flow
    try {
      // Use updateSource to modify data directly without validation
      // This bypasses the system's normal attribute handling
      await actor.update({
        "flags.coriolis-combat-reloaded.manualDRValue": newValue
      });
      
      // Update the actor's calculation without touching system.attributes
      await calculateAndApplyDR(actor);
      
      console.log("coriolis-combat-reloaded | DR updated:", newValue);
    } catch (error) {
      console.error("coriolis-combat-reloaded | Error updating DR:", error);
    }
  });
}

// Calculate and apply DR to an actor withuot using attributes
async function calculateAndApplyDR(actor) {
  // Calculate DR from equipped armor
  const calculatedDR = calculateActorDR(actor);
  
  // Get manual override from flags instead of attributes
  const manualDR = actor.flags["coriolis-combat-reloaded"]?.manualDRValue;
  const finalDR = (manualDR !== undefined && manualDR !== null) ? manualDR : calculatedDR;
  
  // Use a different approach to update the actual DR value
  // Store it in both places to ensure compatibility
  try {
    // We don't use this because it creates attribute boxes
    // await actor.update({"system.attributes.damageReduction": finalDR});
    
    // Instead, use this approach to update the derived value
    await actor.update({
      "flags.coriolis-combat-reloaded.calculatedDR": finalDR
    });
    
    console.log("coriolis-combat-reloaded | Applied DR:", finalDR);
    return finalDR;
  } catch (error) {
    console.error("coriolis-combat-reloaded | Error applying DR:", error);
    return calculatedDR;
  }
}

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


// Extend actor preparation to include DR calculations
Hooks.on("preCreateActor", (document, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Initialize DR properties if they don't exist - set directly not as nested value
  if (!hasProperty(data, "system.attributes.damageReduction")) {
    document.updateSource({"system.attributes.damageReduction": 0});
  }
});

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