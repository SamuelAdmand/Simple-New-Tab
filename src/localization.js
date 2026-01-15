// Get user preferred language
function getUserLanguage() {
  return chrome.i18n.getUILanguage();
}

window.getLocalizedMessage = function (messageName) {
  const userLang = getUserLanguage();
  let message = chrome.i18n.getMessage(messageName);

  // If message not found, return message name directly
  if (!message) {
    // console.warn(`No localized message found for: ${messageName}`); // Log removed
    return messageName;
  }

  // console.log(`Getting localized message for ${messageName}:`, message); // Log removed
  return message;
};

window.updateUILanguage = function () {
  const userLang = getUserLanguage();
  // console.log('Current UI language:', userLang); // Log removed

  // Handle regular data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const messageName = element.getAttribute('data-i18n');
    const localizedMessage = window.getLocalizedMessage(messageName);
    element.textContent = localizedMessage;
  });

  // Handle placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const messageName = element.getAttribute('data-i18n-placeholder');
    element.placeholder = window.getLocalizedMessage(messageName);
  });

  // Handle title
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const messageName = element.getAttribute('data-i18n-title');
    element.title = window.getLocalizedMessage(messageName);
  });
};

// Automatically update UI language after document load
document.addEventListener('DOMContentLoaded', window.updateUILanguage);
