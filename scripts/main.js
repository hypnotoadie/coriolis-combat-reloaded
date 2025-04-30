// Coriolis Combat Reloaded - main.js

// Constants
const MODULE_ID = "coriolis-combat-reloaded";

// Register module settings
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
    onChange: _ => window.location.reload()
  });
});

// This is our main hook for implementing changes
Hooks.once("ready", function() {
  // Make sure Combat Reloaded is enabled
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  console.log("Coriolis Combat Reloaded | Module Ready");
  
  // Initialize the module
  initializeItemFields();
  patchCoriolisRoll();
});

// Initialize item fields for existing items
function initializeItemFields() {
  // Add armorPenetration to weapons that don't have it
  game.items.filter(i => i.type === "weapon").forEach(item => {
    if (item.system.armorPenetration === undefined) {
      console.log(`Initializing AP field for weapon ${item.name}`);
      item.update({"system.armorPenetration": 0});
    }
  });
  
  // Add damageReduction to armor that don't have it
  game.items.filter(i => i.type === "armor").forEach(item => {
    if (item.system.damageReduction === undefined) {
      const arValue = item.system.armorRating || 0;
      console.log(`Initializing DR field for armor ${item.name} with value ${arValue}`);
      item.update({"system.damageReduction": arValue});
    }
  });
}

// Completely rewritten patch for Coriolis roll system
function patchCoriolisRoll() {
  // Only patch if the coriolis roll module exists
  if (!game.yzecoriolis || typeof game.yzecoriolis.coriolisRoll !== "function") {
    console.log("Combat Reloaded: Could not find Coriolis roll function to patch");
    return;
  }
  
  // Store the original coriolisRoll function
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our patched version
  game.yzecoriolis.coriolisRoll = async function(chatOptions, rollData) {
    // If this is a weapon roll, make sure to include AP value
    if (rollData.rollType === "weapon") {
      // Get the actor
      const actor = game.actors.get(chatOptions.speaker.actor);
      if (actor) {
        // Find the weapon being used based on roll title
        const weaponName = rollData.rollTitle;
        const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
        
        if (weapon) {
          // Get AP value from weapon
          const apValue = weapon.system.armorPenetration !== undefined ? weapon.system.armorPenetration : 0;
          
          // Set AP value in roll data
          rollData.armorPenetration = apValue;
          console.log(`Including AP ${apValue} for weapon ${weaponName} in roll data`);
        }
      }
    }
    
    // Call the original roll function
    return await originalCoriolisRoll(chatOptions, rollData);
  };
  
  console.log("Combat Reloaded: Successfully patched coriolisRoll function");
  
  // Additionally patch the module that processes weapon rolls
  if (typeof game.yzecoriolis.CoriolisModifierDialog === "function") {
    const originalDialog = game.yzecoriolis.CoriolisModifierDialog;
    
    // Create a wrapped version
    game.yzecoriolis.CoriolisModifierDialog = function(rollData, chatOptions) {
      // If this is a weapon roll, make sure AP is included
      if (rollData.rollType === "weapon" && rollData.armorPenetration === undefined) {
        // Attempt to get the weapon
        const actor = game.actors.get(chatOptions.speaker.actor);
        if (actor) {
          const weaponName = rollData.rollTitle;
          const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
          
          if (weapon) {
            rollData.armorPenetration = weapon.system.armorPenetration || 0;
            console.log(`CoriolisModifierDialog: Added AP ${rollData.armorPenetration} from weapon ${weaponName}`);
          }
        }
      }
      
      // Call the original constructor
      return originalDialog.call(this, rollData, chatOptions);
    };
    
    // Make sure prototype chain is preserved
    game.yzecoriolis.CoriolisModifierDialog.prototype = originalDialog.prototype;
    
    console.log("Combat Reloaded: Successfully patched CoriolisModifierDialog");
  }
  
  // Patch the chat message creation for weapon rolls
  const originalCreateChatMessage = ChatMessage.create;
  
  ChatMessage.create = async function(data, options) {
    // Check if this is a weapon roll result
    if (data.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon") {
      const results = data.flags.yzecoriolis.results;
      
      // If the roll data has AP, make sure it appears in the message content
      if (results.rollData.armorPenetration !== undefined) {
        const apValue = results.rollData.armorPenetration;
        
        // If content exists and doesn't already include AP value
        if (data.content && !data.content.includes('class="ap-value"')) {
          // Find damage row
          const damageRowIndex = data.content.indexOf('Damage:');
          if (damageRowIndex !== -1) {
            const endOfRow = data.content.indexOf('</tr>', damageRowIndex);
            if (endOfRow !== -1) {
              // Create AP row
              const apRow = `
                <tr>
                  <td>${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}:</td>
                  <td><span class="ap-value">${apValue}</span></td>
                </tr>
              `;
              
              // Insert after damage row
              data.content = data.content.substring(0, endOfRow + 5) + apRow + data.content.substring(endOfRow + 5);
            }
          }
        }
      }
    }
    
    // Call the original create function
    return originalCreateChatMessage.call(this, data, options);
  };
  
  console.log("Combat Reloaded: Successfully patched ChatMessage.create");
}

// Hook into item sheet rendering
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // If this is a weapon sheet, add AP field
  if (app.item.type === "weapon") {
    addAPFieldToWeaponSheet(app, html, data);
  }
  
  // If this is an armor sheet, replace AR with DR
  if (app.item.type === "armor") {
    replaceARWithDROnArmorSheet(app, html, data);
  }
});

// Fixed addAPToWeaponSheet function - styling fixes
function addAPFieldToWeaponSheet(app, html, data) {
  // First check if the form has our module flag to prevent multiple runs
  if (html.data('ap-processed')) {
    console.log("AP field already processed, skipping");
    return;
  }
  
  // Mark the form as processed
  html.data('ap-processed', true);
  
  // Get current AP value from the item or default to 0
  let apValue = app.item.system.armorPenetration;
  if (apValue === undefined || apValue === null || isNaN(apValue)) {
    apValue = 0;
    // Initialize the field in the item data
    app.item.update({"system.armorPenetration": 0});
  }
  
  // Remove any existing AP fields that might have been added by a previous run
  html.find('.ap-field').remove();
  
  // Find all the relevant fields to determine where to place our AP field
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  const customDamageField = html.find('.resource-label:contains("Custom Damage")').closest('.resource');
  const numericCritField = html.find('.resource-label:contains("Numeric Crit")').closest('.resource');
  
  // Determine the insertion point (after Custom Damage, before Numeric Crit)
  let insertAfter = customDamageField.length ? customDamageField : damageField;
  let insertBefore = numericCritField;
  
  if (insertAfter.length) {
    // Create AP field HTML with a unique ID to make it easier to find
    // Add numeric-input class to match other fields
    const apField = `
      <div class="resource numeric-input flexrow ap-field" id="ap-field-${app.item.id}">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number">
      </div>
    `;
    
    // Insert the field at the appropriate position
    if (insertBefore.length) {
      $(apField).insertBefore(insertBefore);
    } else {
      $(apField).insertAfter(insertAfter);
    }
    
    // Add event handler to ensure the value gets saved properly
    html.find(`#ap-field-${app.item.id} input`).change(function() {
      const val = $(this).val();
      const numVal = Number(val);
      
      if (isNaN(numVal)) {
        $(this).val(0);
        app.item.update({"system.armorPenetration": 0});
      } else {
        app.item.update({"system.armorPenetration": numVal});
        console.log(`Updated AP value to ${numVal} for item ${app.item.name}`);
      }
    });
  }
}

// Replace Armor Rating with Damage Reduction on armor sheet
function replaceARWithDROnArmorSheet(app, html, data) {
  // Check if our DR field already exists
  if (html.data('dr-processed')) {
    return;
  }
  
  // Mark the form as processed
  html.data('dr-processed', true);
  
  // Get current armor rating
  const armorRating = app.item.system.armorRating || 0;
  
  // Get damage reduction value or use armor rating as default
  let damageReduction = app.item.system.damageReduction;
  if (damageReduction === undefined || damageReduction === null || isNaN(damageReduction)) {
    damageReduction = armorRating;
    // Initialize the field in the item data
    app.item.update({"system.damageReduction": armorRating});
  }
  
  // Find the armor rating field
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Change label to Damage Reduction
    armorRatingField.find('.resource-label').text(game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction"));
    
    // Change the input to use damageReduction instead of armorRating
    const armorInput = armorRatingField.find('input');
    
    // Store original name for reference
    const originalName = armorInput.attr('name');
    
    // Create a hidden input to maintain the original armor rating field
    // This prevents the system from breaking if it expects the field
    const hiddenInput = $(`<input type="hidden" name="${originalName}" value="${armorRating}">`);
    armorRatingField.append(hiddenInput);
    
    // Change the visible input to use damageReduction
    armorInput.attr('name', 'system.damageReduction');
    armorInput.val(damageReduction);
    armorInput.attr('id', `dr-field-${app.item.id}`);
    
    // Add event handler to ensure proper saving
    armorInput.change(function() {
      const val = $(this).val();
      const numVal = Number(val);
      
      if (isNaN(numVal)) {
        $(this).val(0);
        app.item.update({"system.damageReduction": 0});
      } else {
        app.item.update({"system.damageReduction": numVal});
        // Also update the armor rating to keep both in sync
        app.item.update({"system.armorRating": numVal});
        // Update the hidden input
        hiddenInput.val(numVal);
      }
    });
  }
}

// Hook into chat message rendering
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Check if this is a weapon roll and doesn't already have AP value
  if (message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon" && 
      !html.find('.ap-value').length) {
    // Get the roll data
    const rollData = message.flags.yzecoriolis.results.rollData;
    
    // If AP value exists in roll data
    if (rollData.armorPenetration !== undefined) {
      const apValue = rollData.armorPenetration;
      
      // Find damage row to add AP after
      const damageRow = html.find('tr:contains("Damage:")');
      if (damageRow.length) {
        // Create AP row HTML
        const apRow = `
          <tr>
            <td>${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}:</td>
            <td><span class="ap-value">${apValue}</span></td>
          </tr>
        `;
        
        // Insert after damage row
        $(apRow).insertAfter(damageRow);
      }
    }
  }
  
  // Check if this is an item card for armor or weapon
  const itemCard = html.find(".item-card");
  if (itemCard.length) {
    const itemId = itemCard.data("itemId");
    const actorId = itemCard.data("actorId");
    
    if (itemId && actorId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const item = actor.items.get(itemId);
        if (item) {
          if (item.type === "weapon") {
            addAPToWeaponItemCard(item, html);
          } else if (item.type === "armor") {
            replaceDROnArmorItemCard(item, html);
          }
        }
      }
    }
  }
});

// Add AP to weapon item card
function addAPToWeaponItemCard(weapon, html) {
  // Check if AP is already displayed
  if (html.find('.card-ap').length > 0) return;
  
  // Get AP value
  const apValue = weapon.system.armorPenetration || 0;
  
  // Find where to add AP info
  const damageElement = html.find(".card-damage");
  if (damageElement.length) {
    // Create AP element
    const apElement = `
      <div class="card-ap">
        <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}:</span>
        <span class="value">${apValue}</span>
      </div>
    `;
    
    // Insert after damage
    $(apElement).insertAfter(damageElement);
  }
}

// Replace Armor Rating with DR on armor item card
function replaceDROnArmorItemCard(armor, html) {
  // Check if we've already replaced AR with DR
  if (html.find('.card-damage-reduction').length > 0) return;
  
  // Get DR value (or use armor rating as fallback)
  const armorRating = armor.system.armorRating || 0;
  const damageReduction = armor.system.damageReduction !== undefined ? 
                         armor.system.damageReduction : armorRating;
  
  // Find the armor rating element
  const arElement = html.find(".card-armor-rating");
  
  if (arElement.length) {
    // Replace AR with DR
    arElement.find(".label").text(game.i18n.localize("coriolis-combat-reloaded.labels.dr") + ":");
    arElement.find(".value").text(damageReduction);
    
    // Add DR class
    arElement.removeClass("card-armor-rating").addClass("card-damage-reduction");
  } else {
    // If no AR element, add DR element to properties
    const propertiesElement = html.find(".item-properties");
    if (propertiesElement.length) {
      const drElement = `
        <div class="card-damage-reduction">
          <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.dr")}:</span>
          <span class="value">${damageReduction}</span>
        </div>
      `;
      
      propertiesElement.append(drElement);
    }
  }
}

// When items are created, initialize our custom fields
Hooks.on("createItem", (item, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Only process our own user's items
  if (game.user.id !== userId) return;
  
  // Initialize weapon AP
  if (item.type === "weapon" && item.system.armorPenetration === undefined) {
    item.update({"system.armorPenetration": 0});
  }
  
  // Initialize armor DR
  if (item.type === "armor" && item.system.damageReduction === undefined) {
    const armorRating = item.system.armorRating || 0;
    item.update({"system.damageReduction": armorRating});
  }
});

// Also initialize when actor items are created
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Initialize new items
  if (data.type === "weapon" && data.system?.armorPenetration === undefined) {
    item.updateSource({"system.armorPenetration": 0});
  }
  
  if (data.type === "armor" && data.system?.damageReduction === undefined) {
    const armorRating = data.system?.armorRating || 0;
    item.updateSource({"system.damageReduction": armorRating});
  }
});

// Notify users when the module is active
Hooks.once("ready", function() {
  if (game.settings.get(MODULE_ID, "enableCombatReloaded")) {
    ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
  }
});