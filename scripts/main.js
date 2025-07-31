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

// Main module setup
Hooks.once("ready", function() {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  console.log("Coriolis Combat Reloaded | Module Ready");
  
  // Initialize existing items
  initializeItemFields();
  
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

// Function to add AP field to weapon item sheets
function addAPFieldToWeaponSheet(app, html) {
  // Prevent duplicate processing
  if (html.data('ap-processed')) return;
  html.data('ap-processed', true);
  
  // Get current AP value
  let apValue = app.item.system.armorPenetration;
  if (apValue === undefined || apValue === null || isNaN(apValue)) {
    apValue = 0;
    app.item.update({"system.armorPenetration": 0});
  }
  
  // Find where to insert the AP field (after damage field)
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  
  if (damageField.length) {
    const apFieldHTML = `
      <div class="resource numeric-input flexrow ap-field">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number" min="0">
      </div>
    `;
    
    $(apFieldHTML).insertAfter(damageField);
    
    // Add change handler
    html.find('input[name="system.armorPenetration"]').change(function() {
      const val = Number($(this).val()) || 0;
      app.item.update({"system.armorPenetration": val});
    });
  }
}

// Function to replace AR with DR on armor item sheets
function replaceARWithDROnArmorSheet(app, html) {
  // Prevent duplicate processing
  if (html.data('dr-processed')) return;
  html.data('dr-processed', true);
  
  // Get current values
  const armorRating = app.item.system.armorRating || 0;
  let damageReduction = app.item.system.damageReduction;
  
  if (damageReduction === undefined || damageReduction === null || isNaN(damageReduction)) {
    damageReduction = armorRating;
    app.item.update({"system.damageReduction": damageReduction});
  }
  
  // Find and modify the armor rating field
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Change the label
    armorRatingField.find('.resource-label').text(
      game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")
    );
    
    // Update the input to use DR
    const input = armorRatingField.find('input');
    input.attr('name', 'system.damageReduction');
    input.val(damageReduction);
    
    // Add change handler
    input.change(function() {
      const val = Number($(this).val()) || 0;
      app.item.update({"system.damageReduction": val});
      // Keep AR in sync for compatibility
      app.item.update({"system.armorRating": val});
    });
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