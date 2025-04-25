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
    // Register additional fields in the weapon template
    registerExtraItemFields();
    
    // Patch the core system's evaluateCoriolisRoll function if necessary
    patchCoriolisRollEvaluation();
  }
});

// When the game is ready, initialize existing items with AP and DR values
Hooks.once("ready", async () => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Wait for the system to fully initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Ensure the field exists in the item data model
  registerExtraItemFields();
  
  // Migrate existing weapon and armor data
  await migrateData();
  
  console.log("coriolis-combat-reloaded | Combat Reloaded is active");
});

// Actor Sheet Changes for DR
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
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

// Catch the form submission to ensure proper data handling
Hooks.on("closeyzecoriolisItemSheet", async (app, html) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  if (app.item.type !== "weapon") return;
  
  // Double-check that the armorPenetration field exists and has proper value
  const currentValue = app.item.system.armorPenetration;
  if (currentValue === undefined || currentValue === null || currentValue === "null") {
    await app.item.update({"system.armorPenetration": 0});
  }
});

// Combined renderChatMessage hook
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Combat Roll Messages
  modifyCombatRollMessage(message, html, data);
  
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

// Direct approach to register fields in the schema
function registerExtraItemFields() {
  // Ensure fields are registered on the Item prototype
  const weaponFields = foundry.data.fields;
  if (weaponFields) {
    // Try to register the fields in different ways depending on Foundry version
    try {
      // For newer Foundry versions
      const weaponSchema = game.system.model.Item.weapon;
      if (weaponSchema) {
        weaponSchema.armorPenetration = new weaponFields.NumberField({
          required: false, 
          initial: 0, 
          nullable: false
        });
      }
      
      const armorSchema = game.system.model.Item.armor;
      if (armorSchema) {
        armorSchema.damageReduction = new weaponFields.NumberField({
          required: false, 
          initial: 0, 
          nullable: false
        });
      }
    } catch (error) {
      console.warn("Could not register fields via model schema:", error);
    }
  }
  
  // Add our update hook for Item.prototype.prepareData
  const originalPrepareData = CONFIG.Item.documentClass.prototype.prepareData;
  if (originalPrepareData && !CONFIG.Item.documentClass.prototype._hasReloadedHook) {
    CONFIG.Item.documentClass.prototype.prepareData = function() {
      // Call the original method
      originalPrepareData.call(this);
      
      // Add our custom field logic for weapons
      if (this.type === "weapon") {
        // If armorPenetration is undefined, null, or "null", set it to 0
        if (this.system.armorPenetration === undefined || 
            this.system.armorPenetration === null || 
            this.system.armorPenetration === "null") {
          this.system.armorPenetration = 0;
        } else {
          // Make sure it's a number
          this.system.armorPenetration = Number(this.system.armorPenetration);
        }
      }
      
      // Add our custom field logic for armor
      if (this.type === "armor") {
        // If damageReduction is undefined or null, set it to armorRating or 0
        if (this.system.damageReduction === undefined || 
            this.system.damageReduction === null || 
            this.system.damageReduction === "null") {
          this.system.damageReduction = this.system.armorRating || 0;
        } else {
          // Make sure it's a number
          this.system.damageReduction = Number(this.system.damageReduction);
        }
      }
    };
    
    // Mark that we've added our hook
    CONFIG.Item.documentClass.prototype._hasReloadedHook = true;
  }
}

// Migration function for existing data
async function migrateData() {
  // Wait briefly for system to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log("Migrating Combat Reloaded data...");
  
  // For world items - weapons
  for (const item of game.items.filter(i => i.type === "weapon")) {
    const currentValue = item.system.armorPenetration;
    if (currentValue === undefined || currentValue === null || currentValue === "null") {
      console.log(`Setting AP for world weapon: ${item.name}`);
      await item.update({"system.armorPenetration": 0});
    }
  }
  
  // For world items - armor
  for (const item of game.items.filter(i => i.type === "armor")) {
    const currentValue = item.system.damageReduction;
    if (currentValue === undefined || currentValue === null || currentValue === "null") {
      const armorRating = item.system.armorRating || 0;
      console.log(`Setting DR for world armor: ${item.name}`);
      await item.update({"system.damageReduction": armorRating});
    }
  }
  
  // For actor-owned items - in chunks to avoid performance issues
  for (const actor of game.actors) {
    // Process weapons
    const weaponUpdates = [];
    for (const item of actor.items.filter(i => i.type === "weapon")) {
      const currentValue = item.system.armorPenetration;
      if (currentValue === undefined || currentValue === null || currentValue === "null") {
        console.log(`Setting AP for actor weapon: ${item.name} on ${actor.name}`);
        weaponUpdates.push({
          _id: item.id,
          "system.armorPenetration": 0
        });
      }
    }
    
    // Process armor
    const armorUpdates = [];
    for (const item of actor.items.filter(i => i.type === "armor")) {
      const currentValue = item.system.damageReduction;
      if (currentValue === undefined || currentValue === null || currentValue === "null") {
        const armorRating = item.system.armorRating || 0;
        console.log(`Setting DR for actor armor: ${item.name} on ${actor.name}`);
        armorUpdates.push({
          _id: item.id,
          "system.damageReduction": armorRating
        });
      }
    }
    
    // Apply updates
    if (weaponUpdates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", weaponUpdates);
    }
    
    if (armorUpdates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", armorUpdates);
    }
  }
  
  console.log("Combat Reloaded data migration completed");
}

// Function to modify how armor works in combat rolls
function patchCoriolisRollEvaluation() {
  // Only proceed if the core function exists
  if (!game.yzecoriolis || !game.yzecoriolis.coriolisRoll) return;
  
  // Store the original function for later calling
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our modified version
  game.yzecoriolis.coriolisRoll = function(chatOptions, rollData) {
    // Add AP handling to rollData if it's a weapon roll
    if (rollData.rollType === "weapon" && rollData.armorPenetration === undefined) {
      // Check if there's an item that might have AP data
      const actor = game.actors.get(chatOptions.speaker.actor);
      if (actor) {
        // Try to find the weapon being used
        const itemId = rollData.itemId; // You may need to ensure this is passed from the roll dialog
        if (itemId) {
          const item = actor.items.get(itemId);
          if (item && item.system.armorPenetration !== undefined) {
            rollData.armorPenetration = item.system.armorPenetration;
          } else {
            rollData.armorPenetration = 0;
          }
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

// Function to modify armor section to show DR instead of Armor Rating
function modifyArmorSection(app, html, data) {
  // Change the Armor Rating header to Damage Reduction
  const armorHeader = html.find('.gear-category-header:contains("Armor")');
  if (armorHeader.length) {
    const armorRatingHeader = armorHeader.find('.gear-category-name:contains("Armor Rating")');
    if (armorRatingHeader.length) {
      armorRatingHeader.text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
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
        const drValue = getArmorDRValue(item);
        rowData.html(`<span class="dr-value">${drValue}</span>`);
      }
    }
  });
}

// Function to get DR value for armor, handling various data formats
function getArmorDRValue(armorItem) {
  if (!armorItem) return 0;
  
  // Try different properties in order of preference
  const drValue = armorItem.system.damageReduction;
  if (drValue !== undefined && drValue !== null && drValue !== "null") {
    return Number(drValue);
  }
  
  // Fall back to armorRating
  const arValue = armorItem.system.armorRating;
  if (arValue !== undefined && arValue !== null && arValue !== "null") {
    return Number(arValue);
  }
  
  return 0;
}

// Function to get AP value for weapons, handling various data formats
function getWeaponAPValue(weaponItem) {
  if (!weaponItem) return 0;
  
  const apValue = weaponItem.system.armorPenetration;
  if (apValue !== undefined && apValue !== null && apValue !== "null") {
    return Number(apValue);
  }
  
  return 0;
}

// Function to modify weapon section to include AP
function modifyWeaponSection(app, html, data) {
  // For now, we'll just update the display of each weapon to show AP
  // in future versions, you may want to add an AP column to the header
  
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon") {
      // Add AP after damage
      const weaponName = $(el).find('.item-name');
      if (weaponName.length) {
        const apValue = getWeaponAPValue(item);
        
        // Only add if not already there
        if (!$(el).find('.ap-value').length) {
          weaponName.append(`<span class="ap-value" style="margin-left: 5px;">AP:${apValue}</span>`);
        }
      }
    }
  });
}

// Function to modify the weapon item sheet
function modifyWeaponSheetDisplay(app, html, data) {
  // Only proceed if this is a weapon
  if (app.item.type !== "weapon") return;
  
  // FIRST: Remove any existing AP fields to avoid duplicates
  html.find('.ap-field').remove();
  
  // SECOND: Find the damage input field and the custom damage field
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  const customDamageField = html.find('.resource-label:contains("Custom Damage")').closest('.resource');
  
  // THIRD: Add AP field after damage but before custom damage
  if (damageField.length && customDamageField.length) {
    // Get the AP value, ensuring it's a number and not "null" or NaN
    let apValue = app.item.system.armorPenetration;
    
    // Check for invalid values and convert to 0
    if (apValue === undefined || apValue === null || apValue === "null" || 
        isNaN(apValue) || apValue === "NaN") {
      apValue = 0;
      
      // Update the item immediately to prevent null values
      app.item.update({"system.armorPenetration": 0});
    }
    
    const apField = `
      <div class="resource numeric-input flexrow ap-field" id="single-ap-field">
        <label class="resource-label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}</label>
        <input type="number" min="0" name="system.armorPenetration" value="${apValue}" data-dtype="Number">
      </div>
    `;
    
    // This specifically inserts the AP field after damage and before custom damage
    customDamageField.before(apField);
    
    // FOURTH: Add event handler to ensure proper number conversion and storage
    html.find('#single-ap-field input').change(function() {
      const val = $(this).val();
      // Handle empty, null, or NaN values
      if (val === "" || val === "null" || val === null || isNaN(val) || val === "NaN") {
        $(this).val(0);
        app.item.update({"system.armorPenetration": 0});
      } else {
        const numVal = Number(val);
        $(this).val(numVal);
        app.item.update({"system.armorPenetration": numVal});
      }
    });
    
    // FIFTH: Add a MutationObserver to detect and remove any AP fields that might get added later
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          const addedApFields = $(mutation.addedNodes).find('.ap-field');
          if (addedApFields.length > 0) {
            // Keep only our single AP field and remove any others
            html.find('.ap-field:not(#single-ap-field)').remove();
          }
        }
      });
    });
    
    // Start observing the form for changes
    observer.observe(html[0], { childList: true, subtree: true });
    
    // Store the observer reference to disconnect it when needed
    app._armorPenetrationObserver = observer;
  }
}

// Make sure to disconnect the observer when the sheet closes
Hooks.on("closeyzecoriolisItemSheet", (app) => {
  if (app._armorPenetrationObserver) {
    app._armorPenetrationObserver.disconnect();
    app._armorPenetrationObserver = null;
  }
});

// Also add this to stop competing renderings:
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get("coriolis-combat-reloaded", "enableCombatReloaded")) return;
  
  // If this is a weapon sheet, make sure there's only one AP field
  if (app.item.type === "weapon") {
    // Wait a tiny bit to let other modules finish
    setTimeout(() => {
      // Find all AP fields and keep only the first one with our ID
      const apFields = html.find('.ap-field');
      if (apFields.length > 1) {
        // Keep only our field and remove others
        html.find('.ap-field:not(#single-ap-field)').remove();
      }
    }, 100);
  }
});

// Function to modify the armor item sheet
function modifyArmorSheetDisplay(app, html, data) {
  // Only proceed if this is armor
  if (app.item.type !== "armor") return;
  
  // Find the armor rating field if it exists
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Replace armor rating with damage reduction
    let drValue = app.item.system.damageReduction;
    if (drValue === undefined || drValue === null || drValue === "null") {
      drValue = app.item.system.armorRating || 0;
      
      // Update the item immediately to prevent null values
      app.item.update({"system.damageReduction": drValue});
    }
    
    armorRatingField.find('.resource-label').text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
    armorRatingField.find('input').attr('name', 'system.damageReduction').val(drValue);
    
    // Add event handler to ensure proper number conversion and storage
    armorRatingField.find('input').change(function() {
      const val = $(this).val();
      if (val === "" || val === "null" || val === null) {
        $(this).val(0);
        app.item.update({"system.damageReduction": 0});
      } else {
        const numVal = Number(val);
        $(this).val(numVal);
        app.item.update({"system.damageReduction": numVal});
      }
    });
  } else {
    // If there's no armor rating field yet, add a damage reduction field
    const inputSection = html.find('.header-fields .flexcol').first();
    if (inputSection.length) {
      let drValue = app.item.system.damageReduction;
      if (drValue === undefined || drValue === null || drValue === "null") {
        drValue = 0;
        
        // Update the item immediately to prevent null values
        app.item.update({"system.damageReduction": 0});
      }
      
      const drField = `
        <div class="resource numeric-input flexrow dr-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}</label>
          <input type="number" min="0" name="system.damageReduction" value="${drValue}" data-dtype="Number" />
        </div>
      `;
      inputSection.append(drField);
      
      // Add event handler to ensure proper number conversion and storage
      inputSection.find('input[name="system.damageReduction"]').change(function() {
        const val = $(this).val();
        if (val === "" || val === "null" || val === null) {
          $(this).val(0);
          app.item.update({"system.damageReduction": 0});
        } else {
          const numVal = Number(val);
          $(this).val(numVal);
          app.item.update({"system.damageReduction": numVal});
        }
      });
    }
  }
}

// Function to add manual DR input to character sheet
function addManualDRToActorSheet(app, html, data) {
  // Get current values
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  const manualDR = actor.system.attributes?.manualDROverride;
  const finalDR = (manualDR !== undefined && manualDR !== null && manualDR !== "null") ? 
                  Number(manualDR) : calculatedDR;
  
  // Find the always-visible-stats section
  const statsSection = html.find('.always-visible-stats .perma-stats-list');
  if (!statsSection.length) return;
  
  // Create the DR entry
  const drEntry = `
    <li class="entry flexrow">
      <div class="stat-label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}</div>
      <div class="number">
        <input class="input-value dr-value" 
               type="number" 
               name="system.attributes.manualDROverride" 
               value="${manualDR !== undefined && manualDR !== null && manualDR !== "null" ? manualDR : ''}" 
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
  
  // Add event handler to ensure proper number conversion
  html.find('input[name="system.attributes.manualDROverride"]').change(function() {
    const val = $(this).val();
    if (val === "" || val === "null") {
      $(this).val("");
      app.actor.update({"system.attributes.manualDROverride": null});
    } else {
      const numVal = Number(val);
      $(this).val(numVal);
      app.actor.update({"system.attributes.manualDROverride": numVal});
    }
  });
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
    const armorDR = getArmorDRValue(armor);
    totalDR += armorDR;
  }
  
  return totalDR;
}

// Function to modify chat messages for combat rolls
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
  
  // Get AP value from roll data, ensuring it's a valid number
  let apValue = rollData.armorPenetration;
  if (apValue === undefined || apValue === null || apValue === "null") {
    apValue = 0;
  } else {
    apValue = Number(apValue);
  }
  
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

// Functions for item cards
function modifyWeaponChatCard(weapon, html) {
  // Add AP after damage
  const damageElement = html.find(".card-damage");
  if (!damageElement.length) return;
  
  // Get the AP value, ensuring it's a valid number
  let armorPenetration = weapon.system.armorPenetration;
  if (armorPenetration === undefined || armorPenetration === null || armorPenetration === "null") {
    armorPenetration = 0;
  } else {
    armorPenetration = Number(armorPenetration);
  }
  
  // Create AP element
  const apElement = `
    <div class="card-ap">
      <span class="label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}:</span>
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
  
  // Get the DR value, ensuring it's a valid number
  const damageReduction = getArmorDRValue(armor);
  
  // Create DR element
  const drElement = `
    <div class="card-dr">
      <span class="label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}:</span>
      <span class="value">${damageReduction}</span>
    </div>
  `;
  
  // Insert into attributes
  attributesElement.append(drElement);
  
  // Remove the original Armor Rating if it exists
  html.find(".card-armor-rating").remove();
}