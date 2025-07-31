// Coriolis Combat Reloaded - Simplified and Stable Approach
// This module adds Armor Penetration to weapons and Damage Reduction to armor

const MODULE_ID = "coriolis-combat-reloaded";

// Initialize the module
Hooks.once("init", () => {
  console.log("Coriolis Combat Reloaded | Initializing");
  
  // Register module settings
  game.settings.register(MODULE_ID, "enableCombatReloaded", {
    name: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.name"),
    hint: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => window.location.reload()
  });
});

Hooks.once("ready", function() {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  console.log("Coriolis Combat Reloaded | Module Ready");
  
  // Initialize existing items
  initializeItemFields();
  
  // Hook into form submission to preserve values
  hookItemSheetSubmission();
  
  // Show activation message
  ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
});

// Initialize AP/DR fields for existing items
function initializeItemFields() {
  // Initialize weapons with AP field
  game.items.filter(i => i.type === "weapon").forEach(item => {
    if (item.system.armorPenetration === undefined) {
      item.update({"system.armorPenetration": 0});
    }
  });
  
  // Initialize armor with DR field
  game.items.filter(i => i.type === "armor").forEach(item => {
    if (item.system.damageReduction === undefined) {
      const arValue = item.system.armorRating || 0;
      item.update({"system.damageReduction": arValue});
    }
  });
}

// Hook: When new items are created, initialize custom fields
Hooks.on("createItem", (item, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  if (game.user.id !== userId) return;
  
  if (item.type === "weapon" && item.system.armorPenetration === undefined) {
    item.update({"system.armorPenetration": 0});
  }
  
  if (item.type === "armor" && item.system.damageReduction === undefined) {
    const armorRating = item.system.armorRating || 0;
    item.update({"system.damageReduction": armorRating});
  }
});

// Hook: Modify weapon item sheets to include AP field
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  if (app.item.type === "weapon") {
    addAPFieldToWeaponSheet(app, html);
  }
  
  if (app.item.type === "armor") {
    replaceARWithDROnArmorSheet(app, html);
  }
});

// Hook: Modify actor sheets to show DR and AP values
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Update armor display to show DR instead of AR
  modifyArmorDisplayOnActorSheet(app, html);
  
  // Update weapon display to show AP
  modifyWeaponDisplayOnActorSheet(app, html);
});

// Hook: Add AP to weapon roll chat messages
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  addAPToChatMessage(message, html);
});

function hookItemSheetSubmission() {
  // Store the original _onSubmit method
  const originalOnSubmit = CONFIG.Item.sheetClasses.yzecoriolisItemSheet.prototype._onSubmit;
  
  if (originalOnSubmit && !CONFIG.Item.sheetClasses.yzecoriolisItemSheet.prototype._combatReloadedHooked) {
    CONFIG.Item.sheetClasses.yzecoriolisItemSheet.prototype._onSubmit = async function(event, ...args) {
      console.log("Combat Reloaded: Item sheet submit intercepted", this.item.name);
      
      // Let the original method handle the submission
      const result = await originalOnSubmit.call(this, event, ...args);
      
      // After submission, ensure our custom fields are preserved
      if (this.item.type === "weapon") {
        const apInput = this.element.find('input[name="system.armorPenetration"]');
        if (apInput.length) {
          const apValue = Number(apInput.val()) || 0;
          console.log("Combat Reloaded: Ensuring AP value is preserved:", apValue);
          setTimeout(() => {
            if (this.item.system.armorPenetration !== apValue) {
              this.item.update({"system.armorPenetration": apValue});
            }
          }, 100);
        }
      }
      
      if (this.item.type === "armor") {
        const drInput = this.element.find('input[name="system.damageReduction"]');
        if (drInput.length) {
          const drValue = Number(drInput.val()) || 0;
          console.log("Combat Reloaded: Ensuring DR value is preserved:", drValue);
          setTimeout(() => {
            if (this.item.system.damageReduction !== drValue) {
              this.item.update({
                "system.damageReduction": drValue,
                "system.armorRating": drValue
              });
            }
          }, 100);
        }
      }
      
      return result;
    };
    
    CONFIG.Item.sheetClasses.yzecoriolisItemSheet.prototype._combatReloadedHooked = true;
  }
}


// Comprehensive solution for AP/DR reset issues

const MODULE_ID = "coriolis-combat-reloaded";

// Add this to your main.js - replace the existing functions

// Function to add AP field to weapon item sheets
function addAPFieldToWeaponSheet(app, html) {
  console.log("Combat Reloaded: Adding AP field to weapon:", app.item.name);
  
  // Prevent duplicate processing
  if (html.data('ap-processed')) {
    console.log("Combat Reloaded: Already processed, skipping");
    return;
  }
  html.data('ap-processed', true);
  
  // Remove any existing AP fields first
  html.find('.ap-field').remove();
  
  // Get current AP value with extensive logging
  let apValue = app.item.system.armorPenetration;
  console.log("Combat Reloaded: Raw AP value:", apValue, "Type:", typeof apValue, "isUndefined:", apValue === undefined, "isNull:", apValue === null);
  
  // Only initialize if truly undefined or null - don't touch existing values
  if (apValue === undefined || apValue === null) {
    console.log("Combat Reloaded: AP value is undefined/null, initializing to 0");
    apValue = 0;
    // Use a timeout to avoid race conditions with the sheet rendering
    setTimeout(() => {
      app.item.update({"system.armorPenetration": 0});
    }, 100);
  } else {
    // Don't convert or validate here - just use the existing value
    console.log("Combat Reloaded: Using existing AP value:", apValue);
  }
  
  // Find where to insert the AP field (after damage field)
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  
  if (damageField.length) {
    console.log("Combat Reloaded: Found damage field, inserting AP field");
    
    const apFieldHTML = `
      <div class="resource numeric-input flexrow ap-field" id="ap-field-${app.item.id}">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number" min="0" class="ap-input">
      </div>
    `;
    
    $(apFieldHTML).insertAfter(damageField);
    
    // Use a more targeted selector and different approach
    const apInput = html.find(`#ap-field-${app.item.id} .ap-input`);
    
    // Remove any existing event handlers to prevent duplicates
    apInput.off('change.combat-reloaded blur.combat-reloaded');
    
    // Add namespaced event handlers
    apInput.on('change.combat-reloaded blur.combat-reloaded', function(event) {
      const inputVal = $(this).val();
      console.log("Combat Reloaded: AP input event:", event.type, "Value:", inputVal, "Target:", event.target);
      
      // Don't do anything if the value hasn't actually changed
      const currentStoredValue = app.item.system.armorPenetration;
      const inputAsNumber = Number(inputVal);
      
      console.log("Combat Reloaded: Current stored:", currentStoredValue, "Input as number:", inputAsNumber);
      
      // If input is empty, set to 0
      if (inputVal === "" || inputVal === null || inputVal === undefined) {
        console.log("Combat Reloaded: Empty input, setting to 0");
        $(this).val(0);
        if (currentStoredValue !== 0) {
          app.item.update({"system.armorPenetration": 0});
        }
        return;
      }
      
      // Validate the number
      if (isNaN(inputAsNumber)) {
        console.log("Combat Reloaded: Invalid number entered, reverting to stored value");
        $(this).val(currentStoredValue || 0);
        return;
      }
      
      // Ensure non-negative
      const finalValue = Math.max(0, Math.floor(inputAsNumber));
      
      // Only update if the value actually changed
      if (finalValue !== currentStoredValue) {
        console.log("Combat Reloaded: Updating AP from", currentStoredValue, "to", finalValue);
        $(this).val(finalValue);
        
        // Use a small delay to prevent race conditions
        setTimeout(() => {
          app.item.update({"system.armorPenetration": finalValue});
        }, 50);
      } else {
        console.log("Combat Reloaded: Value unchanged, no update needed");
        $(this).val(finalValue); // Ensure display is consistent
      }
    });
    
    console.log("Combat Reloaded: AP field added successfully");
  } else {
    console.log("Combat Reloaded: Could not find damage field to insert AP after");
  }
}

// Function to replace AR with DR on armor item sheets
function replaceARWithDROnArmorSheet(app, html) {
  console.log("Combat Reloaded: Replacing AR with DR for armor:", app.item.name);
  
  // Prevent duplicate processing
  if (html.data('dr-processed')) {
    console.log("Combat Reloaded: Already processed DR, skipping");
    return;
  }
  html.data('dr-processed', true);
  
  // Get current values with extensive logging
  const armorRating = app.item.system.armorRating || 0;
  let damageReduction = app.item.system.damageReduction;
  
  console.log("Combat Reloaded: AR value:", armorRating, "DR value:", damageReduction, "DR Type:", typeof damageReduction);
  
  // Only initialize DR if it's truly undefined or null
  if (damageReduction === undefined || damageReduction === null) {
    console.log("Combat Reloaded: DR is undefined/null, initializing from AR:", armorRating);
    damageReduction = armorRating;
    // Use timeout to avoid race conditions
    setTimeout(() => {
      app.item.update({"system.damageReduction": armorRating});
    }, 100);
  } else {
    console.log("Combat Reloaded: Using existing DR value:", damageReduction);
  }
  
  // Find and modify the armor rating field
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    console.log("Combat Reloaded: Found AR field, converting to DR field");
    
    // Change the label
    armorRatingField.find('.resource-label').text(
      game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")
    );
    
    // Update the input to use DR
    const input = armorRatingField.find('input');
    input.attr('name', 'system.damageReduction');
    input.attr('id', `dr-input-${app.item.id}`);
    input.addClass('dr-input');
    input.val(damageReduction);
    
    // Remove existing event handlers
    input.off('change.combat-reloaded blur.combat-reloaded');
    
    // Add change handler with proper validation
    input.on('change.combat-reloaded blur.combat-reloaded', function(event) {
      const inputVal = $(this).val();
      console.log("Combat Reloaded: DR input event:", event.type, "Value:", inputVal);
      
      // Get current stored values
      const currentDR = app.item.system.damageReduction;
      const currentAR = app.item.system.armorRating;
      const inputAsNumber = Number(inputVal);
      
      console.log("Combat Reloaded: Current DR:", currentDR, "Current AR:", currentAR, "Input as number:", inputAsNumber);
      
      // Handle empty string
      if (inputVal === "" || inputVal === null || inputVal === undefined) {
        console.log("Combat Reloaded: Empty DR input, setting to 0");
        $(this).val(0);
        if (currentDR !== 0 || currentAR !== 0) {
          setTimeout(() => {
            app.item.update({
              "system.damageReduction": 0,
              "system.armorRating": 0
            });
          }, 50);
        }
        return;
      }
      
      // Validate the number
      if (isNaN(inputAsNumber)) {
        console.log("Combat Reloaded: Invalid DR number entered, reverting to stored value");
        $(this).val(currentDR || 0);
        return;
      }
      
      // Ensure non-negative integer
      const finalValue = Math.max(0, Math.floor(inputAsNumber));
      
      // Only update if the value actually changed
      if (finalValue !== currentDR || finalValue !== currentAR) {
        console.log("Combat Reloaded: Updating DR/AR from", currentDR, "/", currentAR, "to", finalValue);
        $(this).val(finalValue);
        
        // Use timeout to prevent race conditions and batch the updates
        setTimeout(() => {
          app.item.update({
            "system.damageReduction": finalValue,
            "system.armorRating": finalValue // Keep in sync for compatibility
          });
        }, 50);
      } else {
        console.log("Combat Reloaded: DR value unchanged, no update needed");
        $(this).val(finalValue); // Ensure display is consistent
      }
    });
    
    console.log("Combat Reloaded: DR field conversion completed");
  } else {
    console.log("Combat Reloaded: Could not find Armor Rating field");
  }
}

// Function to modify armor display on actor sheets
function modifyArmorDisplayOnActorSheet(app, html) {
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "armor") {
      // Replace armor rating display with DR
      const armorRatingDisplay = $(el).find('.gear-row-data').first();
      if (armorRatingDisplay.length) {
        const drValue = item.system.damageReduction || item.system.armorRating || 0;
        armorRatingDisplay.html(`<span class="dr-value">${drValue}</span>`);
      }
    }
  });
}

// Function to modify weapon display on actor sheets
function modifyWeaponDisplayOnActorSheet(app, html) {
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon") {
      // Add AP display to weapon name
      const weaponName = $(el).find('.gear-name');
      if (weaponName.length && !weaponName.find('.ap-indicator').length) {
        const apValue = item.system.armorPenetration || 0;
        weaponName.append(`<span class="ap-indicator"> (AP:${apValue})</span>`);
      }
    }
  });
}

// Function to add AP to chat messages
function addAPToChatMessage(message, html) {
  // Check if this is a weapon roll
  const isWeaponRoll = message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon";
  
  if (!isWeaponRoll) return;
  
  // Check if AP is already displayed
  if (html.find('.ap-chat-value').length > 0) return;
  
  // Get AP value from roll data or actor
  let apValue = 0;
  const rollData = message.flags.yzecoriolis.results.rollData;
  
  if (rollData.armorPenetration !== undefined) {
    apValue = rollData.armorPenetration;
  } else if (message.speaker.actor) {
    // Try to get from actor's weapon
    const actor = game.actors.get(message.speaker.actor);
    if (actor) {
      const weaponName = rollData.rollTitle;
      const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
      if (weapon) {
        apValue = weapon.system.armorPenetration || 0;
      }
    }
  }
  
  // Find where to insert AP (after damage row)
  const damageRow = html.find('tr:contains("Damage:")');
  if (damageRow.length) {
    const apRow = `
      <tr>
        <td colspan="2">
          ${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}: 
          <span class="ap-chat-value">${apValue}</span>
        </td>
      </tr>
    `;
    $(apRow).insertAfter(damageRow);
  }
}