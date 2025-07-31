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
// updated to remove jQuery dependency

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  addAPToChatMessage(message, html);
});

// Updated addAPToChatMessage function (no jQuery)
function addAPToChatMessage(message, html) {
  // Check if this is a weapon roll
  const isWeaponRoll = message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon";
  
  if (!isWeaponRoll) return;
  
  // Check if AP is already displayed
  if (html.querySelector('.ap-chat-value')) return;
  
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
  
  // Find where to insert AP (after damage row) - convert to vanilla JS
  let damageRow = null;
  
  // Look for a table row containing "Damage:"
  const allRows = html.querySelectorAll('tr');
  for (const row of allRows) {
    if (row.textContent.includes('Damage:')) {
      damageRow = row;
      break;
    }
  }
  
  if (damageRow) {
    const apRow = document.createElement('tr');
    apRow.innerHTML = `
      <td colspan="2">
        ${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}: 
        <span class="ap-chat-value">${apValue}</span>
      </td>
    `;
    damageRow.insertAdjacentElement('afterend', apRow);
  }
}

// Hook into form submission to preserve values
function hookItemSheetSubmission() {
  // Check if we've already hooked this
  if (window.coriolisCombatReloadedHooked) return;
  
  console.log("Combat Reloaded: Setting up form submission hooks");
  
  // Hook into item updates to ensure our fields are preserved
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
    if (game.user.id !== userId) return;
    
    console.log("Combat Reloaded: Item updated:", item.name, "Changes:", changes);
    
    // Ensure AP field exists on weapons
    if (item.type === "weapon" && changes.system && !("armorPenetration" in changes.system)) {
      if (item.system.armorPenetration === undefined || item.system.armorPenetration === null) {
        console.log("Combat Reloaded: Adding missing AP field to weapon");
        item.update({"system.armorPenetration": 0}, {render: false});
      }
    }
    
    // Ensure DR field exists on armor and sync with AR
    if (item.type === "armor") {
      if (changes.system?.damageReduction !== undefined) {
        const drValue = changes.system.damageReduction;
        if (item.system.armorRating !== drValue) {
          console.log("Combat Reloaded: Syncing AR to match DR:", drValue);
          item.update({"system.armorRating": drValue}, {render: false});
        }
      } else if (changes.system && !("damageReduction" in changes.system)) {
        if (item.system.damageReduction === undefined || item.system.damageReduction === null) {
          console.log("Combat Reloaded: Adding missing DR field to armor");
          const arValue = item.system.armorRating || 0;
          item.update({"system.damageReduction": arValue}, {render: false});
        }
      }
    }
  });
  
  window.coriolisCombatReloadedHooked = true;
}


// Updated to remove jQuery dependency
// Function to add AP field to weapon item sheets
function addAPFieldToWeaponSheet(app, html) {
  console.log("Combat Reloaded: Adding AP field to weapon:", app.item.name);
  
  // Convert html to HTMLElement if it's jQuery
  const htmlElement = html instanceof HTMLElement ? html : html[0];
  
  // Prevent duplicate processing
  if (htmlElement.dataset.apProcessed) {
    console.log("Combat Reloaded: Already processed, skipping");
    return;
  }
  htmlElement.dataset.apProcessed = "true";
  
  // Remove any existing AP fields first
  const existingFields = htmlElement.querySelectorAll('.ap-field');
  existingFields.forEach(field => field.remove());
  
  // Get current AP value
  let apValue = app.item.system.armorPenetration;
  console.log("Combat Reloaded: Raw AP value:", apValue, "Type:", typeof apValue);
  
  // Only initialize if truly undefined or null
  if (apValue === undefined || apValue === null) {
    console.log("Combat Reloaded: AP value is undefined/null, initializing to 0");
    apValue = 0;
    app.item.update({"system.armorPenetration": 0});
  } else {
    console.log("Combat Reloaded: Using existing AP value:", apValue);
    apValue = Number(apValue) || 0;
  }
  
  // Find where to insert the AP field
  let insertionPoint = null;
  
  // Try multiple approaches to find the damage field
  insertionPoint = htmlElement.querySelector('input[name="system.damage"]')?.closest('.resource') ||
                  Array.from(htmlElement.querySelectorAll('.resource-label')).find(label => 
                    label.textContent.includes('Damage'))?.closest('.resource') ||
                  htmlElement.querySelector('.resource');
  
  if (insertionPoint) {
    console.log("Combat Reloaded: Inserting AP field");
    
    const apField = document.createElement('div');
    apField.className = 'resource numeric-input flexrow ap-field';
    apField.id = `ap-field-${app.item.id}`;
    apField.innerHTML = `
      <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
      <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number" min="0" class="ap-input">
    `;
    
    insertionPoint.insertAdjacentElement('afterend', apField);
    
    // Add event handlers (using vanilla JS)
    const apInput = apField.querySelector('.ap-input');
    
    const handleAPChange = function(event) {
      const inputVal = event.target.value;
      console.log("Combat Reloaded: AP input changed to:", inputVal);
      
      if (inputVal === "") {
        event.target.value = 0;
        app.item.update({"system.armorPenetration": 0});
        return;
      }
      
      const numVal = Number(inputVal);
      if (isNaN(numVal)) {
        console.log("Combat Reloaded: Invalid AP number, reverting");
        event.target.value = app.item.system.armorPenetration || 0;
        return;
      }
      
      const finalValue = Math.max(0, Math.floor(numVal));
      console.log("Combat Reloaded: Updating AP to:", finalValue);
      event.target.value = finalValue;
      app.item.update({"system.armorPenetration": finalValue});
    };
    
    apInput.addEventListener('change', handleAPChange);
    apInput.addEventListener('blur', handleAPChange);
    
    console.log("Combat Reloaded: AP field added successfully");
  } else {
    console.log("Combat Reloaded: Could not find insertion point for AP field");
  }
}

// Updated to remove jQuery dependency
// Function to replace Armor Rating with Damage Reduction on armor sheets
function replaceARWithDROnArmorSheet(app, html) {
  console.log("Combat Reloaded: Processing armor sheet:", app.item.name);
  
  // Convert html to HTMLElement if it's jQuery
  const htmlElement = html instanceof HTMLElement ? html : html[0];
  
  // Prevent duplicate processing
  if (htmlElement.dataset.drProcessed) {
    console.log("Combat Reloaded: Already processed DR, skipping");
    return;
  }
  htmlElement.dataset.drProcessed = "true";
  
  // Get current values
  const armorRating = app.item.system.armorRating || 0;
  let damageReduction = app.item.system.damageReduction;
  
  console.log("Combat Reloaded: AR:", armorRating, "DR:", damageReduction);
  
  // Initialize DR if needed
  if (damageReduction === undefined || damageReduction === null) {
    console.log("Combat Reloaded: Initializing DR from AR");
    damageReduction = armorRating;
    app.item.update({"system.damageReduction": damageReduction});
  }
  
  // Find the armor rating field
  let armorField = htmlElement.querySelector('input[name="system.armorRating"]')?.closest('.resource') ||
                  Array.from(htmlElement.querySelectorAll('.resource-label')).find(label => 
                    label.textContent.includes('Armor Rating'))?.closest('.resource') ||
                  Array.from(htmlElement.querySelectorAll('.resource-label')).find(label => 
                    label.textContent.includes('Armor'))?.closest('.resource');
  
  if (armorField) {
    console.log("Combat Reloaded: Converting AR field to DR field");
    
    // Change the label
    const label = armorField.querySelector('.resource-label');
    if (label) {
      label.textContent = game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction");
    }
    
    // Update the input
    const input = armorField.querySelector('input');
    if (input) {
      input.name = 'system.damageReduction';
      input.value = damageReduction;
      
      console.log("Combat Reloaded: DR field conversion completed");
      
      // Add change handler
      const handleDRChange = function(event) {
        const val = event.target.value;
        const numVal = Number(val) || 0;
        const finalVal = Math.max(0, numVal);
        
        console.log("Combat Reloaded: DR changed to:", finalVal);
        
        // Update both DR and AR
        app.item.update({
          "system.damageReduction": finalVal,
          "system.armorRating": finalVal
        });
      };
      
      input.addEventListener('change', handleDRChange);
      input.addEventListener('blur', handleDRChange);
    }
  } else {
    console.log("Combat Reloaded: Could not find AR field to convert");
  }
}

function modifyArmorDisplayOnActorSheet(app, html) {
  console.log("Combat Reloaded: Modifying armor display on actor sheet");
  
  // Handle both jQuery and HTMLElement
  const htmlElement = html.jquery ? html[0] : html;
  
  // STEP 1: Replace "Armor Rating" header with "Damage Reduction"
  const armorHeaders = htmlElement.querySelectorAll('.gear-category-name');
  for (const header of armorHeaders) {
    const headerText = header.textContent.trim();
    if (headerText.includes("Armor Rating") || headerText === "Rating") {
      console.log("Combat Reloaded: Found Armor Rating header, replacing with Damage Reduction");
      header.textContent = "Damage Reduction";
      break;
    }
  }
  
  // STEP 2: Update armor item values  
  const gearItems = htmlElement.querySelectorAll('.gear.item');
  for (const el of gearItems) {
    const itemId = el.dataset.itemId;
    if (!itemId) continue;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "armor") {
      const armorRatingDisplay = el.querySelector('.gear-row-data');
      if (armorRatingDisplay) {
        const drValue = item.system.damageReduction || item.system.armorRating || 0;
        armorRatingDisplay.innerHTML = `<span class="dr-value">${drValue}</span>`;
        console.log("Combat Reloaded: Set DR value", drValue, "for armor", item.name);
      }
    }
  }
}

// Updated to remove jQuery dependency
// Function to modify weapon display on actor sheets
function modifyWeaponDisplayOnActorSheet(app, html) {
  console.log("Combat Reloaded: Modifying actor sheet weapon display");
  
  // Handle both jQuery and HTMLElement
  const htmlElement = html.jquery ? html[0] : html;
  
  // STEP 1: Replace "Initiative" with "AP" in the weapons header  
  const weaponsHeaders = htmlElement.querySelectorAll('.gear-category-header .gear-category-name');
  for (const header of weaponsHeaders) {
    if (header.textContent.trim() === "Initiative") {
      console.log("Combat Reloaded: Found Initiative header, replacing with AP");
      header.textContent = "AP";
      break;
    }
  }
  
  // STEP 2: Update each weapon row to show AP value
  const gearItems = htmlElement.querySelectorAll('.gear.item');
  for (const el of gearItems) {
    const itemId = el.dataset.itemId;
    if (!itemId) continue;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon") {
      console.log("Combat Reloaded: Processing weapon:", item.name);
      
      const apValue = item.system.armorPenetration || 0;
      const rowDataElements = el.querySelectorAll('.gear-row-data');
      
      if (rowDataElements.length > 1) {
        // The Initiative column should be the 2nd column (index 1)
        const initiativeColumn = rowDataElements[1];
        initiativeColumn.innerHTML = `<span class="ap-value-display">${apValue}</span>`;
        
        console.log("Combat Reloaded: Set AP value", apValue, "for weapon", item.name);
      }
    }
  }
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