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
  setupChatObserver();
  ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
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

// Setup Observer for Chat Messages
function setupChatObserver() {
  // Add MutationObserver to watch for new chat messages
  const chatLog = document.getElementById("chat-log");
  if (chatLog) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                node.classList.contains('message') && 
                node.dataset.messageId) {
              
              // Process the new chat message
              processNewChatMessage(node);
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(chatLog, { childList: true, subtree: false });
    console.log("Added observer for chat messages");
  }
}

// Process a new chat message
function processNewChatMessage(messageNode) {
  // Get the message ID
  const messageId = messageNode.dataset.messageId;
  const message = game.messages.get(messageId);
  
  // Skip if not a valid message
  if (!message) return;
  
  // Check if it's a weapon roll
  const isWeaponRoll = $(messageNode).find('.dice-roll').length > 0 && 
                      ($(messageNode).find('h2:contains("Weapon")').length > 0 ||
                       message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon");
  
  if (isWeaponRoll) {
    // Find AP value
    let apValue = 0;
    
    // Try to get from actor
    if (message.speaker.actor) {
      const actor = game.actors.get(message.speaker.actor);
      if (actor) {
        // Try to get weapon name
        let weaponName = "";
        
        // Try from roll data
        if (message.flags?.yzecoriolis?.results?.rollData?.rollTitle) {
          weaponName = message.flags.yzecoriolis.results.rollData.rollTitle;
        }
        
        // Try from message content
        if (!weaponName) {
          const titleElement = $(messageNode).find('h2.roll-name').text();
          if (titleElement) {
            weaponName = titleElement.split('\n')[0].trim();
          }
        }
        
        // If we have a weapon name, find the weapon
        if (weaponName) {
          const weapon = actor.items.find(i => 
            i.type === "weapon" && 
            i.name === weaponName
          );
          
          if (weapon && weapon.system.armorPenetration !== undefined) {
            apValue = weapon.system.armorPenetration;
            console.log(`Found AP ${apValue} for weapon ${weaponName}`);
          }
        }
      }
    }
    
    // Find damage row to add AP after
    const messageContent = $(messageNode).find('.message-content');
    const damageRow = messageContent.find('tr:contains("Damage:")');
    
    // Only add if damage row exists and AP doesn't already exist
    if (damageRow.length && !messageContent.find('.ap-value').length) {
      // Create AP row HTML
      const apRow = `
        <tr>
          <td>AP:</td>
          <td><span class="ap-value">${apValue}</span></td>
        </tr>
      `;
      
      // Insert after damage row
      $(apRow).insertAfter(damageRow);
    }
  }
  
  // Also check for item cards
  const itemCard = $(messageNode).find(".item-card");
  if (itemCard.length) {
    const itemId = itemCard.data("itemId");
    const actorId = itemCard.data("actorId");
    
    if (itemId && actorId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const item = actor.items.get(itemId);
        if (item) {
          if (item.type === "weapon") {
            addAPToWeaponItemCard(item, $(messageNode));
          } else if (item.type === "armor") {
            replaceDROnArmorItemCard(item, $(messageNode));
          }
        }
      }
    }
  }
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

// Handle the rendering of chat messages directly
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Process the chat message with our existing function
  processNewChatMessage(html[0]);
});

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