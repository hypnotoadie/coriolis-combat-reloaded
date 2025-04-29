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

// This is our main hook for implementing fixes
Hooks.once("ready", function() {
  // Make sure Combat Reloaded is enabled
  if (!game.settings.get("coriolis-combat-reloaded", "enableCombatReloaded")) return;
  
  // Wait a moment for system initialization
  setTimeout(() => {
    // Apply the new comprehensive AP handling patches
    patchCoriolisRoll();
    patchModifierDialog();
    
    // Patch the push roll functionality if it exists
    if (game.yzecoriolis.coriolisPushRoll && !game.yzecoriolis._hasPushRollPatch) {
      patchCoriolisPushRoll();
    }
  }, 500);
});

// Create a more robust patch for the coriolisRoll function
function patchCoriolisRoll() {
  if (!game.yzecoriolis || !game.yzecoriolis.coriolisRoll) return;
  
  // Store the original function
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our enhanced version
  game.yzecoriolis.coriolisRoll = async function(chatOptions, rollData) {
    // For weapon rolls, ensure the AP value is set
    if (rollData.rollType === "weapon") {
      console.log("Combat Reloaded: Processing weapon roll for chat message", rollData);
      
      // If AP is missing, try to get it from the actor and item
      if (rollData.armorPenetration === undefined || rollData.armorPenetration === null) {
        const actorId = chatOptions.speaker.actor;
        const actor = game.actors.get(actorId);
        
        if (actor) {
          // Try to find the weapon being used based on roll title
          const itemName = rollData.rollTitle;
          const weapon = actor.items.find(i => i.type === "weapon" && i.name === itemName);
          
          if (weapon) {
            // Get AP value, ensuring it's a valid number
            let apValue = weapon.system.armorPenetration;
            if (apValue === undefined || apValue === null || apValue === "null" || isNaN(apValue)) {
              apValue = 0;
            } else {
              apValue = Number(apValue);
            }
            
            // Set AP value in roll data
            rollData.armorPenetration = apValue;
            console.log(`Combat Reloaded: Found AP ${apValue} for weapon ${weapon.name}`);
          }
        }
      }
      
      // Ensure AP is at least 0 if still undefined
      if (rollData.armorPenetration === undefined || rollData.armorPenetration === null) {
        rollData.armorPenetration = 0;
      }
    }
    
    // Call the original function with our enhanced rollData
    return await originalCoriolisRoll(chatOptions, rollData);
  };
  
  console.log("Combat Reloaded: Successfully patched coriolisRoll");
}

// Make sure the CoriolisModifierDialog captures AP correctly
function patchModifierDialog() {
  const originalDialog = game.yzecoriolis.CoriolisModifierDialog;
  if (!originalDialog || game.yzecoriolis._hasAPDialogPatch) return;
  
  game.yzecoriolis.CoriolisModifierDialog = function(rollData, chatOptions) {
    // Handle AP for weapon rolls
    if (rollData.rollType === "weapon") {
      console.log("Combat Reloaded: Weapon roll dialog creation", rollData);
      
      // Try to get AP from multiple sources
      let apValue = rollData.armorPenetration;
      
      if (apValue === undefined || apValue === null) {
        // Get from item via actor
        const actorId = chatOptions.speaker.actor;
        const actor = game.actors.get(actorId);
        
        if (actor) {
          // Get item by name
          const itemName = rollData.rollTitle;
          const item = actor.items.find(i => i.name === itemName && i.type === "weapon");
          
          if (item) {
            apValue = item.system.armorPenetration;
            console.log(`Combat Reloaded: Found AP ${apValue} for dialog from item ${item.name}`);
          }
        }
      }
      
      // Ensure we have a valid number
      if (apValue === undefined || apValue === null || apValue === "null" || isNaN(apValue)) {
        apValue = 0;
      } else {
        apValue = Number(apValue);
      }
      
      // Set the AP in the roll data
      rollData.armorPenetration = apValue;
    }
    
    // Call original constructor
    return originalDialog.call(this, rollData, chatOptions);
  };
  
  // Copy prototype
  game.yzecoriolis.CoriolisModifierDialog.prototype = originalDialog.prototype;
  game.yzecoriolis._hasAPDialogPatch = true;
  
  console.log("Combat Reloaded: Successfully patched CoriolisModifierDialog");
}

// Patch the push roll functionality to maintain AP
function patchCoriolisPushRoll() {
  const originalPushRoll = game.yzecoriolis.coriolisPushRoll;
  
  game.yzecoriolis.coriolisPushRoll = function(chatMessage, origRollData, origRoll) {
    // Preserve AP when pushing
    if (origRollData.rollType === "weapon" && !origRollData.armorPenetration) {
      // Try to get AP from the chat message content
      const apMatch = chatMessage.content.match(/<span class="ap-value">(\d+)<\/span>/);
      if (apMatch && apMatch.length > 1) {
        origRollData.armorPenetration = Number(apMatch[1]);
        console.log(`Combat Reloaded: Retrieved AP ${origRollData.armorPenetration} for push roll from chat message`);
      } else {
        origRollData.armorPenetration = 0;
      }
    }
    
    return originalPushRoll(chatMessage, origRollData, origRoll);
  };
  
  game.yzecoriolis._hasPushRollPatch = true;
  console.log("Combat Reloaded: Successfully patched coriolisPushRoll");
}

function patchCoriolisRollEvaluation() {
  // Only proceed if the core function exists
  if (!game.yzecoriolis || !game.yzecoriolis.evaluateCoriolisRoll) return;
  
  // Original function implementation (kept from your existing code)
  // Only modify if needed for AP functionality
}

function registerExtraItemFields() {
  // Only use one approach - the prepareData hook is more reliable
  const originalPrepareData = CONFIG.Item.documentClass.prototype.prepareData;
  if (originalPrepareData && !CONFIG.Item.documentClass.prototype._hasReloadedHook) {
    CONFIG.Item.documentClass.prototype.prepareData = function() {
      // Call the original method
      originalPrepareData.call(this);
      
      // Add our custom field logic for weapons
      if (this.type === "weapon") {
        // Use getProperty and setProperty for safer data access/modification
        let apValue = foundry.utils.getProperty(this, "system.armorPenetration");
        
        // Check if we need to initialize or convert the value
        if (apValue === undefined || apValue === null || apValue === "null" || isNaN(apValue)) {
          // Use setProperty instead of direct assignment
          foundry.utils.setProperty(this, "system.armorPenetration", 0);
        } else if (typeof apValue !== "number") {
          // Only convert if it's not already a number
          foundry.utils.setProperty(this, "system.armorPenetration", Number(apValue));
        }
      }
      
      // Add our custom field logic for armor
      if (this.type === "armor") {
        let drValue = foundry.utils.getProperty(this, "system.damageReduction");
        let arValue = foundry.utils.getProperty(this, "system.armorRating");
        
        // Check if we need to initialize or convert the value
        if (drValue === undefined || drValue === null || drValue === "null" || isNaN(drValue)) {
          // Use a safe default based on armorRating or 0
          const defaultValue = (arValue !== undefined && arValue !== null && !isNaN(arValue)) 
            ? Number(arValue) : 0;
            
          foundry.utils.setProperty(this, "system.damageReduction", defaultValue);
        } else if (typeof drValue !== "number") {
          // Only convert if it's not already a number
          foundry.utils.setProperty(this, "system.damageReduction", Number(drValue));
        }
      }
    };
    
    // Mark that we've added our hook
    CONFIG.Item.documentClass.prototype._hasReloadedHook = true;
  }
  
  // Consider removing the schema modification approach entirely,
  // or at least put it in a separate function that's only called
  // when the system is initially loaded, not on every update
}

// Actor Sheet Changes for DR
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Modify the armor section in character sheets
  modifyArmorSection(app, html, data);
  
  // Modify the weapon section to include AP
  modifyWeaponSection(app, html, data);
  
  // Add manual DR input to the character attributes section
  addManualDRToActorSheet(app, html, data);
  
  // Intercept weapon roll clicks to ensure AP is included
  html.find('.gear.item .item-img-container.rollable').click(function(event) {
    // Only run our code if this is a weapon
    const itemId = $(this).closest('.item').data('itemId');
    if (!itemId) return; // Let the original handler run
    
    const item = app.actor.items.get(itemId);
    if (!item || item.type !== "weapon") return; // Let the original handler run
    
    // Store the weapon for later reference
    app.actor._lastRolledWeapon = item;
    
    // Store the AP value specifically
    let apValue = item.system.armorPenetration;
    if (apValue === undefined || apValue === null || apValue === "null" || 
        isNaN(apValue) || apValue === "NaN") {
      apValue = 0;
    } else {
      apValue = Number(apValue);
    }
    
    app.actor._lastRolledWeaponAP = apValue;
    console.log(`Combat Reloaded: Stored AP ${apValue} for weapon ${item.name}`);
  });
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

// Hook renderChatMessage to add AP if it's missing
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Check if this is a weapon roll
  const isWeaponRoll = html.find('.dice-roll h2:contains("Weapon")').length > 0 || 
                     html.find('.dice-roll td:contains("Damage:")').length > 0;
  
  if (isWeaponRoll) {
    // If AP row doesn't exist, add it
    if (html.find('tr:contains("Armor Penetration")').length === 0) {
      // Get roll data from message flags
      const results = message.getFlag("yzecoriolis", "results");
      if (!results || !results.rollData) return;
      
      const rollData = results.rollData;
      
      // Get AP value
      let apValue = rollData.armorPenetration;
      if (apValue === undefined || apValue === null) {
        // Try to get the actor and item from the message
        const actorId = message.speaker.actor;
        if (!actorId) return;
        
        const actor = game.actors.get(actorId);
        if (!actor) return;
        
        const rollTitle = rollData.rollTitle;
        const weapon = actor.items.find(i => i.type === "weapon" && i.name === rollTitle);
        
        if (weapon) {
          apValue = weapon.system.armorPenetration;
          if (apValue === undefined || apValue === null || apValue === "null" || isNaN(apValue)) {
            apValue = 0;
          }
        } else {
          apValue = 0;
        }
      }
      
      // Find damage row to insert after
      const damageRow = html.find('tr:contains("Damage:")');
      if (damageRow.length > 0) {
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
    }
  }
  
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

// Catch the form submission to ensure proper data handling
Hooks.on("closeyzecoriolisItemSheet", async (app, html) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  if (app.item.type !== "weapon") return;
  
  // Double-check that the armorPenetration field exists and has proper value
  const currentValue = app.item.system.armorPenetration;
  if (currentValue === undefined || currentValue === null || currentValue === "null") {
    await app.item.update({"system.armorPenetration": 0});
  }
  
  // Clean up any observer
  if (app._armorPenetrationObserver) {
    app._armorPenetrationObserver.disconnect();
    app._armorPenetrationObserver = null;
  }
});

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