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
});

// Initialize item fields for existing items
function initializeItemFields() {
  // Add armorPenetration to weapons that don't have it
  game.items.filter(i => i.type === "weapon").forEach(item => {
    if (item.system.armorPenetration === undefined) {
      item.update({"system.armorPenetration": 0});
    }
  });
  
  // Add damageReduction to armor that don't have it
  game.items.filter(i => i.type === "armor").forEach(item => {
    if (item.system.damageReduction === undefined) {
      const arValue = item.system.armorRating || 0;
      item.update({"system.damageReduction": arValue});
    }
  });
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

// Hook into chat message rendering
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Check if this is a weapon roll
  if (message.rolls?.length > 0 && message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon") {
    addAPToWeaponRollChat(message, html, data);
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

// Add AP field to weapon sheet
function addAPFieldToWeaponSheet(app, html, data) {
  // Get current AP value or default to 0
  let apValue = app.item.system.armorPenetration;
  if (apValue === undefined || apValue === null) {
    apValue = 0;
    // Initialize the field in the item data
    app.item.update({"system.armorPenetration": 0});
  }
  
  // Find where to insert the AP field (after damage, before range)
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  const rangeField = html.find('.resource-label:contains("Range")').closest('.resource');
  
  if (damageField.length && rangeField.length) {
    // Create AP field HTML
    const apField = `
      <div class="resource ap-field">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number">
      </div>
    `;
    
    // Insert the field
    $(apField).insertAfter(damageField);
  }
}

// Replace Armor Rating with Damage Reduction on armor sheet
function replaceARWithDROnArmorSheet(app, html, data) {
  // Get current armor rating
  const armorRating = app.item.system.armorRating || 0;
  
  // Get damage reduction value or use armor rating as default
  let damageReduction = app.item.system.damageReduction;
  if (damageReduction === undefined || damageReduction === null) {
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
    armorRatingField.find('input')
      .attr('name', 'system.damageReduction')
      .val(damageReduction);
  }
}

// Add AP to weapon roll chat message
function addAPToWeaponRollChat(message, html, data) {
  // Check if AP is already displayed
  if (html.find('.ap-value').length > 0) return;
  
  // Get the weapon's AP value
  let apValue = 0;
  
  const results = message.getFlag("yzecoriolis", "results");
  if (results && results.rollData) {
    // Try to get AP from roll data
    apValue = results.rollData.armorPenetration || 0;
    
    // If AP is not in roll data, try to get from actor's weapon
    if (!apValue && results.rollData.rollTitle) {
      const actor = game.actors.get(message.speaker.actor);
      if (actor) {
        const weaponName = results.rollData.rollTitle;
        const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
        if (weapon) {
          apValue = weapon.system.armorPenetration || 0;
        }
      }
    }
  }
  
  // Find where to insert the AP value (after damage)
  const damageElement = html.find('tr:contains("Damage:")');
  if (damageElement.length) {
    // Create AP row HTML
    const apRow = `
      <tr>
        <td>${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}:</td>
        <td><span class="ap-value">${apValue}</span></td>
      </tr>
    `;
    
    // Insert after damage row
    $(apRow).insertAfter(damageElement);
  }
}

// Add AP to weapon item card
function addAPToWeaponItemCard(weapon, html) {
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