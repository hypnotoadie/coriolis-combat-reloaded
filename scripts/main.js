// Coriolis Combat Reloaded - main.js

// Constants and Settings
const MODULE_ID = "coriolis-combat-reloaded";

// Register module settings
Hooks.once("init", () => {
  console.log("coriolis-combat-reloaded | Initializing Coriolis Combat Reloaded");
  
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

// This is our main hook for implementing AP/DR
Hooks.once("ready", function() {
  // Make sure Combat Reloaded is enabled
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Add the new fields to Item classes
  addFieldsToItemClasses();
  
  // Add hooks for rendering sheets
  setupRenderHooks();
});

// Safely add AP/DR fields to item classes
function addFieldsToItemClasses() {
  // Add prepareData hook for items
  if (!CONFIG.Item.documentClass.prototype._hasReloadedHook) {
    const originalPrepareData = CONFIG.Item.documentClass.prototype.prepareData;
    
    CONFIG.Item.documentClass.prototype.prepareData = function() {
      // Call the original method
      originalPrepareData.call(this);
      
      try {
        // Add AP field to weapons
        if (this.type === "weapon") {
          // Safely get current AP value
          let apValue = foundry.utils.getProperty(this, "system.armorPenetration");
          
          // Initialize with 0 if undefined/null
          if (apValue === undefined || apValue === null) {
            foundry.utils.setProperty(this, "system.armorPenetration", 0);
          }
        }
        
        // Add DR field to armor
        if (this.type === "armor") {
          // Safely get current DR value
          let drValue = foundry.utils.getProperty(this, "system.damageReduction");
          
          // Use armorRating as default if DR is undefined
          if (drValue === undefined || drValue === null) {
            const arValue = foundry.utils.getProperty(this, "system.armorRating");
            foundry.utils.setProperty(this, "system.damageReduction", 
              (arValue !== undefined && arValue !== null) ? Number(arValue) : 0);
          }
        }
      } catch (error) {
        console.error("Combat Reloaded: Error in prepareData", error);
      }
    };
    
    // Mark that we've added our hook
    CONFIG.Item.documentClass.prototype._hasReloadedHook = true;
  }
}

// Setup render hooks for sheets
function setupRenderHooks() {
  // Hook into actor sheet rendering
  Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
    try {
      if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
      
      // Modify armor section in character sheets
      modifyArmorSection(app, html, data);
      
      // Modify weapon section to include AP
      modifyWeaponSection(app, html, data);
      
      // Add manual DR input to character attributes
      addManualDRToActorSheet(app, html, data);
    } catch (error) {
      console.error("Combat Reloaded: Error in renderyzecoriolisActorSheet", error);
    }
  });
  
  // Hook into item sheet rendering
  Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
    try {
      if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
      
      // If this is an armor sheet, modify it to show DR
      if (app.item.type === "armor") {
        modifyArmorSheetDisplay(app, html, data);
      }
      
      // If this is a weapon sheet, add AP field
      if (app.item.type === "weapon") {
        modifyWeaponSheetDisplay(app, html, data);
      }
    } catch (error) {
      console.error("Combat Reloaded: Error in renderyzecoriolisItemSheet", error);
    }
  });
  
  // Hook into chat message rendering
  Hooks.on("renderChatMessage", (message, html, data) => {
    try {
      if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
      
      // Add AP to weapon rolls in chat
      addAPToChatMessage(message, html, data);
      
      // Handle item cards in chat
      handleItemCards(message, html, data);
    } catch (error) {
      console.error("Combat Reloaded: Error in renderChatMessage", error);
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
      armorRatingHeader.text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
    }
  }
  
  // Update each armor item to show DR
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "armor") {
      // Find where armor rating is displayed
      const rowData = $(el).find('.gear-row-data:first');
      if (rowData.length) {
        const drValue = getArmorDRValue(item);
        rowData.html(`<span class="dr-value">${drValue}</span>`);
      }
    }
  });
}

// Helper function to get DR value from armor
function getArmorDRValue(armorItem) {
  if (!armorItem) return 0;
  
  // Try to get damage reduction
  const drValue = armorItem.system.damageReduction;
  if (drValue !== undefined && drValue !== null) {
    return Number(drValue);
  }
  
  // Fall back to armor rating
  const arValue = armorItem.system.armorRating;
  if (arValue !== undefined && arValue !== null) {
    return Number(arValue);
  }
  
  return 0;
}

// Function to modify weapon section to include AP
function modifyWeaponSection(app, html, data) {
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon") {
      // Add AP after name
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

// Helper function to get AP value from weapon
function getWeaponAPValue(weaponItem) {
  if (!weaponItem) return 0;
  
  const apValue = weaponItem.system.armorPenetration;
  if (apValue !== undefined && apValue !== null) {
    return Number(apValue);
  }
  
  return 0;
}

// Function to add manual DR input to character sheet
function addManualDRToActorSheet(app, html, data) {
  // Get current values
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  const manualDR = actor.system.attributes?.manualDROverride;
  
  // Find the stats section
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
               value="${manualDR !== undefined && manualDR !== null ? manualDR : ''}" 
               placeholder="${calculatedDR}" 
               data-dtype="Number" />
      </div>
    </li>
  `;
  
  // Insert after Radiation
  const radiationEntry = statsSection.find('.stat-label:contains("Radiation")').closest('.entry');
  if (radiationEntry.length) {
    $(drEntry).insertAfter(radiationEntry);
  } else {
    statsSection.append(drEntry);
  }
  
  // Add event handler for input changes
  html.find('input[name="system.attributes.manualDROverride"]').change(function() {
    const val = $(this).val();
    if (val === "") {
      app.actor.update({"system.attributes.manualDROverride": null});
    } else {
      app.actor.update({"system.attributes.manualDROverride": Number(val)});
    }
  });
}

// Function to calculate total DR from equipped armor
function calculateActorDR(actor) {
  let totalDR = 0;
  
  // Find all equipped armor
  const equippedArmor = actor.items.filter(item => 
    item.type === "armor" && 
    item.system.equipped === true
  );
  
  // Sum up DR values
  for (const armor of equippedArmor) {
    totalDR += getArmorDRValue(armor);
  }
  
  return totalDR;
}

// Function to modify armor item sheet
function modifyArmorSheetDisplay(app, html, data) {
  // Find armor rating field
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Replace with damage reduction
    let drValue = app.item.system.damageReduction;
    if (drValue === undefined || drValue === null) {
      drValue = app.item.system.armorRating || 0;
      app.item.update({"system.damageReduction": drValue});
    }
    
    // Update label and input
    armorRatingField.find('.resource-label').text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
    armorRatingField.find('input').attr('name', 'system.damageReduction').val(drValue);
    
    // Add change handler
    armorRatingField.find('input').change(function() {
      const val = $(this).val();
      app.item.update({"system.damageReduction": val === "" ? 0 : Number(val)});
    });
  } else {
    // Add new field if needed
    const inputSection = html.find('.header-fields .flexcol').first();
    if (inputSection.length) {
      let drValue = app.item.system.damageReduction;
      if (drValue === undefined || drValue === null) {
        drValue = 0;
        app.item.update({"system.damageReduction": 0});
      }
      
      // Create field
      const drField = `
        <div class="resource numeric-input flexrow dr-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}</label>
          <input type="number" min="0" name="system.damageReduction" value="${drValue}" data-dtype="Number" />
        </div>
      `;
      inputSection.append(drField);
      
      // Add handler
      inputSection.find('input[name="system.damageReduction"]').change(function() {
        const val = $(this).val();
        app.item.update({"system.damageReduction": val === "" ? 0 : Number(val)});
      });
    }
  }
}

// Function to modify weapon item sheet
function modifyWeaponSheetDisplay(app, html, data) {
  // Only proceed if this is a weapon
  if (app.item.type !== "weapon") return;
  
  // Remove any existing AP fields
  html.find('.ap-field').remove();
  
  // Find damage field
  const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
  const customDamageField = html.find('.resource-label:contains("Custom Damage")').closest('.resource');
  
  if (damageField.length && customDamageField.length) {
    // Get AP value
    let apValue = app.item.system.armorPenetration;
    if (apValue === undefined || apValue === null) {
      apValue = 0;
      app.item.update({"system.armorPenetration": 0});
    }
    
    // Create AP field
    const apField = `
      <div class="resource numeric-input flexrow ap-field" id="single-ap-field">
        <label class="resource-label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}</label>
        <input type="number" min="0" name="system.armorPenetration" value="${apValue}" data-dtype="Number">
      </div>
    `;
    
    // Insert after damage
    customDamageField.before(apField);
    
    // Add change handler
    html.find('#single-ap-field input').change(function() {
      const val = $(this).val();
      app.item.update({"system.armorPenetration": val === "" ? 0 : Number(val)});
    });
  }
}

// Function to add AP to chat messages
function addAPToChatMessage(message, html, data) {
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
        // Try to get from actor/item
        const actorId = message.speaker.actor;
        if (!actorId) return;
        
        const actor = game.actors.get(actorId);
        if (!actor) return;
        
        const rollTitle = rollData.rollTitle;
        const weapon = actor.items.find(i => i.type === "weapon" && i.name === rollTitle);
        
        if (weapon) {
          apValue = weapon.system.armorPenetration || 0;
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
}

// Function to handle item cards in chat
function handleItemCards(message, html, data) {
  // Check if this is an item card
  const itemCard = html.find(".item-card");
  if (!itemCard.length) return;
  
  const itemId = itemCard.data("itemId");
  const actorId = itemCard.data("actorId");
  if (!itemId || !actorId) return;
  
  const actor = game.actors.get(actorId);
  if (!actor) return;
  
  const item = actor.items.get(itemId);
  if (!item) return;
  
  // Modify weapon cards
  if (item.type === "weapon") {
    const damageElement = html.find(".card-damage");
    if (damageElement.length) {
      const apValue = item.system.armorPenetration || 0;
      
      // Create AP element if not exists
      if (html.find(".card-ap").length === 0) {
        const apElement = `
          <div class="card-ap">
            <span class="label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}:</span>
            <span class="value">${apValue}</span>
          </div>
        `;
        damageElement.after(apElement);
      }
    }
  }
  
  // Modify armor cards
  if (item.type === "armor") {
    const attributesElement = html.find(".card-attributes");
    if (attributesElement.length && html.find(".card-dr").length === 0) {
      const drValue = item.system.damageReduction || item.system.armorRating || 0;
      
      // Create DR element
      const drElement = `
        <div class="card-dr">
          <span class="label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}:</span>
          <span class="value">${drValue}</span>
        </div>
      `;
      attributesElement.append(drElement);
      
      // Remove original Armor Rating if exists
      html.find(".card-armor-rating").remove();
    }
  }
}